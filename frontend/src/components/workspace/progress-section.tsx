"use client";

import { CheckCircle2, Circle, Loader2, XCircle, Ban, GitBranch, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useWorkspaceStore, type WorkspaceAgentTask, type WorkspaceTodo } from "@/stores/workspace-store";
import { cn } from "@/lib/utils";
import { getChatRoute } from "@/lib/routes";
import { WorkspaceCard } from "./workspace-card";

function TodoItem({ todo }: { todo: WorkspaceTodo }) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <div className="mt-0.5 shrink-0">
        {todo.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--tool-completed)]" />
        ) : todo.status === "in_progress" ? (
          <Loader2 className="h-4 w-4 text-[var(--text-accent)] animate-spin" />
        ) : (
          <Circle className="h-4 w-4 text-[var(--text-quaternary)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] leading-snug",
            todo.status === "completed"
              ? "text-[var(--text-tertiary)] line-through"
              : todo.status === "in_progress"
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]",
          )}
        >
          {todo.content}
        </p>
        {todo.status === "in_progress" && todo.activeForm && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 animate-pulse">
            {todo.activeForm}
          </p>
        )}
      </div>
    </div>
  );
}

function AgentTaskIcon({ status }: { status: WorkspaceAgentTask["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-[var(--tool-completed)]" />;
  }
  if (status === "running") {
    return <Loader2 className="h-4 w-4 text-[var(--text-accent)] animate-spin" />;
  }
  if (status === "failed") {
    return <XCircle className="h-4 w-4 text-[var(--tool-error)]" />;
  }
  if (status === "cancelled") {
    return <Ban className="h-4 w-4 text-[var(--text-tertiary)]" />;
  }
  return <Circle className="h-4 w-4 text-[var(--text-quaternary)]" />;
}

function AgentTaskItem({ task }: { task: WorkspaceAgentTask }) {
  const meta = [task.agent, task.model].filter(Boolean).join(" / ");
  const content = (
    <div className="flex items-start gap-2.5 py-1">
      <div className="mt-0.5 shrink-0">
        <AgentTaskIcon status={task.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[13px] leading-snug",
            task.status === "completed"
              ? "text-[var(--text-tertiary)]"
              : task.status === "failed"
                ? "text-[var(--tool-error)]"
                : task.status === "running"
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]",
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
          {task.error || meta || task.status}
        </p>
      </div>
      {task.session_id && (
        <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
      )}
    </div>
  );

  if (!task.session_id) return content;
  return (
    <Link href={getChatRoute(task.session_id)} className="block rounded-md hover:bg-white/[0.03]">
      {content}
    </Link>
  );
}

export function ProgressCard() {
  const { t } = useTranslation("chat");
  const todos = useWorkspaceStore((s) => s.todos);
  const taskBatch = useWorkspaceStore((s) => s.taskBatch);
  const collapsed = useWorkspaceStore((s) => s.collapsedSections["progress"]);
  const toggleSection = useWorkspaceStore((s) => s.toggleSection);
  const agentTasks = taskBatch?.tasks ?? [];
  const activeCount =
    todos.filter((todo) => todo.status !== "completed").length +
    agentTasks.filter((task) => !["completed", "failed", "cancelled"].includes(task.status)).length;
  const totalCount = todos.length + agentTasks.length;
  const previewItems = [
    ...todos.slice(0, 3).map((todo) => ({ key: todo.content, status: todo.status })),
    ...agentTasks.slice(0, 3).map((task) => ({ key: task.task_id, status: task.status })),
  ].slice(0, 3);

  if (totalCount === 0) return null;

  return (
    <WorkspaceCard
      title={t("workspaceProgress")}
      description={activeCount === 0 ? t("tasksCompleted", { count: totalCount }) : t("activeTaskCount", { count: activeCount })}
      icon={ListChecks}
      count={totalCount}
      collapsed={collapsed}
      onToggle={() => toggleSection("progress")}
      badges={previewItems.map((item) => ({
        label:
          item.status === "completed"
            ? t("statusCompleted")
            : item.status === "in_progress" || item.status === "running"
              ? t("statusRunning")
              : item.status === "failed"
                ? t("statusError")
                : t("statusPending"),
        tone:
          item.status === "completed"
            ? "success"
            : item.status === "in_progress" || item.status === "running"
              ? "warning"
              : item.status === "failed"
                ? "error"
                : "default",
      }))}
      contentClassName="px-4 pb-4 pt-2 space-y-0.5"
    >
      {taskBatch && (
        <div className="pb-1">
          <p className="px-0 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {t(taskBatch.mode === "parallel" ? "taskBatchParallel" : "taskBatchSequential")}
          </p>
          {agentTasks.map((task) => (
            <AgentTaskItem key={task.task_id} task={task} />
          ))}
        </div>
      )}
      {todos.map((todo, i) => (
        <TodoItem key={`${todo.content}-${i}`} todo={todo} />
      ))}
    </WorkspaceCard>
  );
}
