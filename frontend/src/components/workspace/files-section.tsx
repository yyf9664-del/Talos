"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore, type WorkspaceFile } from "@/stores/workspace-store";
import { useArtifactStore } from "@/stores/artifact-store";
import { artifactTypeFromExtension, languageFromExtension } from "@/lib/artifacts";
import { cn } from "@/lib/utils";
import { WorkspaceCard } from "./workspace-card";

function FileItem({ file }: { file: WorkspaceFile }) {
  const { t } = useTranslation("chat");
  const handleClick = () => {
    const store = useArtifactStore.getState();
    // Match by filePath first, then fall back to matching by title (for artifacts
    // created by the artifact tool which don't have filePath set yet)
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const existing = store.artifacts.find(
      (a) => a.filePath === file.path || (!a.filePath && a.title === baseName),
    );
    if (existing) {
      // Re-open with filePath set so future lookups match directly
      store.openArtifact({ ...existing, filePath: file.path });
      return;
    }
    store.openArtifact({
      id: `workspace-${file.path}`,
      type: artifactTypeFromExtension(file.path) ?? "file-preview",
      title: file.name,
      content: "",
      language: languageFromExtension(file.path),
      filePath: file.path,
    });
  };

  const displayName =
    file.type === "instructions" ? `${t("workspaceInstructions")} · ${file.name}` : file.name;

  return (
    <button
      className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--surface-secondary)]/70"
      onClick={handleClick}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[var(--text-primary)]">{displayName}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary)]">
          {file.path}
        </p>
      </div>
    </button>
  );
}

function Scratchpad() {
  const { t } = useTranslation("chat");
  const content = useWorkspaceStore((s) => s.scratchpadContent);
  const setContent = useWorkspaceStore((s) => s.setScratchpadContent);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mx-4 mb-3">
      <button
        className={cn(
          "flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-left transition-colors",
          "border",
          expanded
            ? "border-[var(--border-focus)] bg-[var(--surface-primary)]"
            : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)]" />
        )}
        <span className="text-[13px] text-[var(--text-tertiary)]">
          {t("workspaceScratchpad")}
        </span>
      </button>
      {expanded && (
        <textarea
          className={cn(
            "w-full mt-1.5 px-3 py-2 text-[13px] leading-relaxed rounded-lg resize-none",
            "bg-[var(--surface-primary)] text-[var(--text-primary)]",
            "placeholder:text-[var(--text-quaternary)]",
            "border border-[var(--border-focus)] focus:outline-none",
            "min-h-[80px]",
          )}
          placeholder={t("workspaceScratchpadPlaceholder")}
          aria-label={t("workspaceScratchpad")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

export function FilesCard() {
  const { t } = useTranslation("chat");
  const workspaceFiles = useWorkspaceStore((s) => s.workspaceFiles);
  const scratchpadContent = useWorkspaceStore((s) => s.scratchpadContent);
  const collapsed = useWorkspaceStore((s) => s.collapsedSections["files"]);
  const toggleSection = useWorkspaceStore((s) => s.toggleSection);
  const hasContent = workspaceFiles.length > 0 || scratchpadContent.trim().length > 0;
  const latestFile = workspaceFiles[workspaceFiles.length - 1];

  return (
    <WorkspaceCard
      title={t("workspaceFiles")}
      description={
        workspaceFiles.length > 0
          ? t("workspaceGeneratedFiles", { count: workspaceFiles.length })
          : hasContent
            ? t("workspaceNotesAvailable")
            : t("workspaceNoFilesYet")
      }
      icon={Paperclip}
      count={workspaceFiles.length > 0 ? workspaceFiles.length : null}
      badges={latestFile ? [{ label: t("workspaceLatestFile", { name: latestFile.name }) }] : undefined}
      collapsed={collapsed}
      onToggle={() => toggleSection("files")}
      contentClassName="pb-1 pt-2"
    >
      {workspaceFiles.length > 0 ? (
        <div className="space-y-1 px-2">
          {workspaceFiles.map((file) => (
            <FileItem key={file.path} file={file} />
          ))}
        </div>
      ) : (
        <p className="mx-4 rounded-2xl border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-[12px] text-[var(--text-tertiary)]">
          {t("workspaceFilesEmptyDescription")}
        </p>
      )}
      <div className="mt-2">
        <Scratchpad />
      </div>
    </WorkspaceCard>
  );
}
