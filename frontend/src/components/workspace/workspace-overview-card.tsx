"use client";

import { Database, FileText, FolderOpen, HardDrive, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceBadge, WorkspaceCard } from "./workspace-card";

function displayPath(path: string | null): string {
  if (!path) return "";
  const normalized = path.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function StatItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/60 px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-primary)] text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] leading-none text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

export function WorkspaceOverviewCard() {
  const { t } = useTranslation("chat");
  const workspacePath = useWorkspaceStore((s) => s.activeWorkspacePath);
  const workspaceFiles = useWorkspaceStore((s) => s.workspaceFiles);
  const todos = useWorkspaceStore((s) => s.todos);
  const taskBatch = useWorkspaceStore((s) => s.taskBatch);

  const activeTasks =
    todos.filter((todo) => todo.status !== "completed").length +
    (taskBatch?.tasks ?? []).filter((task) => !["completed", "failed", "cancelled"].includes(task.status)).length;

  const indexLabel = workspacePath ? t("workspaceIndexNotReady") : t("workspaceIndexUnavailable");

  return (
    <WorkspaceCard
      title={t("workspaceOverview")}
      description={
        workspacePath
          ? t("workspaceOverviewReady", { workspace: displayPath(workspacePath) })
          : t("workspaceOverviewNoWorkspace")
      }
      icon={workspacePath ? FolderOpen : HardDrive}
      badges={[
        {
          label: indexLabel,
          tone: workspacePath ? "default" : "warning",
        },
      ]}
      contentClassName="px-4 py-3"
    >
      <div className="space-y-3">
        {workspacePath ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {t("workspaceCurrent")}
            </p>
            <p className="mt-1 truncate text-[13px] text-[var(--text-primary)]" title={workspacePath}>
              {workspacePath}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-3 py-3 text-[12px] text-[var(--text-tertiary)]">
            {t("workspaceOverviewEmpty")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <StatItem icon={FileText} label={t("workspaceFiles")} value={workspaceFiles.length} />
          <StatItem icon={ListChecks} label={t("workspaceActiveTasks")} value={activeTasks} />
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
            <span className="truncate text-[12px] text-[var(--text-secondary)]">
              {t("workspaceIndexStatus")}
            </span>
          </div>
          <WorkspaceBadge label={indexLabel} tone={workspacePath ? "default" : "warning"} />
        </div>
      </div>
    </WorkspaceCard>
  );
}
