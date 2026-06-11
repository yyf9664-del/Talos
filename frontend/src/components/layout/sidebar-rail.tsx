"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Boxes,
  PanelLeft,
  Plug,
  Settings,
  SquarePen,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OpenYakLogo } from "@/components/ui/openyak-logo";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMacOS } from "@/hooks/use-platform";
import { IS_DESKTOP } from "@/lib/constants";
import { cn } from "@/lib/utils";

const RAIL_ITEMS = [
  {
    href: "/c/new",
    labelKey: "newChat",
    icon: SquarePen,
    isActive: (p: string) => p === "/" || p === "/c/new",
  },
  {
    href: "/plugins",
    labelKey: "plugins",
    icon: Plug,
    isActive: (p: string) => p.startsWith("/plugins"),
  },
  {
    href: "/daily-review",
    labelKey: "dailyReview",
    icon: BookOpenText,
    isActive: (p: string) => p.startsWith("/daily-review"),
  },
  {
    href: "/automations",
    labelKey: "automations",
    icon: Bot,
    isActive: (p: string) => p.startsWith("/automations"),
  },
  {
    href: "/agents",
    labelKey: "agents",
    icon: Boxes,
    isActive: (p: string) => p.startsWith("/agents"),
  },
];

/**
 * Collapsed sidebar rail: an icon-only column that keeps the brand, primary
 * navigation and account entry reachable instead of hiding everything.
 */
export function SidebarRail() {
  const { t } = useTranslation("common");
  const pathname = usePathname() || "";
  const toggle = useSidebarStore((s) => s.toggle);
  const isMac = useIsMacOS();
  const macTopInset = IS_DESKTOP && isMac;

  const railButton = (active: boolean) =>
    cn(
      "h-9 w-9 rounded-lg",
      active
        ? "bg-[var(--sidebar-active)] text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]",
    );

  return (
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 pb-2">
      {/* macOS traffic-light clearance / drag region */}
      <div
        data-tauri-drag-region
        aria-hidden="true"
        className="w-full"
        style={{ height: macTopInset ? 36 : 8 }}
      />

      {/* Brand → click to expand */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-[var(--sidebar-hover)]"
            onClick={toggle}
            aria-label={t("toggleSidebar")}
          >
            <OpenYakLogo size={20} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("toggleSidebar")}</TooltipContent>
      </Tooltip>

      {/* Expand toggle (explicit) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
            onClick={toggle}
            aria-label={t("toggleSidebar")}
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("toggleSidebar")}</TooltipContent>
      </Tooltip>

      <div className="my-1 h-px w-6 bg-[var(--border-default)]" />

      {/* Primary navigation */}
      {RAIL_ITEMS.map(({ href, labelKey, icon: Icon, isActive }) => (
        <Tooltip key={href}>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={railButton(isActive(pathname))}
              aria-label={t(labelKey)}
            >
              <Link href={href}>
                <Icon className="h-[18px] w-[18px]" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{t(labelKey)}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      {/* Account / settings */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={railButton(pathname.startsWith("/settings"))}
            aria-label={t("settings")}
          >
            <Link href="/settings">
              <Settings className="h-[18px] w-[18px]" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("settings")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
