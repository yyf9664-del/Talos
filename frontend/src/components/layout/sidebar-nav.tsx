"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpenText, Bot, Boxes, Plug, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActiveSessionId } from "@/hooks/use-active-session-id";
import { useSessions } from "@/hooks/use-sessions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/c/new",
    labelKey: "newChat",
    icon: SquarePen,
    isActive: (pathname: string) => pathname === "/" || pathname === "/c/new",
  },
  {
    href: "/plugins",
    labelKey: "plugins",
    icon: Plug,
    isActive: (pathname: string) => pathname.startsWith("/plugins"),
  },
  {
    href: "/daily-review",
    labelKey: "dailyReview",
    icon: BookOpenText,
    isActive: (pathname: string) => pathname.startsWith("/daily-review"),
  },
  {
    href: "/automations",
    labelKey: "automations",
    icon: Bot,
    isActive: (pathname: string) => pathname.startsWith("/automations"),
  },
  {
    href: "/agents",
    labelKey: "agents",
    icon: Boxes,
    isActive: (pathname: string) => pathname.startsWith("/agents"),
  },
];

export function SidebarNav() {
  const { t } = useTranslation("common");
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const activeSessionId = useActiveSessionId();
  const { data: sessionPages } = useSessions();
  const activeSessionDirectory = useMemo(() => {
    if (!activeSessionId) return null;
    const activeSession = sessionPages?.pages
      .flat()
      .find((session) => session.id === activeSessionId);
    return activeSession?.directory && activeSession.directory !== "."
      ? activeSession.directory
      : null;
  }, [activeSessionId, sessionPages]);
  const currentNewChatDirectory = pathname === "/c/new" ? searchParams.get("directory") : null;
  const newChatDirectory = activeSessionDirectory ?? currentNewChatDirectory;
  const newChatHref = newChatDirectory
    ? `/c/new?directory=${encodeURIComponent(newChatDirectory)}`
    : "/c/new";

  return (
    <nav className="px-3 pb-2">
      <div className="space-y-0.5">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          const itemHref = href === "/c/new" ? newChatHref : href;
          return (
            <Link
              key={href}
              href={itemHref}
              className={cn(
                "group flex h-8 items-center gap-2 rounded-xl px-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--sidebar-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]",
                )}
              />
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
