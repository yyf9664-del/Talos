"use client";

import { useState } from "react";
import { Boxes, FolderOpen, Loader2, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteSavedAgent } from "@/hooks/use-saved-agents";
import type { SavedAgent } from "@/types/saved-agent";

export function SavedAgentCard({
  agent,
  onRun,
}: {
  agent: SavedAgent;
  onRun: (agent: SavedAgent) => void;
}) {
  const { t } = useTranslation("saved-agents");
  const deleteMut = useDeleteSavedAgent();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const workspaceName =
    agent.workspace_path?.replace(/[/\\]+$/, "").split(/[/\\]/).pop() ||
    agent.workspace_path;

  const handleDelete = () => {
    deleteMut.mutate(agent.id, { onSuccess: () => setConfirmingDelete(false) });
  };

  return (
    <>
      <div
        className="group flex h-full flex-col rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 gap-3 hover:bg-[var(--surface-secondary)]/50 transition-colors cursor-pointer"
        onClick={() => onRun(agent)}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-secondary)]">
            <Boxes className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                {agent.title}
              </span>
              {agent.version && (
                <Badge variant="secondary" className="shrink-0 text-ui-3xs px-1.5 py-0">
                  {t("version", { version: agent.version })}
                </Badge>
              )}
            </div>
            {agent.description && (
              <p className="text-ui-2xs text-[var(--text-tertiary)] mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}
            {workspaceName && (
              <span
                className="mt-1.5 inline-flex max-w-full items-center gap-1 text-ui-3xs text-[var(--text-tertiary)]"
                title={agent.workspace_path}
              >
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{workspaceName}</span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs px-2.5"
            onClick={(e) => {
              e.stopPropagation();
              onRun(agent);
            }}
          >
            <Play className="h-3.5 w-3.5" />
            {t("run")}
          </Button>
          <button
            type="button"
            disabled={deleteMut.isPending}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
              deleteMut.isPending
                ? "opacity-50 cursor-not-allowed text-[var(--text-tertiary)]"
                : "text-[var(--text-tertiary)] hover:text-red-500 hover:bg-[var(--surface-secondary)]"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
          >
            {deleteMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <Dialog open onOpenChange={(open) => !open && setConfirmingDelete(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("confirmDelete")}</DialogTitle>
              <DialogDescription>
                {t("confirmDeleteDesc", { title: agent.title })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteMut.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
