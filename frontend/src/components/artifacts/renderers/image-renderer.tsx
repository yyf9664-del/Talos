"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { API } from "@/lib/constants";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface ImageRendererProps {
  filePath?: string;
  title?: string;
}

interface BinaryContentResponse {
  content_base64: string;
  name: string;
  mime_type: string;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImageRenderer({ filePath, title }: ImageRendererProps) {
  const workspace = useWorkspaceStore((s) => s.activeWorkspacePath);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState(title ?? "image");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(!!filePath);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      setError("No image file selected");
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .post<BinaryContentResponse>(
        API.FILES.CONTENT_BINARY,
        { path: filePath, workspace },
        { timeoutMs: 120_000 },
      )
      .then((res) => {
        if (cancelled) return;
        const nextBlob = base64ToBlob(res.content_base64, res.mime_type);
        objectUrl = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setFileName(res.name || title || "image");
        setImageUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[ImageRenderer] Error:", err);
        setError(apiErrorMessage(err, "Failed to load image"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filePath, title, workspace]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-[var(--color-destructive)]">{error ?? "No image available"}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--border-default)] px-3 py-2">
        <span className="truncate text-xs text-[var(--text-tertiary)]">{fileName}</span>
        {blob && (
          <button
            type="button"
            onClick={() => downloadBlob(blob, fileName)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--surface-primary)] px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {/* Blob URLs from local files cannot be optimized by next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={fileName}
          className="max-h-full max-w-full rounded-lg object-contain shadow-[var(--shadow-sm)]"
        />
      </div>
    </div>
  );
}
