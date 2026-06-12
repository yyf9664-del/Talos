"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceBadge {
  label: string | number;
  tone?: "default" | "success" | "warning" | "error";
}

interface WorkspaceCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  count?: string | number | null;
  badges?: WorkspaceBadge[];
  collapsed?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

const BADGE_TONE_CLASS: Record<NonNullable<WorkspaceBadge["tone"]>, string> = {
  default: "border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
  success: "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]",
  warning: "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  error: "border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]",
};

export function WorkspaceBadge({ label, tone = "default" }: WorkspaceBadge) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
        BADGE_TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

export function WorkspaceCard({
  title,
  description,
  icon: Icon,
  count,
  badges,
  collapsed = false,
  onToggle,
  children,
  className,
  contentClassName,
}: WorkspaceCardProps) {
  const header = (
    <div className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--text-tertiary)]">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
              {title}
            </span>
            {description && (
              <span className="mt-0.5 block truncate text-[12px] text-[var(--text-tertiary)]">
                {description}
              </span>
            )}
          </div>
        </div>
        {badges && badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {badges.map((badge, index) => (
              <WorkspaceBadge
                key={`${badge.label}-${index}`}
                label={badge.label}
                tone={badge.tone}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {count !== null && count !== undefined && count !== "" && (
          <WorkspaceBadge label={count} />
        )}
        {onToggle && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-200",
              collapsed && "-rotate-90",
            )}
          />
        )}
      </div>
    </div>
  );

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {onToggle ? (
        <button
          type="button"
          className="w-full transition-colors hover:bg-[var(--surface-secondary)]/55"
          onClick={onToggle}
        >
          {header}
        </button>
      ) : (
        header
      )}

      {onToggle ? (
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="overflow-hidden"
            >
              <div className={cn("border-t border-[var(--border-subtle)]", contentClassName)}>
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : children ? (
        <div className={cn("border-t border-[var(--border-subtle)]", contentClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
