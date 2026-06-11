"use client";

import { useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSavedAgents } from "@/hooks/use-saved-agents";
import { SavedAgentCard } from "@/components/saved-agents/saved-agent-card";
import { SavedAgentRunForm } from "@/components/saved-agents/saved-agent-run-form";
import type { SavedAgent } from "@/types/saved-agent";

export function SavedAgentsContent() {
  const { t } = useTranslation("saved-agents");
  const { data: agents, isLoading } = useSavedAgents();
  const [running, setRunning] = useState<SavedAgent | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  const items = agents ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Boxes className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
        <p className="text-sm text-[var(--text-primary)]">{t("empty")}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
          {t("emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((agent) => (
          <SavedAgentCard
            key={agent.id}
            agent={agent}
            onRun={setRunning}
          />
        ))}
      </div>

      {running && (
        <SavedAgentRunForm agent={running} onClose={() => setRunning(null)} />
      )}
    </>
  );
}
