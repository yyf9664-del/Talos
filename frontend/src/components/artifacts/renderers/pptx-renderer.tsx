"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api";
import { API } from "@/lib/constants";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { PPTXData } from "@kandiforge/pptx-renderer";

interface PptxRendererProps {
  filePath?: string;
}

const CJK_FONT_FALLBACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Noto Sans SC", Arial, sans-serif';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function withCjkFallback(fontFamily?: string): string {
  const clean = fontFamily?.trim();
  if (!clean) return CJK_FONT_FALLBACK;
  if (
    clean.includes("PingFang") ||
    clean.includes("Microsoft YaHei") ||
    clean.includes("Noto Sans CJK") ||
    clean.includes("Source Han")
  ) {
    return clean;
  }
  return `${clean}, ${CJK_FONT_FALLBACK}`;
}

function repairUtf8Mojibake(text: string): string {
  // Common symptom when UTF-8 Chinese text is decoded as Latin-1, e.g. "ä¸­æ–‡".
  // Only attempt repair for strings with mojibake markers and no existing CJK.
  if (/[\u4E00-\u9FFF]/.test(text)) return text;
  if (!/[ÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîï]/.test(text)) {
    return text;
  }

  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /[\u4E00-\u9FFF]/.test(repaired) ? repaired : text;
  } catch {
    return text;
  }
}

function normalizePptxForCanvas(data: PPTXData): PPTXData {
  const normalizeTextRun = (run: { text?: string; fontFamily?: string }) => {
    if (typeof run.text === "string") run.text = repairUtf8Mojibake(run.text);
    run.fontFamily = withCjkFallback(run.fontFamily);
  };

  const normalizeShape = (shape: PPTXData["slides"][number]["shapes"][number]) => {
    if (typeof shape.text === "string") shape.text = repairUtf8Mojibake(shape.text);
    if (shape.textStyle) {
      shape.textStyle.fontFamily = withCjkFallback(shape.textStyle.fontFamily);
      if (shape.textStyle.bullet?.font) {
        shape.textStyle.bullet.font = withCjkFallback(shape.textStyle.bullet.font);
      }
    }
    shape.paragraphs?.forEach((paragraph) => {
      if (paragraph.bullet?.font) {
        paragraph.bullet.font = withCjkFallback(paragraph.bullet.font);
      }
      paragraph.runs.forEach(normalizeTextRun);
    });
    shape.table?.rows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (typeof cell.text === "string") cell.text = repairUtf8Mojibake(cell.text);
        if (cell.textStyle) {
          cell.textStyle.fontFamily = withCjkFallback(cell.textStyle.fontFamily);
        }
        cell.paragraphs?.forEach((paragraph) => {
          if (paragraph.bullet?.font) {
            paragraph.bullet.font = withCjkFallback(paragraph.bullet.font);
          }
          paragraph.runs.forEach(normalizeTextRun);
        });
      });
    });
    shape.children?.forEach(normalizeShape);
  };

  data.slides.forEach((slide) => {
    if (slide.notes) slide.notes = repairUtf8Mojibake(slide.notes);
    slide.shapes.forEach(normalizeShape);
    slide.masterShapes?.forEach(normalizeShape);
    slide.layoutShapes?.forEach(normalizeShape);
    slide.slideShapes?.forEach(normalizeShape);
  });

  return data;
}

export function PptxRenderer({ filePath }: PptxRendererProps) {
  const workspace = useWorkspaceStore((s) => s.activeWorkspacePath);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [pptxData, setPptxData] = useState<PPTXData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const blobRef = useRef<Blob | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  const [PptxLib, setPptxLib] = useState<{
    SlideRenderer: new (
      canvas: HTMLCanvasElement,
      options?: {
        width?: number;
        height?: number;
        scale?: number;
        slideWidth?: number;
        slideHeight?: number;
      }
    ) => {
      renderSlide: (
        slide: PPTXData["slides"][number],
        renderMode?: "complete"
      ) => Promise<void>;
    };
  } | null>(null);

  useEffect(() => {
    if (!filePath) {
      setError("No file path provided");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch binary content
        const res = await api.post<{
          content_base64: string;
          name: string;
        }>(API.FILES.CONTENT_BINARY, { path: filePath, workspace });

        if (cancelled) return;

        setFileName(res.name);
        const buffer = base64ToArrayBuffer(res.content_base64);
        blobRef.current = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });

        // Dynamically import parser + viewer (SSR-safe)
        const pptxModule = await import("@kandiforge/pptx-renderer");
        const parsed = normalizePptxForCanvas(await pptxModule.parsePPTX(buffer));

        if (cancelled) return;

        setPptxLib({
          SlideRenderer: pptxModule.SlideRenderer as unknown as new (
            canvas: HTMLCanvasElement,
            options?: {
              width?: number;
              height?: number;
              scale?: number;
              slideWidth?: number;
              slideHeight?: number;
            }
          ) => {
            renderSlide: (
              slide: PPTXData["slides"][number],
              renderMode?: "complete"
            ) => Promise<void>;
          },
        });
        setPptxData(parsed);
        setCurrentSlide(0);
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err, "Failed to load presentation"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath, workspace]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setViewportSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleDownload = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "presentation.pptx";
    a.click();
    URL.revokeObjectURL(url);
  }, [fileName]);

  const slideMetrics = useMemo(() => {
    if (!pptxData || viewportSize.width === 0 || viewportSize.height === 0) {
      return { width: 0, height: 0, thumbWidth: 0, thumbHeight: 0 };
    }

    const aspect = pptxData.size.width / pptxData.size.height;
    const availableWidth = Math.max(240, viewportSize.width - 24);
    const availableHeight = Math.max(180, viewportSize.height - 148);

    let width = availableWidth;
    let height = width / aspect;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspect;
    }

    const thumbWidth = Math.min(132, Math.max(88, (viewportSize.width - 40) / 3));
    const thumbHeight = thumbWidth / aspect;
    return {
      width: Math.floor(width),
      height: Math.floor(height),
      thumbWidth: Math.floor(thumbWidth),
      thumbHeight: Math.floor(thumbHeight),
    };
  }, [pptxData, viewportSize]);

  useEffect(() => {
    if (!PptxLib || !pptxData || !mainCanvasRef.current || slideMetrics.width === 0 || slideMetrics.height === 0) {
      return;
    }

    let cancelled = false;
    const render = async () => {
      try {
        const renderer = new PptxLib.SlideRenderer(mainCanvasRef.current!, {
          width: slideMetrics.width,
          height: slideMetrics.height,
          scale: Math.max(1, window.devicePixelRatio || 1),
          slideWidth: pptxData.size.width,
          slideHeight: pptxData.size.height,
        });
        await renderer.renderSlide(pptxData.slides[currentSlide], "complete");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render slide");
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [PptxLib, pptxData, currentSlide, slideMetrics]);

  useEffect(() => {
    if (!PptxLib || !pptxData || slideMetrics.thumbWidth === 0 || slideMetrics.thumbHeight === 0) {
      return;
    }

    thumbCanvasRefs.current = thumbCanvasRefs.current.slice(0, pptxData.slides.length);
    let cancelled = false;

    const renderThumbs = async () => {
      try {
        await Promise.all(
          pptxData.slides.map(async (slide, index) => {
            const canvas = thumbCanvasRefs.current[index];
            if (!canvas) return;
            const renderer = new PptxLib.SlideRenderer(canvas, {
              width: slideMetrics.thumbWidth,
              height: slideMetrics.thumbHeight,
              scale: 1,
              slideWidth: pptxData.size.width,
              slideHeight: pptxData.size.height,
            });
            await renderer.renderSlide(slide, "complete");
          })
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render thumbnails");
        }
      }
    };

    void renderThumbs();
    return () => {
      cancelled = true;
    };
  }, [PptxLib, pptxData, slideMetrics.thumbWidth, slideMetrics.thumbHeight]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden bg-[var(--surface-secondary)] relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-primary)]">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}
        {pptxData && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-3 py-2 shrink-0">
              <div className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                {fileName || "presentation.pptx"}
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                  disabled={currentSlide === 0}
                  title="Previous slide"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] text-center text-[11px] text-[var(--text-secondary)]">
                  {currentSlide + 1} / {pptxData.slides.length}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                  onClick={() => setCurrentSlide((s) => Math.min(pptxData.slides.length - 1, s + 1))}
                  disabled={currentSlide >= pptxData.slides.length - 1}
                  title="Next slide"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-[var(--text-tertiary)] hover:bg-[var(--surface-primary)] hover:text-[var(--text-primary)]"
                  onClick={handleDownload}
                  disabled={!blobRef.current}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto px-3 py-4">
              <div className="flex h-full items-center justify-center">
                <div
                  className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
                  style={{
                    width: slideMetrics.width || undefined,
                    height: slideMetrics.height || undefined,
                  }}
                >
                  <canvas
                    ref={mainCanvasRef}
                    role="img"
                    aria-label={`Slide ${currentSlide + 1}`}
                    className="block"
                    style={{
                      width: slideMetrics.width || undefined,
                      height: slideMetrics.height || undefined,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--border-default)] px-3 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {pptxData.slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentSlide(index)}
                    className={`group shrink-0 rounded-xl border p-1.5 text-left transition-colors ${
                      currentSlide === index
                        ? "border-[var(--border-focus)] bg-[var(--surface-primary)]"
                        : "border-[var(--border-default)] bg-[var(--surface-tertiary)] hover:border-[var(--border-hover)]"
                    }`}
                    title={`Slide ${index + 1}`}
                  >
                    <div className="mb-1 px-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                      {index + 1}
                    </div>
                    <div
                      className="overflow-hidden rounded-lg border border-black/10 bg-white"
                      style={{
                        width: slideMetrics.thumbWidth || undefined,
                        height: slideMetrics.thumbHeight || undefined,
                      }}
                    >
                      <canvas
                        ref={(node) => {
                          thumbCanvasRefs.current[index] = node;
                        }}
                        aria-hidden="true"
                        className="block"
                        style={{
                          width: slideMetrics.thumbWidth || undefined,
                          height: slideMetrics.thumbHeight || undefined,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
