"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail, FileDiff, CalendarDays, Settings,
  Receipt, FolderOpen, Trash2, Images, Table2,
  MessagesSquare, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from 'react-i18next';
import { ChatForm } from "./chat-form";
import { ChatHeader } from "./chat-header";
import { OfflineOverlay } from "@/components/layout/offline-overlay";
import { StreamingMessage } from "@/components/messages/assistant-message";
import { FileChip } from "./file-chip";
import { useChat } from "@/hooks/use-chat";
import { useChatStore } from "@/stores/chat-store";
import { useArtifactStore } from "@/stores/artifact-store";
import { useActivityStore } from "@/stores/activity-store";
import { useSettingsStore } from "@/stores/settings-store";

const FEATURED_STARTERS = [
  { icon: Mail, textKey: "starterDraftFromNotes", descKey: "starterDraftFromNotesDesc", promptKey: "starterDraftFromNotesPrompt" },
  { icon: FileDiff, textKey: "starterCompareDocs", descKey: "starterCompareDocsDesc", promptKey: "starterCompareDocsPrompt" },
  { icon: CalendarDays, textKey: "starterWeeklyDigest", descKey: "starterWeeklyDigestDesc", promptKey: "starterWeeklyDigestPrompt" },
  { icon: Receipt, textKey: "starterOrganizeBills", descKey: "starterOrganizeBillsDesc", promptKey: "starterOrganizeBillsPrompt" },
  { icon: FolderOpen, textKey: "starterSummarizeFolder", descKey: "starterSummarizeFolderDesc", promptKey: "starterSummarizeFolderPrompt" },
  { icon: Trash2, textKey: "starterCleanupFiles", descKey: "starterCleanupFilesDesc", promptKey: "starterCleanupFilesPrompt" },
  { icon: Images, textKey: "starterRenamePhotos", descKey: "starterRenamePhotosDesc", promptKey: "starterRenamePhotosPrompt" },
  { icon: Table2, textKey: "starterExtractPdfTables", descKey: "starterExtractPdfTablesDesc", promptKey: "starterExtractPdfTablesPrompt" },
];

const STARTERS_PER_MOUNT = 3;

interface LandingProps {
  directoryParam?: string | null;
}

function workspaceBasename(path: string | null | undefined): string | null {
  if (!path || path === ".") return null;
  const trimmed = path.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/);
  const last = segments[segments.length - 1];
  return last || null;
}

function pickRandomStarters(count: number): typeof FEATURED_STARTERS {
  const pool = [...FEATURED_STARTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function Landing({ directoryParam = null }: LandingProps) {
  const { t } = useTranslation('chat');
  const { sendMessage, sendTaskBatch, isGenerating, stopGeneration, pendingUserText, pendingAttachments, streamingParts, streamingText, streamingReasoning } = useChat();
  const globalWorkspace = useSettingsStore((s) => s.workspaceDirectory);
  const workspaceName = workspaceBasename(globalWorkspace);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  // Start with a deterministic slice so SSR and first client render match,
  // then shuffle post-mount. A new random pair is drawn every time Landing
  // remounts (i.e. every new chat opened).
  const [starters, setStarters] = useState(() =>
    FEATURED_STARTERS.slice(0, STARTERS_PER_MOUNT),
  );
  // `round` increments every refresh so each starter re-mounts
  // (keyed by round+index) and the flip animation replays — avoids the
  // "same textKey sampled twice in a row = no animation" trap.
  const [round, setRound] = useState(0);
  useEffect(() => {
    setStarters(pickRandomStarters(STARTERS_PER_MOUNT));
    setRound((r) => r + 1);
    const id = setInterval(() => {
      setStarters(pickRandomStarters(STARTERS_PER_MOUNT));
      setRound((r) => r + 1);
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const chat = useChatStore.getState();
    chat.resetSession(null);
    chat.setFocusedSession(null);
    useSettingsStore.getState().setWorkspaceDirectory(directoryParam || null);
    useArtifactStore.getState().clearAll();
    useActivityStore.getState().close();
  }, [directoryParam]);

  // Capture the user text in local state so it persists even after
  // startGeneration() clears pendingUserText from the global store.
  // This prevents the user bubble from flashing away before navigation.
  const capturedTextRef = useRef<string | null>(null);
  if (pendingUserText) {
    capturedTextRef.current = pendingUserText;
  }
  if (!isGenerating) {
    capturedTextRef.current = null;
  }
  const displayText = pendingUserText ?? capturedTextRef.current;

  // When generating, switch to a chat-like layout — uses the same
  // StreamingMessage component as chat-view for visual consistency.
  if (isGenerating) {
    return (
      <div className="relative flex flex-1 flex-col h-full overflow-hidden">
        <OfflineOverlay />
        <ChatHeader />

        {/* Messages area — optimistic user bubble + streaming assistant */}
        <div className="flex-1 overflow-y-auto">
          {displayText && (
            <div className="px-4 py-3">
              <div className="mx-auto max-w-3xl xl:max-w-4xl">
                <motion.div
                  className="flex flex-col items-end"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="max-w-[85%] sm:max-w-[70%] rounded-xl border border-[var(--border-default)] bg-[var(--user-bubble-bg)] px-4 py-2.5">
                    <div className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
                      {displayText}
                    </div>
                    {pendingAttachments && pendingAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {pendingAttachments.map((att) => (
                          <FileChip key={att.file_id} file={att} />
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Reserve the real UserMessage action-bar row (mt-1 + h-7)
                      so the optimistic→persisted swap doesn't push "思考中" down. */}
                  <div className="mt-1 h-7" aria-hidden="true" />
                </motion.div>
              </div>
            </div>
          )}

          {/* Streaming assistant message — same component used in chat-view */}
          <div className="px-4 py-5">
            <div className="mx-auto max-w-3xl xl:max-w-4xl">
              <StreamingMessage
                sessionId={null}
                parts={streamingParts}
                streamingText={streamingText}
                streamingReasoning={streamingReasoning}
              />
            </div>
          </div>
        </div>

        {/* Input */}
        <ChatForm
          isGenerating={isGenerating}
          onSend={sendMessage}
          onSendTaskBatch={sendTaskBatch}
          onStop={stopGeneration}
          directory={globalWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col h-full overflow-hidden bg-[var(--surface-chat)]">
      <OfflineOverlay />
      <ChatHeader />

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--sidebar-bg)_0%,transparent_58%)] opacity-45" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--border-subtle)]" />
        <div className="relative w-full max-w-3xl xl:max-w-4xl">
          {/* Provider setup prompt */}
          {!activeProvider && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--brand-primary)]/25 bg-[var(--brand-primary)]/5 px-5 py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Settings className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t('setupProvider')}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('setupProviderDesc')}
                </p>
              </div>
              <Link
                href="/settings?tab=providers"
                className="shrink-0 inline-flex items-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
              >
                {t('configureSettings')}
              </Link>
            </motion.div>
          )}

          {/* Greeting — becomes workspace-aware when a folder is set, mirroring Codex */}
          <div className="mb-7 text-center pb-2">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--sidebar-bg)]/70 px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-sm)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              {t("landingEyebrow")}
            </div>
            <h1 className="text-3xl font-medium tracking-tight text-[var(--text-primary)] sm:text-[2.5rem]">
              {workspaceName
                ? t('greetingInWorkspace', { workspace: workspaceName })
                : t('greeting')}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              {t("landingSubtitle")}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] shadow-[var(--shadow-sm)]">
              <FolderOpen className="h-3.5 w-3.5" />
              <span>
                {workspaceName
                  ? t("landingWorkspaceBadge", { workspace: workspaceName })
                  : t("landingNoWorkspaceBadge")}
              </span>
            </div>
          </div>

          {/* Input — the focal point */}
          <div className="rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-primary)]/72 p-2 shadow-[var(--shadow-md)] backdrop-blur-xl">
            <ChatForm
              isGenerating={isGenerating}
              onSend={sendMessage}
              onSendTaskBatch={sendTaskBatch}
              onStop={stopGeneration}
              directory={globalWorkspace}
              className="px-0"
            />
          </div>

          {/* Suggested starters */}
          <div className="mt-5" style={{ perspective: 1200 }}>
            <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium text-[var(--text-tertiary)]">
              <MessagesSquare className="h-3.5 w-3.5" />
              <span>{t("recommendedActions")}</span>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <div className="grid gap-2 sm:grid-cols-3">
                {starters.map((starter, index) => {
                  const StarterIcon = starter.icon;
                  return (
                    <motion.button
                      key={`${round}-${index}`}
                      initial={{ opacity: 0, rotateX: -90, y: 8 }}
                      animate={{ opacity: 1, rotateX: 0, y: 0 }}
                      exit={{ opacity: 0, rotateX: 90, y: -8 }}
                      transition={{
                        duration: 0.55,
                        delay: index * 0.12,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      onClick={() => useArtifactStore.getState().requestFix(t(starter.promptKey))}
                      disabled={isGenerating}
                      className="group min-h-[104px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)]/70 p-3 text-left shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-default)] hover:bg-[var(--surface-secondary)]/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]">
                        <StarterIcon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {t(starter.textKey)}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[var(--text-tertiary)]">
                        {t(starter.descKey)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
