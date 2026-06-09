"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  ChevronDown,
  Copy,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  useDailyReview,
  useDailyReviews,
  useDeleteDailyReview,
  useGenerateDailyReview,
} from "@/hooks/use-daily-reviews";
import { apiErrorMessage } from "@/lib/api";
import { browseDirectory } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { DailyReview, DailyReviewListItem } from "@/types/daily-review";

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number) {
  const current = new Date(`${value}T12:00:00`);
  current.setDate(current.getDate() + days);
  return current.toISOString().slice(0, 10);
}

export function DailyReviewContent() {
  const { t } = useTranslation("daily-review");
  const [folderPath, setFolderPath] = useState("");
  const [reviewDate, setReviewDate] = useState(todayString());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentReview, setCurrentReview] = useState<DailyReview | null>(null);
  const [showSources, setShowSources] = useState(false);

  const { data: reviews } = useDailyReviews();
  const { data: selectedReview } = useDailyReview(selectedId);
  const generateReview = useGenerateDailyReview();
  const deleteReview = useDeleteDailyReview();

  const displayedReview = currentReview ?? selectedReview ?? null;
  const history = useMemo(() => reviews ?? [], [reviews]);

  const runGenerate = (folder: string, date: string) => {
    const trimmedFolder = folder.trim();
    if (!trimmedFolder) {
      toast.error(t("missingFolder"));
      return;
    }

    generateReview.mutate(
      {
        folder_path: trimmedFolder,
        review_date: date,
      },
      {
        onSuccess: (review) => {
          setCurrentReview(review);
          setSelectedId(null);
          setShowSources(false);
        },
        onError: (err) => {
          toast.error(apiErrorMessage(err, t("failedGenerate")));
        },
      },
    );
  };

  const handleChooseFolder = async () => {
    try {
      const path = await browseDirectory(t("chooseFolder"));
      if (!path) return;
      setFolderPath(path);
      runGenerate(path, reviewDate);
    } catch {
      toast.error(t("failedChooseFolder"));
    }
  };

  const handleGenerate = () => {
    runGenerate(folderPath, reviewDate);
  };

  const handleShiftDate = (days: number) => {
    const nextDate = shiftDate(reviewDate, days);
    setReviewDate(nextDate);
    if (folderPath.trim()) runGenerate(folderPath, nextDate);
  };

  const handleSelectHistory = (review: DailyReviewListItem) => {
    setCurrentReview(null);
    setSelectedId(review.id);
    setShowSources(false);
  };

  const handleDelete = (reviewId: string) => {
    deleteReview.mutate(reviewId, {
      onSuccess: () => {
        if (selectedId === reviewId) setSelectedId(null);
        if (currentReview?.id === reviewId) setCurrentReview(null);
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err, t("failedDelete")));
      },
    });
  };

  const handleCopy = async () => {
    if (!displayedReview) return;
    await navigator.clipboard.writeText(displayedReview.content_markdown);
    toast.success(t("copied"));
  };

  return (
    <div className="mx-auto max-w-[920px] space-y-5">
      <section className="flex flex-col gap-3 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-w-[520px] truncate rounded-full border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2">
            {t("sourcePrefix")}: {folderPath || t("sourceEmpty")}
          </span>
          <button
            type="button"
            onClick={handleChooseFolder}
            className="cursor-pointer rounded-full border border-[var(--border-default)] px-3 py-2 transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
          >
            {t("changeFolder")}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleShiftDate(-1)}
            className="cursor-pointer rounded-full border border-[var(--border-default)] px-3 py-2 transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
            aria-label={t("previousDay")}
          >
            ‹
          </button>
          <span className="whitespace-nowrap text-[var(--text-secondary)]">
            {reviewDate === todayString() ? `${t("today")} · ${reviewDate}` : reviewDate}
          </span>
          <button
            type="button"
            onClick={() => handleShiftDate(1)}
            className="cursor-pointer rounded-full border border-[var(--border-default)] px-3 py-2 transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
            aria-label={t("nextDay")}
          >
            ›
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generateReview.isPending}
            className="cursor-pointer rounded-full border border-[var(--border-default)] px-3 py-2 transition-colors hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-50"
          >
            {generateReview.isPending ? t("generating") : t("generate")}
          </button>
        </div>
      </section>

      <main className="rounded-[32px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent),var(--surface-secondary)] p-4 shadow-[var(--shadow-sm)]">
        {displayedReview ? (
          <article className="min-h-[680px] rounded-[25px] border border-[var(--border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_28%),var(--surface-primary)] px-6 py-10 shadow-[var(--shadow-md)] sm:px-16 sm:py-14">
            <div className="mb-3 text-ui-3xs tracking-[0.16em] text-[var(--text-tertiary)]">
              DAILY REVIEW
            </div>
            <h2 className="mb-9 font-serif text-4xl font-medium tracking-[-0.03em] text-[var(--text-primary)]">
              {displayedReview.title || t("currentReview")}
            </h2>

            <div className="min-h-[420px]">
              <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-headings:mt-8 prose-headings:text-[var(--text-primary)] prose-p:leading-8 prose-p:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayedReview.content_markdown}
                </ReactMarkdown>
              </div>
            </div>

            <footer className="mt-10 border-t border-[var(--border-default)] pt-5">
              <div className="flex flex-col gap-3 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
                <span>{t("autoSaved")}</span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="cursor-pointer text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <Copy className="mr-1 inline h-3.5 w-3.5" />
                    {t("copy")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSources((value) => !value)}
                    className="cursor-pointer text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {t("sources")} · {t("sourceFiles", { count: displayedReview.source_files.length })}
                    <ChevronDown
                      className={cn(
                        "ml-1 inline h-3.5 w-3.5 transition-transform",
                        showSources && "rotate-180",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(displayedReview.id)}
                    disabled={deleteReview.isPending}
                    className="cursor-pointer text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-50"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {showSources && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {displayedReview.source_files.map((source) => (
                    <div
                      key={source.path}
                      className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2"
                    >
                      <div className="truncate text-xs font-medium text-[var(--text-primary)]">
                        {source.relative_path}
                      </div>
                      <div className="mt-1 text-ui-3xs text-[var(--text-tertiary)]">
                        {source.modified_at}
                        {source.truncated ? ` · ${t("truncated")}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </footer>
          </article>
        ) : (
          <div className="flex min-h-[680px] flex-col items-center justify-center rounded-[25px] border border-dashed border-[var(--border-default)] bg-[var(--surface-primary)] px-8 text-center">
            <BookOpenEmpty />
            <h2 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">
              {t("emptyStateTitle")}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-tertiary)]">
              {t("emptyStateDescription")}
            </p>
            <p className="mt-6 rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-ui-3xs text-[var(--text-tertiary)]">
              {t("readingHint")}
            </p>
          </div>
        )}
      </main>

      {history.length > 0 && (
        <section className="flex gap-2 overflow-x-auto pb-1" aria-label={t("history")}>
          {history.map((review) => (
            <button
              key={review.id}
              type="button"
              onClick={() => handleSelectHistory(review)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors",
                selectedId === review.id || currentReview?.id === review.id
                  ? "border-[var(--border-focus)] bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]",
              )}
            >
              {review.review_date}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function BookOpenEmpty() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--surface-secondary)] text-[var(--text-tertiary)]">
      <BookOpenText className="h-7 w-7" />
    </div>
  );
}
