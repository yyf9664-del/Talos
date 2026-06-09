"use client";

import { ArrowLeft, BookOpenText } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DailyReviewContent } from "./content";

export default function DailyReviewPage() {
  const { t } = useTranslation("daily-review");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" asChild>
            <Link href="/c/new">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <BookOpenText className="h-5 w-5 text-[var(--text-secondary)]" />
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <DailyReviewContent />
      </div>
    </div>
  );
}
