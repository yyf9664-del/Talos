"use client";

import { PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { TalosLogo } from "@/components/ui/talos-logo";
import { useSidebarStore, type SidebarTab } from "@/stores/sidebar-store";
import { useIsMacOS } from "@/hooks/use-platform";
import { IS_DESKTOP } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TABS: { key: SidebarTab; labelKey: string }[] = [
  { key: "chat", labelKey: "tabChat" },
  { key: "workflow", labelKey: "tabWorkflow" },
];

interface SidebarTopProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/**
 * Sidebar header: brand + sidebar toggle, then a segmented tab switcher.
 *
 * Replaces the old empty drag strip. Keeps a top inset on macOS so the
 * native traffic lights have room above the brand row.
 */
export function SidebarTop({ activeTab, onTabChange }: SidebarTopProps) {
  const { t } = useTranslation("common");
  const isMac = useIsMacOS();
  const toggle = useSidebarStore((s) => s.toggle);
  const macTopInset = IS_DESKTOP && isMac;

  return (
    <div className="shrink-0">
      {/* macOS traffic-light clearance / drag region */}
      <div
        data-tauri-drag-region
        aria-hidden="true"
        style={{ height: macTopInset ? 36 : 8 }}
      />

      {/* Brand row */}
      <div
        data-tauri-drag-region
        className="flex h-10 items-center gap-2 px-3"
      >
        <TalosLogo size={20} className="shrink-0" />
        <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
          Talos
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-hover)]"
          onClick={toggle}
          aria-label={t("toggleSidebar")}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Segmented tab switcher */}
      <div className="mx-3 mt-1 mb-2 flex items-center gap-1 rounded-full bg-[var(--surface-tertiary)] p-1">
        {TABS.map(({ key, labelKey }) => {
          const active = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={cn(
                "flex-1 h-7 rounded-full text-xs font-medium transition-colors",
                active
                  ? "bg-[var(--surface-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
