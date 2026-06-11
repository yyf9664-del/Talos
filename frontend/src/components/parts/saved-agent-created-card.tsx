"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronRight, Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolPart } from "@/types/message";

interface SavedAgentCreatedCardProps {
  data: ToolPart;
}

interface CreatedField {
  id?: string;
  name?: string;
  type?: string;
  required?: boolean;
}

/**
 * Rendered in chat after the `persist_agent` tool runs. Shows the created
 * reusable agent (title + input chips) and navigates to the Agents page on
 * click. Reads from tool metadata, falling back to the tool call input args.
 */
export function SavedAgentCreatedCard({ data }: SavedAgentCreatedCardProps) {
  const { t } = useTranslation("saved-agents");
  const router = useRouter();

  const input = (data.state.input ?? {}) as Record<string, unknown>;
  const metadata = (data.state.metadata ?? {}) as Record<string, unknown>;

  const isRunning = data.state.status === "running" || data.state.status === "pending";
  const isError = data.state.status === "error";

  const title =
    (typeof metadata.title === "string" && metadata.title) ||
    (typeof input.title === "string" && input.title) ||
    "Agent";
  const description =
    (typeof metadata.description === "string" && metadata.description) ||
    (typeof input.description === "string" && input.description) ||
    "";
  const version = typeof metadata.version === "string" ? metadata.version : undefined;

  const fieldsRaw = Array.isArray(metadata.fields)
    ? (metadata.fields as CreatedField[])
    : Array.isArray(input.form_schema)
      ? (input.form_schema as CreatedField[])
      : [];
  const fields = fieldsRaw.filter((f): f is CreatedField => !!f && typeof f === "object");

  const handleClick = useCallback(() => {
    router.push("/agents");
  }, [router]);

  if (isError) {
    return (
      <div className="flex items-center gap-3 w-full rounded-xl border border-[var(--color-destructive)]/30 bg-[var(--surface-secondary)] px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-tertiary)] text-[var(--color-destructive)]">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <p className="text-sm font-medium text-[var(--text-primary)]">{t("createdFailed")}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isRunning}
      className={cn(
        "flex items-center gap-3 w-full rounded-xl border border-[var(--border-default)] px-4 py-3 text-left group",
        "bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)]",
        "hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all duration-150",
        isRunning && "opacity-70 pointer-events-none",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-tertiary)] text-[var(--brand-primary)]">
        {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{title}</p>
          {version && (
            <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
              {t("version", { version })}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{t("createdTitle")}</p>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{description}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {fields.length > 0 ? (
            fields.map((field, i) => (
              <span
                key={`${field.id ?? field.name ?? "f"}-${i}`}
                className="inline-flex items-center rounded-md bg-[var(--surface-tertiary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]"
              >
                {field.name || field.id}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[var(--text-tertiary)]">{t("noInputsShort")}</span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
