"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TalosLogo } from "@/components/ui/talos-logo";
import { getAuthStatus, keyLogin } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/c/new";
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus().then((status) => {
      if (!cancelled && (!status.auth_enabled || status.authenticated)) {
        router.replace(next);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await keyLogin(key);
      setAuthenticated(true);
      window.setTimeout(() => {
        router.replace(next);
      }, 950);
    } catch (err) {
      setError(apiErrorMessage(err, "Login failed. Check your key and try again."));
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#F7F4EF] px-4 py-8 text-[#2B2620]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(201,100,66,0.10),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(224,121,90,0.08),transparent_32%),linear-gradient(180deg,#FBF9F5_0%,#F7F4EF_52%,#F0EBE2_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-3xl" />

      <section className="relative grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden space-y-8 lg:block">
          <div className="max-w-xl space-y-4">
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.045em] text-[#2B2620]">
              你的智能投放工作台
            </h1>
            <p className="max-w-lg text-[15px] leading-7 text-[#6B6258]">
              Talos 连接 TradeDesk 系统，用 AI 帮你完成广告投放、素材管理、数据分析与日常办公。
            </p>
          </div>

          <div className="grid max-w-lg gap-3 text-sm text-[#6B6258]">
            {[
              "对接 TradeDesk，安全调用公司投放数据",
              "本地处理文件与业务资料，数据不出本机",
              "工具与文件权限，始终由你掌控",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/58 px-4 py-3 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.38)] backdrop-blur"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="mx-auto w-full max-w-[420px] rounded-[28px] border border-white/75 bg-white/86 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55),0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-xl sm:p-7"
        >
          <div className="mb-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E6DECF] bg-white shadow-sm">
                <TalosLogo size={30} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-[-0.02em] text-[#2B2620]">
                  Talos
                </p>
                <p className="text-[11px] text-[#978C7C]">
                  智能投放工作台
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-[24px] font-semibold tracking-[-0.035em] text-[#2B2620]">
                欢迎使用 Talos
              </h2>
              <p className="text-sm leading-6 text-[#6B6258]">
                输入 TradeDesk 系统 API Key，连接后即可开始工作。
              </p>
            </div>
          </div>

          <label className="block space-y-2.5">
            <span className="text-xs font-semibold tracking-[0.04em] text-[#6B6258]">
              TradeDesk 系统 API Key
            </span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#978C7C]" />
              <Input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                type={showKey ? "text" : "password"}
                autoFocus
                autoComplete="one-time-code"
                placeholder="sk-..."
                className={`h-11 rounded-xl bg-white pl-9 pr-10 font-mono text-sm shadow-[0_1px_2px_rgba(60,45,28,0.05)] transition-all focus-visible:ring-[3px] ${
                  error
                    ? "border-[var(--color-destructive)]/55 focus-visible:ring-[rgba(239,68,68,0.15)]"
                    : "border-[#E6DECF] focus-visible:ring-[rgba(201,100,66,0.16)]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#978C7C] transition-colors hover:text-[#6B6258]"
                aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="mt-4 rounded-xl border border-[var(--color-destructive)]/25 bg-[var(--color-destructive)]/8 px-3 py-2.5 text-sm leading-5 text-[var(--color-destructive)]">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="mt-5 h-11 w-full rounded-xl bg-[#C96442] text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(181,87,58,0.75)] transition-all hover:bg-[#B5573A] hover:shadow-[0_16px_32px_-18px_rgba(181,87,58,0.85)]"
            disabled={loading || authenticated || !key.trim()}
          >
            <KeyRound className="h-4 w-4" />
            {authenticated ? "即将进入..." : loading ? "验证中..." : "进入工作台"}
          </Button>

          <p className="mt-4 text-center text-[11px] leading-5 text-[#978C7C]">
            API Key 由 TradeDesk 系统验证，仅用于本机登录会话，不会上传或保存到其他位置。
          </p>
        </form>
      </section>

      {authenticated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#F9F5F0]"
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(201,100,66,0.26),transparent_26%),radial-gradient(circle_at_34%_58%,rgba(224,121,90,0.18),transparent_24%),linear-gradient(180deg,#FBF9F5_0%,#F7F4EF_58%,#F0EBE2_100%)]"
            animate={{ scale: [1, 1.04], opacity: [0.95, 1] }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="absolute h-[520px] w-[520px] rounded-full border border-white/70 bg-white/35 shadow-[0_0_120px_rgba(201,100,66,0.18)] backdrop-blur-3xl"
            initial={{ scale: 0.76, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: 8 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="absolute h-[680px] w-[680px] rounded-full border border-[rgba(201,100,66,0.18)]"
            initial={{ scale: 0.82, opacity: 0 }}
            animate={{ scale: 1.18, opacity: [0, 1, 0] }}
            transition={{ duration: 1.05, ease: "easeOut" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0.72, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/80 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur"
            >
              <TalosLogo size={46} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.36 }}
              className="space-y-2"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-[#C96442] shadow-sm backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                验证通过
              </div>
              <h2 className="text-[42px] font-semibold tracking-[-0.055em] text-[#2B2620]">
                正在进入 Talos
              </h2>
              <p className="text-sm text-[#6B6258]">
                正在连接你的工作台
              </p>
            </motion.div>

            <div className="mt-8 h-1.5 w-64 overflow-hidden rounded-full bg-white/70 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#C96442,#E0795A)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.82, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </main>
  );
}
