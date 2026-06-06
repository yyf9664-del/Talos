"use client";

import { LogOut, Settings, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useUpdateCheck } from "@/hooks/use-update-check";
import { getAuthStatus, logout, type AuthUser } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function SidebarFooter() {
  const { t } = useTranslation(["common", "settings"]);
  const { available: updateAvailable, version: updateVersion } = useUpdateCheck();
  const [authEnabled, setAuthEnabled] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((status) => {
        if (cancelled) return;
        setAuthEnabled(status.auth_enabled);
        setUser(status.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  const displayName = user?.name || user?.username || user?.email || t("settings:accountDefaultName");
  const studioName = user?.studio_display;
  const accountLabel = studioName ? `${displayName} / ${studioName}` : displayName;

  if (!authEnabled) {
    return (
      <div className="border-t border-[var(--border-default)] px-3 py-2.5">
        <Link
          href="/settings"
          className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)]"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>{t("common:settings")}</span>
          {updateAvailable && (
            <span
              className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]"
              aria-label={t("settings:updateAvailable")}
              title={
                updateVersion
                  ? `${t("settings:updateAvailable")} · v${updateVersion}`
                  : t("settings:updateAvailable")
              }
            />
          )}
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border-default)] px-3 py-2.5">
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-primary)] ${
              menuOpen ? "bg-[var(--sidebar-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("common:settings")}</span>
            {updateAvailable && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]"
                aria-label={t("settings:updateAvailable")}
                title={
                  updateVersion
                    ? `${t("settings:updateAvailable")} · v${updateVersion}`
                    : t("settings:updateAvailable")
                }
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={8}
          className="w-[280px] rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-1 shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-5 text-[var(--text-primary)]">
            <UserCircle className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
            <span className="truncate">{accountLabel}</span>
          </div>
          <Separator className="-mx-0.5 my-0.5 bg-[var(--border-default)]" />
          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-5 text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
          >
            <Settings className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
            <span>{t("common:settings")}</span>
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-5 text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-secondary)]"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
            <span>{t("settings:accountLogout")}</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
