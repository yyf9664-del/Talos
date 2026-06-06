"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getAuthStatus, type AuthStatus } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation("settings");
  const [status, setStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        if (next.auth_enabled && !next.authenticated) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/c/new")}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(pathname || "/c/new")}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--surface-chat)] text-sm text-[var(--text-secondary)]">
        {t("authCheckingAccess")}
      </div>
    );
  }

  if (status.auth_enabled && !status.authenticated) {
    return null;
  }

  return <>{children}</>;
}
