"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollAnchor } from "@/hooks/use-scroll-anchor";
import { MessageItem } from "./message-item";
import { AssistantMessageGroup } from "./assistant-message-group";
import { StreamingMessage } from "./assistant-message";
import { FileChip } from "@/components/chat/file-chip";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileAttachment } from "@/types/chat";
import { extractTextFromPartResponses } from "@/lib/utils";
import type { MessageResponse, PartData } from "@/types/message";

const STREAMING_HANDOFF_FALLBACK_MS = 8000;

/** A user message or a group of consecutive assistant messages. */
type MessageGroup =
  | { kind: "user"; message: MessageResponse }
  | { kind: "assistant"; messages: MessageResponse[] };

/**
 * Group consecutive assistant messages into a single visual block.
 *
 * The backend creates a separate assistant message for each agent step,
 * but the user expects to see a single response per prompt.
 */
function groupMessages(messages: MessageResponse[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let assistantBatch: MessageResponse[] = [];

  const isStandaloneAssistantMessage = (msg: MessageResponse) => {
    const data = msg.data as unknown as Record<string, unknown>;
    return data.role === "assistant" && (
      data.summary === true ||
      data.system === true ||
      msg.parts.some((part) => part.data.type === "compaction")
    );
  };

  const flushBatch = () => {
    if (assistantBatch.length > 0) {
      groups.push({ kind: "assistant", messages: assistantBatch });
      assistantBatch = [];
    }
  };

  for (const msg of messages) {
    if (msg.data.role === "assistant") {
      if (isStandaloneAssistantMessage(msg)) {
        flushBatch();
        groups.push({ kind: "assistant", messages: [msg] });
        continue;
      }
      assistantBatch.push(msg);
    } else if (
      msg.data.role === "user" &&
      (msg.data as unknown as Record<string, unknown>).system
    ) {
      // System-injected user messages (continuations, nudges) are invisible
      // and must NOT break the assistant message grouping.
      continue;
    } else {
      flushBatch();
      groups.push({ kind: "user", message: msg });
    }
  }
  flushBatch();

  return groups;
}

function groupHasRenderableContent(group: MessageGroup | undefined): boolean {
  if (!group || group.kind !== "assistant") return false;
  return group.messages.some((message) =>
    message.parts.some((part) => {
      const type = part.data.type;
      return type !== "compaction" &&
        type !== "reasoning" &&
        type !== "step-start" &&
        type !== "step-finish";
    }),
  );
}

function latestUserGroupIndex(groups: MessageGroup[]): number {
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i].kind === "user") return i;
  }
  return -1;
}

function isRenderableUserMessage(message: MessageResponse): boolean {
  return (
    message.data.role === "user" &&
    !(message.data as unknown as Record<string, unknown>).system
  );
}

/**
 * Optimistic user bubble shown before the API confirms a sent message.
 * Rendered both during first-load (static) and in the live list (animated),
 * so it lives in one place to avoid the two copies drifting apart.
 */
function PendingUserBubble({
  text,
  attachments,
  animated = false,
  className,
}: {
  text: string;
  attachments?: FileAttachment[] | null;
  animated?: boolean;
  className?: string;
}) {
  const bubble = (
    <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl bg-[var(--user-bubble-bg)] px-4 py-2.5 shadow-[var(--shadow-sm)] border border-[var(--border-default)]">
      <div className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </div>
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((att) => (
            <FileChip key={att.file_id} file={att} />
          ))}
        </div>
      )}
    </div>
  );

  // The real UserMessage always reserves an action-bar row (copy/edit) below
  // the bubble — see user-message.tsx. The optimistic bubble must reserve the
  // SAME height (mt-1 + h-7 = 32px) or the optimistic→persisted swap suddenly
  // adds that row and shoves the assistant "思考中" line down a notch.
  const content = (
    <>
      {bubble}
      <div className="mt-1 h-7" aria-hidden="true" />
    </>
  );

  return (
    <div className={className}>
      <div className="mx-auto max-w-3xl xl:max-w-4xl">
        {animated ? (
          <motion.div
            className="flex flex-col items-end"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 },
            }}
          >
            {content}
          </motion.div>
        ) : (
          <div className="flex flex-col items-end">{content}</div>
        )}
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: MessageResponse[];
  isLoading: boolean;
  isGenerating: boolean;
  /** Stream ID — only set after the backend confirms the generation. */
  streamId: string | null;
  /** Optimistic user message text shown before the API confirms. */
  pendingUserText: string | null;
  /** Attachments for the optimistic user bubble. */
  pendingAttachments?: FileAttachment[] | null;
  streamingParts: PartData[];
  streamingText: string;
  streamingReasoning: string;
  /** Callback to edit a user message and re-generate from that point. */
  onEditAndResend?: (messageId: string, newText: string, attachments?: FileAttachment[]) => Promise<boolean>;
  /** Workspace directory for @mention in edit mode. */
  directory?: string | null;
  /** Session ID for @mention file ingestion. */
  sessionId?: string;
  /** Whether there are older messages to load. */
  hasPreviousPage?: boolean;
  /** Whether older messages are currently being fetched. */
  isFetchingPreviousPage?: boolean;
  /** Fetch the next batch of older messages. */
  fetchPreviousPage?: () => void;
}

export function MessageList({
  messages,
  isLoading,
  isGenerating,
  streamId,
  pendingUserText,
  pendingAttachments,
  streamingParts,
  streamingText,
  streamingReasoning,
  onEditAndResend,
  directory,
  sessionId,
  hasPreviousPage,
  isFetchingPreviousPage,
  fetchPreviousPage,
}: MessageListProps) {
  const { scrollRef, scrollElementRef, bottomRef, isAtBottom, scrollToBottom } = useScrollAnchor();
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [canFetchOlderMessages, setCanFetchOlderMessages] = useState(false);
  const anchoredSessionRef = useRef<string | undefined>(undefined);

  // Keep StreamingMessage visible briefly after generation finishes so the
  // DB-fetched AssistantMessageGroup has time to render. Without this,
  // there's a 1-frame blank flash between StreamingMessage unmounting and
  // the DB messages mounting.
  const wasGeneratingRef = useRef(false);
  const prevMessageCountRef = useRef(messages?.length ?? 0);
  const [showStreamingFallback, setShowStreamingFallback] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      if (!wasGeneratingRef.current) {
        wasGeneratingRef.current = true;
        prevMessageCountRef.current = messages?.length ?? 0;
      }
      setShowStreamingFallback(false);
    } else if (wasGeneratingRef.current) {
      wasGeneratingRef.current = false;
      setShowStreamingFallback(true);
      const timer = setTimeout(
        () => setShowStreamingFallback(false),
        STREAMING_HANDOFF_FALLBACK_MS,
      );
      return () => clearTimeout(timer);
    }
  }, [isGenerating, messages.length]);

  useEffect(() => {
    if (anchoredSessionRef.current === sessionId) return;
    anchoredSessionRef.current = sessionId;
    setCanFetchOlderMessages(false);
    streamedHandoffIdsRef.current = new Set();
    lastVisibleStreamingRef.current = null;
    lastPendingUserRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (canFetchOlderMessages || isLoading || messages.length === 0) return;
    if (sessionId && messages.some((message) => message.session_id !== sessionId)) return;

    const frame = requestAnimationFrame(() => {
      const container = scrollElementRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
      setCanFetchOlderMessages(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [canFetchOlderMessages, isLoading, messages, scrollElementRef, sessionId]);

  // Reverse infinite scroll: observe top sentinel to load older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollElementRef.current;
    if (!sentinel || !container || !canFetchOlderMessages || !hasPreviousPage || isFetchingPreviousPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasPreviousPage && !isFetchingPreviousPage) {
          // Save scroll height before prepending for scroll position restoration
          const prevHeight = container.scrollHeight;
          fetchPreviousPage?.();
          // After DOM updates, restore scroll position
          requestAnimationFrame(() => {
            const newHeight = container.scrollHeight;
            container.scrollTop += newHeight - prevHeight;
          });
        }
      },
      { root: container, rootMargin: "200px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canFetchOlderMessages, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage, scrollElementRef]);

  // Track known message IDs to distinguish historical vs new messages.
  // Messages present on first render (or first data load) are "old" — skip animation.
  // Messages that appear later are "new" — animate in.
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const lastVisibleStreamingRef = useRef<{
    parts: PartData[];
    streamingText: string;
    streamingReasoning: string;
  } | null>(null);
  const lastPendingUserRef = useRef<{
    text: string;
    attachments?: FileAttachment[] | null;
  } | null>(null);

  // Message IDs whose content was already shown live by the StreamingMessage.
  // When the stream ends, the persisted DB bubble replaces the live one in the
  // same commit. Without this, the persisted bubble counts as "new" and fades
  // in from opacity 0 — so the content jumps from the stream's opacity-1 down
  // to 0 and fades back, reading as the message blinking out and flashing back.
  // Recording these IDs lets us suppress that entry animation on handoff.
  const streamedHandoffIdsRef = useRef<Set<string>>(new Set());

  // On first non-loading render with messages, seed the known IDs set
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      knownIdsRef.current = new Set(messages.map((m) => m.id));
    }
  }, [isLoading, messages]);

  // Build a set of "new" message IDs (messages not in the initial set)
  const newMessageIds = useMemo(() => {
    if (!initialLoadDoneRef.current) return new Set<string>();
    const newIds = new Set<string>();
    for (const msg of messages) {
      if (!knownIdsRef.current.has(msg.id)) {
        newIds.add(msg.id);
        knownIdsRef.current.add(msg.id);
      }
    }
    return newIds;
  }, [messages]);

  // Reset unread count when user scrolls to bottom
  useEffect(() => {
    if (isAtBottom) setUnreadCount(0);
  }, [isAtBottom]);

  // Increment unread count when new messages arrive while scrolled up
  const prevMsgLenRef = useRef(messages.length);
  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    prevMsgLenRef.current = messages.length;
    if (messages.length > prevLen && !isAtBottom) {
      setUnreadCount((c) => c + (messages.length - prevLen));
    }
  }, [messages.length, isAtBottom]);

  // Group consecutive assistant messages so multi-step responses render as one block
  // Regroup whenever message content changes. Parts can be appended to existing
  // message IDs during/after generation, so depending only on length/last-id can
  // leave stale groups that miss the final assistant text until a full refresh.
  const groups = useMemo(
    () => groupMessages(messages),
    [messages]
  );

  const latestUserIndex = latestUserGroupIndex(groups);
  const lastGroup = groups[groups.length - 1];
  const lastAssistantGroupBelongsToLatestTurn =
    latestUserIndex >= 0 &&
    lastGroup?.kind === "assistant" &&
    groups.length - 1 > latestUserIndex;
  const currentAssistantGroupHasRenderableContent =
    lastAssistantGroupBelongsToLatestTurn &&
    messages.length > prevMessageCountRef.current &&
    groupHasRenderableContent(lastGroup);

  const latestUserGroup = latestUserIndex >= 0 ? groups[latestUserIndex] : undefined;

  useEffect(() => {
    if (showStreamingFallback && currentAssistantGroupHasRenderableContent) {
      setShowStreamingFallback(false);
    }
  }, [currentAssistantGroupHasRenderableContent, showStreamingFallback]);

  // The shell message only exists after the backend created it (streamId is set).
  // During beginSending (streamId is null), we must NOT hide the previous response.
  const hasActiveStream = !!streamId;
  // Only hide the persisted DB group while the live StreamingMessage actually
  // has visible content to replace it with. Without this guard, the DB group
  // is hidden even after the streaming buffers have been cleared, leaving a
  // blank gap (content disappears) until the fallback window ends and the DB
  // group finally renders (content reappears) — the "blink out then flash
  // back" seen at stream end, most visible for plain-text replies.
  const hasVisibleStreamingReplacement = useMemo(() => {
    if (streamingText.trim() || streamingReasoning.trim()) return true;
    return streamingParts.some(
      (part) => part.type !== "step-start" && part.type !== "step-finish",
    );
  }, [streamingParts, streamingReasoning, streamingText]);

  if (pendingUserText) {
    lastPendingUserRef.current = {
      text: pendingUserText,
      attachments: pendingAttachments,
    };
  } else if (
    latestUserGroup &&
    latestUserGroup.kind === "user" &&
    newMessageIds.has(latestUserGroup.message.id) &&
    messages.length > prevMessageCountRef.current
  ) {
    const text = extractTextFromPartResponses(latestUserGroup.message.parts);
    if (text.trim()) {
      lastPendingUserRef.current = {
        text,
        attachments: null,
      };
    }
  }

  useEffect(() => {
    if (isGenerating && !hasVisibleStreamingReplacement) {
      lastVisibleStreamingRef.current = null;
      return;
    }
    if (!hasVisibleStreamingReplacement) return;
    lastVisibleStreamingRef.current = {
      parts: streamingParts,
      streamingText,
      streamingReasoning,
    };
  }, [hasVisibleStreamingReplacement, isGenerating, streamingParts, streamingReasoning, streamingText]);

  // Don't show the optimistic user bubble if the DB-fetched messages already
  // contain a matching user message. This prevents duplicates after navigating
  // from /c/new to /c/{sessionId} (where useMessages fetches the persisted
  // user message while pendingUserText is still set in the global store).
  const showPendingBubble = useMemo(() => {
    if (!pendingUserText) return false;
    if (messages.length === 0) return true;
    const hasPendingInDb = messages.some((m) => {
      if (!isRenderableUserMessage(m)) return false;
      const fullText = extractTextFromPartResponses(m.parts);
      return fullText.includes(pendingUserText);
    });
    return !hasPendingInDb;
  }, [pendingUserText, messages]);

  const cachedPendingUserInDb = useMemo(() => {
    const cached = lastPendingUserRef.current;
    if (!cached) return true;
    return messages.some((m) => {
      if (!isRenderableUserMessage(m)) return false;
      const fullText = extractTextFromPartResponses(m.parts);
      return fullText.includes(cached.text);
    });
  }, [messages]);

  const showCachedPendingBubble =
    !showPendingBubble &&
    (isGenerating ||
      showStreamingFallback ||
      (messages.length > prevMessageCountRef.current && lastAssistantGroupBelongsToLatestTurn)) &&
    !!lastPendingUserRef.current &&
    !cachedPendingUserInDb;

  // Only show the loading state on the very first load (no cached/placeholder data).
  // When switching sessions with keepPreviousData, messages.length > 0 so we
  // skip the skeleton and render the (placeholder) messages for a seamless transition.
  const isFirstLoad = isLoading && messages.length === 0;

  if (isFirstLoad) {
    // When generating, skip skeletons and show the streaming message directly
    // to avoid a jarring skeleton → content transition during page navigation
    if (isGenerating || !!streamId) {
      return (
        <div
          ref={scrollRef}
          data-testid="message-list-scroller"
          className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-auto"
        >
          {/* Show optimistic user bubble during loading so it doesn't flash
              away between navigation and message fetch completion */}
          {pendingUserText && (
            <PendingUserBubble
              text={pendingUserText}
              attachments={pendingAttachments}
              className="px-4 py-3"
            />
          )}
          <div className="px-4 py-5">
            <div className="mx-auto max-w-3xl xl:max-w-4xl">
              <StreamingMessage
                sessionId={sessionId ?? null}
                parts={streamingParts}
                streamingText={streamingText}
                streamingReasoning={streamingReasoning}
              />
            </div>
          </div>
          <div ref={bottomRef} className="h-px" />
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className="mx-auto max-w-3xl xl:max-w-4xl space-y-6 animate-fade-in"
          style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
        >
          {/* User message skeleton — right aligned */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-48 rounded-2xl" />
          </div>
          {/* Assistant message skeleton — left aligned */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          {/* Second pair */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-64 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // The last assistant group is the live response while a stream is active for
  // this session (streamId set) or during the brief post-finish fallback. Its
  // content is shown by StreamingMessage throughout, so when the stream ends
  // and the persisted DB bubble takes over, that bubble must NOT animate in —
  // a fade would read as the just-finished response blinking out and flashing
  // back. Record its IDs here (the moment it becomes the last group under an
  // active stream, regardless of whether streaming content is "visible" yet)
  // so the swap to the persisted bubble is always seamless. Skipped while
  // showPendingBubble is true — then the last assistant group is a PREVIOUS
  // turn that should stay untouched.
  const lastGroupForCover = groups[groups.length - 1];
  if (
    (hasActiveStream || showStreamingFallback) &&
    !showPendingBubble &&
    messages.length > prevMessageCountRef.current &&
    lastAssistantGroupBelongsToLatestTurn &&
    lastGroupForCover?.kind === "assistant"
  ) {
    for (const m of lastGroupForCover.messages) {
      streamedHandoffIdsRef.current.add(m.id);
    }
  }

  // The most-recent user message must not animate in either: on send it hands
  // off from the optimistic bubble (which already played the send animation),
  // and otherwise it's known history. Keying off "latest user message" instead
  // of pendingUserText avoids the same fast-turn race the assistant fix hit —
  // the persisted copy can land AFTER pendingUserText is cleared.
  let lastUserMessageId: string | null = null;
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].kind === "user") {
      lastUserMessageId = (groups[i] as { kind: "user"; message: MessageResponse }).message.id;
      break;
    }
  }

  // The bottom StreamingMessage and the persisted DB group must be strictly
  // dual: exactly one of them covers the current turn at any time. Without
  // this, the post-finish fallback window can show BOTH at once — the DB group
  // re-appears (its ActivitySummary) the instant the streaming buffers empty,
  // while StreamingMessage keeps rendering and degrades into a bare
  // StreamingStage placeholder — two "in progress" indicators stacked.
  const streamingStillVisible =
    hasVisibleStreamingReplacement || !!lastVisibleStreamingRef.current;
  const dbProducedThisTurn =
    messages.length > prevMessageCountRef.current &&
    lastAssistantGroupBelongsToLatestTurn;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        data-testid="message-list-scroller"
        className="h-full overflow-y-auto overscroll-contain scrollbar-auto"
      >
        {/* Top sentinel for reverse infinite scroll */}
        <div ref={topSentinelRef} className="h-px" />
        {isFetchingPreviousPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
          </div>
        )}

        {messages.length === 0 && !isGenerating ? (
          <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
            No messages yet
          </div>
        ) : (
          <>
            {groups.map((group) => {
              if (group.kind === "user") {
                return (
                  <MessageItem
                    key={group.message.id}
                    message={group.message}
                    isNew={newMessageIds.has(group.message.id) && group.message.id !== lastUserMessageId}
                    onEditAndResend={onEditAndResend}
                    isGenerating={isGenerating}
                    directory={directory}
                    sessionId={sessionId}
                  />
                );
              }

              // Assistant group — hide the entire last group during active
              // streaming ONLY if it belongs to the current generation.
              // ``streamingParts`` in the chat-store accumulates every part
              // seen during the turn (from ``beginSending`` through
              // ``finishGeneration``), so the StreamingMessage below already
              // renders the earlier persisted step-messages' content. Showing
              // both here causes duplicate blocks with duplicate Sources
              // footers and an overlapping tool-call timeline.
              //
              // If ``showPendingBubble`` is true, the user just sent a new
              // message that isn't yet in the DB cache — meaning the last
              // assistant group is from a PREVIOUS turn. Don't hide it or the
              // previous AI response disappears when a follow-up is sent.
              const lastMsg = group.messages[group.messages.length - 1];
              const isLastOverall =
                messages.length > 0 && lastMsg.id === messages[messages.length - 1].id;

              // Assistant content always streams in live (via StreamingMessage)
              // before it persists, so the persisted bubble must NOT also fade
              // in — that double-appearance is the "blink out then flash back"
              // seen at stream end. The last assistant group is always either
              // the just-streamed response or known history, so it never
              // animates. (The final reply can finalize as a fresh message id
              // AFTER the stream ends — e.g. tool-call turns — so keying off the
              // streamed id alone misses it; the isLastOverall guard catches
              // every timing.) streamedHandoffIdsRef additionally covers a
              // streamed reply that a later message, like a post-compaction
              // summary, pushed out of last place.
              const groupIsNew =
                !isLastOverall &&
                group.messages.some((m) => newMessageIds.has(m.id)) &&
                !group.messages.some((m) => streamedHandoffIdsRef.current.has(m.id));

              if (
                (hasActiveStream || showStreamingFallback) &&
                (hasVisibleStreamingReplacement || lastVisibleStreamingRef.current) &&
                messages.length > prevMessageCountRef.current &&
                lastAssistantGroupBelongsToLatestTurn &&
                isLastOverall &&
                !showPendingBubble
              ) {
                return showCachedPendingBubble && lastPendingUserRef.current ? (
                  <PendingUserBubble
                    key="cached-pending-user"
                    text={lastPendingUserRef.current.text}
                    attachments={lastPendingUserRef.current.attachments}
                    className="px-4 py-3"
                  />
                ) : null;
              }

              const cachedPendingBeforeCurrentAssistant =
                showCachedPendingBubble &&
                lastPendingUserRef.current &&
                lastAssistantGroupBelongsToLatestTurn &&
                isLastOverall;

              return (
                <div key={group.messages[0].id}>
                  {cachedPendingBeforeCurrentAssistant && (
                    <PendingUserBubble
                      text={lastPendingUserRef.current.text}
                      attachments={lastPendingUserRef.current.attachments}
                      className="px-4 py-3"
                    />
                  )}
                  <AssistantMessageGroup
                    messages={group.messages}
                    isNew={groupIsNew}
                  />
                </div>
              );
            })}

            {/* Optimistic user message — shown instantly before API confirms.
                Hidden once the DB-fetched messages include the same text to
                avoid duplicates after page navigation. */}
            {showPendingBubble && (
              <PendingUserBubble
                text={pendingUserText ?? ""}
                attachments={pendingAttachments}
                animated
                className="px-4 py-3"
              />
            )}

            {showCachedPendingBubble &&
              !lastAssistantGroupBelongsToLatestTurn &&
              lastPendingUserRef.current && (
              <PendingUserBubble
                text={lastPendingUserRef.current.text}
                attachments={lastPendingUserRef.current.attachments}
                className="px-4 py-3"
              />
            )}

            {/* Currently streaming message — kept visible briefly after
                generation finishes so DB messages can mount first. Only render
                while the stream still has visible content to show, OR before the
                DB has produced anything for this turn (the initial "Thinking"
                placeholder). Once the DB group has taken over and the buffers
                are empty, suppressing this prevents the degraded StreamingStage
                from stacking a second indicator next to the DB group. */}
            {(isGenerating || !!streamId || showStreamingFallback) &&
              (streamingStillVisible || !dbProducedThisTurn) && (
              <div className="px-4 py-5">
                <div className="mx-auto max-w-3xl xl:max-w-4xl">
                  <StreamingMessage
                    sessionId={sessionId ?? null}
                    parts={lastVisibleStreamingRef.current && !hasVisibleStreamingReplacement
                      ? lastVisibleStreamingRef.current.parts
                      : streamingParts}
                    streamingText={lastVisibleStreamingRef.current && !hasVisibleStreamingReplacement
                      ? lastVisibleStreamingRef.current.streamingText
                      : streamingText}
                    streamingReasoning={lastVisibleStreamingRef.current && !hasVisibleStreamingReplacement
                      ? lastVisibleStreamingRef.current.streamingReasoning
                      : streamingReasoning}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} className="h-px" />
      </div>

      {/* Scroll to bottom button — outside scroll container so it never affects scrollHeight */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => { scrollToBottom(); setUnreadCount(0); }}
            aria-label="Scroll to bottom"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-9 w-9 rounded-full border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-[var(--shadow-lg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors hover:[&_svg]:translate-y-0.5 [&_svg]:transition-transform [&_svg]:duration-150"
          >
            <ArrowDown className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-text)] text-[10px] font-semibold leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
