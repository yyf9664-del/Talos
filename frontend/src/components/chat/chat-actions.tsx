"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ChatActionsProps {
  isBusy: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}

export function ChatActions({ isBusy, canSend, onSend, onStop }: ChatActionsProps) {
  const { t } = useTranslation("chat");
  const interactive = isBusy || canSend;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-7 w-7 rounded-full bg-[var(--text-primary)] text-[var(--surface-primary)] hover:bg-[var(--text-primary)]/90 disabled:bg-[var(--text-tertiary)]/30 disabled:text-[var(--surface-primary)] disabled:opacity-100"
              onClick={isBusy ? onStop : onSend}
              disabled={!interactive}
              aria-label={isBusy ? t("stopAction") : t("sendAction")}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isBusy ? "stop" : "send"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center"
                >
                  {isBusy ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </motion.span>
              </AnimatePresence>
              <span className="sr-only">
                {isBusy ? t("stopAction") : t("sendAction")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isBusy ? t("stopAction") : t("sendActionHint")}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
