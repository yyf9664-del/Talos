"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarTop } from "./sidebar-top";
import { SidebarRail } from "./sidebar-rail";
import { SessionList } from "./session-list";
import { SidebarFooter } from "./sidebar-footer";
import { SearchCommandDialog } from "./search-command-dialog";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMacOS } from "@/hooks/use-platform";
import { IS_DESKTOP, TITLE_BAR_HEIGHT, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";

const SidebarNav = dynamic(
  () => import("./sidebar-nav").then((mod) => mod.SidebarNav),
  {
    ssr: false,
    loading: () => <div className="px-3 pt-1 pb-2" aria-hidden="true" />,
  },
);

export function Sidebar() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const width = useSidebarStore((s) => s.width);
  const activeTab = useSidebarStore((s) => s.activeTab);
  const setActiveTab = useSidebarStore((s) => s.setActiveTab);
  const isMac = useIsMacOS();

  // macOS: sidebar extends to the window top (traffic lights overlay the
  // sidebar header). Windows/Linux: sit below the 32px custom title bar.
  const topOffset = IS_DESKTOP && !isMac ? TITLE_BAR_HEIGHT : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <motion.aside
        aria-label="Chat sidebar"
        className="sidebar-glass fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden border-r border-[var(--border-default)] bg-[var(--surface-secondary)]"
        style={IS_DESKTOP ? { top: topOffset } : undefined}
        initial={false}
        animate={{ width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : width }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {isCollapsed ? (
          <SidebarRail />
        ) : (
          <>
            <SidebarTop activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === "chat" ? (
              <>
                <SidebarNav />
                <Suspense fallback={<div className="flex-1" />}>
                  <SessionList />
                </Suspense>
              </>
            ) : (
              <div className="flex-1" />
            )}
            <SidebarFooter />
            <SidebarResizeHandle />
          </>
        )}
      </motion.aside>
      <SearchCommandDialog />
    </TooltipProvider>
  );
}
