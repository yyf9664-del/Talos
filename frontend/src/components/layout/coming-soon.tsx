"use client";

import { Hammer } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Full-area "under development" placeholder shown for unfinished sections. */
export function ComingSoon() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[var(--surface-tertiary)]">
        <Hammer className="h-7 w-7 text-[var(--text-tertiary)]" />
      </div>
      <p className="mt-4 text-base font-medium text-[var(--text-secondary)]">
        {t("comingSoon")}
      </p>
      <p className="mt-1 text-sm text-[var(--text-tertiary)]">
        {t("comingSoonDesc")}
      </p>
    </div>
  );
}
