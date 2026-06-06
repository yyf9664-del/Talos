"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isRemoteMode } from "@/lib/remote-connection";

interface PlanAcceptPromptProps {
  onRespond: (action: "accept" | "revise" | "stop", options?: { mode?: "auto" | "ask"; feedback?: string }) => void;
}

/**
 * Replaces the chat input bar when a plan review is pending.
 * Shows 3 options (matching Claude Code's UX) + a text input for feedback.
 */
export function PlanAcceptPrompt({ onRespond }: PlanAcceptPromptProps) {
  const { t } = useTranslation("chat");
  const [feedback, setFeedback] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = isRemoteMode();

  // Keyboard shortcuts: 1/2/3 for options, Esc to stop.
  // Only fire when the event target is within this component or on <body>
  // (i.e. no modal/dropdown/overlay is focused).
  useEffect(() => {
    if (isMobile) return; // Skip keyboard handlers on mobile
    const handler = (e: KeyboardEvent) => {
      // Skip if the user is typing in an unrelated input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isInsideThis = containerRef.current?.contains(target);
      const isBodyLevel = target === document.body;
      if (!isInsideThis && !isBodyLevel) return;

      // If the feedback input is focused, only handle Escape (not number keys)
      const isFeedbackFocused = target.tagName === "INPUT" && isInsideThis;

      if (e.key === "Escape") {
        e.preventDefault();
        onRespond("stop");
      } else if (!isFeedbackFocused) {
        if (e.key === "1") {
          e.preventDefault();
          onRespond("accept", { mode: "auto" });
        } else if (e.key === "2") {
          e.preventDefault();
          onRespond("accept", { mode: "ask" });
        } else if (e.key === "3") {
          e.preventDefault();
          onRespond("stop");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isMobile, onRespond]);

  const handleFeedbackSubmit = useCallback(() => {
    const text = feedback.trim();
    if (!text) return;
    onRespond("revise", { feedback: text });
    setFeedback("");
  }, [feedback, onRespond]);

  // Mobile layout
  if (isMobile) {
    return (
      <div ref={containerRef} className="px-3 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-3 shadow-[var(--shadow-md)] space-y-3 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t("planAcceptPrompt")}
              </h3>
              <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                {t("planSelectText")}
              </p>
            </div>
            <button
              onClick={() => onRespond("stop")}
              className="rounded-full px-3 py-1.5 text-sm text-[var(--text-tertiary)] active:bg-[var(--surface-secondary)] active:text-[var(--text-primary)]"
            >
              {t("cancel")}
            </button>
          </div>

          {/* Option 1: Auto-accept — primary */}
          <button
            onClick={() => onRespond("accept", { mode: "auto" })}
            className="w-full flex items-center gap-3 rounded-xl bg-[var(--brand-primary)] px-4 py-3.5 min-h-[48px] text-left transition-colors active:scale-[0.97]"
          >
            <span className="text-base font-medium text-[var(--brand-primary-text)]">{t("planOptionAutoAccept")}</span>
          </button>

          {/* Option 2: Manual approve */}
          <button
            onClick={() => onRespond("accept", { mode: "ask" })}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-3.5 min-h-[48px] text-left transition-colors active:scale-[0.97]"
          >
            <span className="text-base font-medium text-[var(--text-primary)]">{t("planOptionManualApprove")}</span>
          </button>

          {/* Option 3: Keep planning */}
          <button
            onClick={() => onRespond("stop")}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-3.5 min-h-[48px] text-left transition-colors active:scale-[0.97]"
          >
            <span className="text-base font-medium text-[var(--text-primary)]">{t("planOptionKeepPlanning")}</span>
          </button>

          {/* Feedback input */}
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFeedbackSubmit();
            }}
            placeholder={t("planFeedbackPlaceholder")}
            aria-label={t("planFeedbackPlaceholder")}
            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--ring)] placeholder:text-[var(--text-secondary)]"
          />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div ref={containerRef} className="px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl xl:max-w-4xl">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-3 shadow-[var(--shadow-md)] animate-slide-up">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]">
                  {t("planReadyForReview")}
                </span>
                <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {t("planAcceptPrompt")}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {t("planSelectText")}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-[var(--text-quaternary)]">
              {t("planEscToCancel")}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {/* Option 1: Yes, and auto-accept — highlighted/primary */}
            <button
              onClick={() => onRespond("accept", { mode: "auto" })}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-heavy)] bg-[var(--surface-secondary)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-tertiary)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[11px] font-semibold text-[var(--brand-primary)]">1</span>
              <span className="min-w-0 text-sm font-medium leading-snug text-[var(--text-primary)]">{t("planOptionAutoAccept")}</span>
            </button>

            {/* Option 2: Yes, and manually approve edits */}
            <button
              onClick={() => onRespond("accept", { mode: "ask" })}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-tertiary)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-tertiary)] text-[11px] font-semibold text-[var(--text-secondary)]">2</span>
              <span className="min-w-0 text-sm font-medium leading-snug text-[var(--text-primary)]">{t("planOptionManualApprove")}</span>
            </button>

            {/* Option 3: No, keep planning */}
            <button
              onClick={() => onRespond("stop")}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-tertiary)]"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-tertiary)] text-[11px] font-semibold text-[var(--text-secondary)]">3</span>
              <span className="min-w-0 text-sm font-medium leading-snug text-[var(--text-primary)]">{t("planOptionKeepPlanning")}</span>
            </button>
          </div>

          {/* Text input for custom feedback */}
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFeedbackSubmit();
            }}
            placeholder={t("planFeedbackPlaceholder")}
            aria-label={t("planFeedbackPlaceholder")}
            className="mt-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>
      </div>
    </div>
  );
}
