"use client";

import { ArrowLeft, Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SavedAgentsContent } from "./content";

export default function AgentsPage() {
  const { t } = useTranslation("saved-agents");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" asChild>
            <Link href="/c/new"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Boxes className="h-5 w-5 text-[var(--text-secondary)]" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t("title")}</h1>
        </div>
        <SavedAgentsContent />
      </div>
    </div>
  );
}
