"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useSkills,
  useSkillToggle,
  useSkillStoreSearch,
  useInstallSkill,
} from "@/hooks/use-plugins";
import type { SkillInfo, StoreSkill } from "@/types/plugins";

const SOURCE_COLORS: Record<string, string> = {
  bundled: "bg-blue-500/10 text-blue-500",
  plugin: "bg-purple-500/10 text-purple-500",
  project: "bg-emerald-500/10 text-emerald-500",
};

/** A tab is either a skill source group ("bundled" | "plugin" | "project") or the store. */
const SOURCE_ORDER = ["bundled", "plugin", "project"] as const;
const SOURCE_LABEL_KEY: Record<string, string> = {
  bundled: "bundledSkills",
  plugin: "pluginSkills",
  project: "projectSkills",
};

export function SkillsContent() {
  const { t } = useTranslation("plugins");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("bundled");

  const { data: skills, isLoading } = useSkills();
  const allSkills = useMemo(() => skills ?? [], [skills]);

  const installedNames = useMemo(
    () => new Set(allSkills.map((s) => s.name.toLowerCase())),
    [allSkills],
  );

  // Source groups that actually have skills, in canonical order.
  const sources = useMemo(
    () => SOURCE_ORDER.filter((s) => allSkills.some((k) => k.source === s)),
    [allSkills],
  );

  // Tab list: each present source group, then the marketplace.
  const tabs = useMemo(() => [...sources, "store"], [sources]);

  // Keep the active tab valid once data loads.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] ?? "store");
  }, [tabs, tab]);

  const visibleSkills = useMemo(() => {
    if (tab === "store") return [];
    const q = search.trim().toLowerCase();
    return allSkills.filter(
      (s) =>
        s.source === tab &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)),
    );
  }, [allSkills, tab, search]);

  return (
    <div className="space-y-5">
      {/* Description */}
      <p className="text-xs text-[var(--text-tertiary)] -mt-1">
        {t("skillsDescription")}
      </p>

      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("skillsSearchPlaceholder")}
            className="w-full h-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
          />
        </div>
        <Button
          variant="outline"
          className="h-10 px-3.5 text-xs shrink-0"
          onClick={() => setTab("store")}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("add")}
        </Button>
      </div>

      {/* Tabs: 内置技能 / 插件技能 / (项目技能) / 技能市场 */}
      <div className="flex items-center gap-1 border-b border-[var(--border-default)]">
        {tabs.map((tabKey) => {
          const isStore = tabKey === "store";
          const count = isStore
            ? null
            : allSkills.filter((s) => s.source === tabKey).length;
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === tabKey
                  ? "border-[var(--brand-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {isStore ? t("storeTab") : t(SOURCE_LABEL_KEY[tabKey])}
              {!isStore && (
                <span
                  className={`text-ui-3xs px-1.5 py-0.5 rounded-full ${
                    tab === tabKey
                      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                      : "bg-[var(--surface-tertiary)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "store" ? (
        <StoreGrid search={search} installedNames={installedNames} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-[var(--surface-tertiary)] animate-pulse"
            />
          ))}
        </div>
      ) : visibleSkills.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-12">
          {t("noSkills")}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleSkills.map((skill) => (
            <InstalledSkillCard key={skill.name} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}

function InstalledSkillCard({ skill }: { skill: SkillInfo }) {
  const toggle = useSkillToggle();

  // Namespaced plugin skills ("plugin:foo") surface their plugin name as a tag.
  const namespace = skill.name.includes(":") ? skill.name.split(":")[0] : null;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 transition-colors hover:border-[var(--border-heavy)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
          <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
            {skill.name}
          </span>
          {namespace && (
            <span
              className={`text-ui-3xs px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                SOURCE_COLORS[skill.source] ?? SOURCE_COLORS.bundled
              }`}
            >
              {namespace}
            </span>
          )}
        </div>
        <Switch
          checked={skill.enabled}
          onCheckedChange={(checked) =>
            toggle.mutate({ name: skill.name, enable: checked })
          }
          disabled={toggle.isPending}
          className="shrink-0"
        />
      </div>

      <p
        className={`text-ui-2xs text-[var(--text-tertiary)] line-clamp-2 mt-2 ${
          !skill.enabled ? "opacity-60" : ""
        }`}
      >
        {skill.description}
      </p>
    </div>
  );
}

function StoreGrid({
  search,
  installedNames,
}: {
  search: string;
  installedNames: Set<string>;
}) {
  const { t } = useTranslation("plugins");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<"stars" | "recent">("stars");

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(h);
  }, [search]);

  const { data, isFetching, isError, refetch } = useSkillStoreSearch(
    debounced,
    sort,
    1,
    /* enabled */ true,
  );
  const install = useInstallSkill();

  const results = data?.data?.skills ?? [];
  const total = data?.data?.pagination?.total ?? 0;

  const handleInstall = async (skill: StoreSkill) => {
    try {
      await install.mutateAsync({ github_url: skill.githubUrl, name: skill.name });
      toast.success(
        t("storeInstalled", { name: skill.name, defaultValue: `Installed ${skill.name}` }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Install failed";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      {/* Sort */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-ui-3xs text-[var(--text-tertiary)]">
          {!isError && results.length > 0
            ? t("storeResultCount", {
                shown: results.length,
                total,
                defaultValue: `Showing ${results.length} of ${total}`,
              })
            : ""}
        </p>
        <div className="flex items-center rounded-md border border-[var(--border-default)] text-ui-2xs overflow-hidden">
          {(["stars", "recent"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1.5 transition-colors ${
                sort === s
                  ? "bg-[var(--surface-tertiary)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {s === "stars"
                ? t("storeSortStars", { defaultValue: "Top" })
                : t("storeSortRecent", { defaultValue: "Recent" })}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="text-xs text-[var(--text-tertiary)] text-center py-8 space-y-2">
          <p>{t("storeUnavailable", { defaultValue: "Skills store is unreachable." })}</p>
          <Button variant="outline" size="sm" className="h-7 text-ui-2xs" onClick={() => refetch()}>
            <RotateCw className="h-3 w-3 mr-1" />
            {t("retry", { defaultValue: "Retry" })}
          </Button>
        </div>
      ) : isFetching && results.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--surface-tertiary)] animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-12">
          {t("storeNoResults", { defaultValue: "No skills matched your search." })}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {results.map((skill) => (
            <StoreSkillCard
              key={skill.id}
              skill={skill}
              installed={installedNames.has(skill.name.toLowerCase())}
              installing={install.isPending && install.variables?.github_url === skill.githubUrl}
              onInstall={() => handleInstall(skill)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreSkillCard({
  skill,
  installed,
  installing,
  onInstall,
}: {
  skill: StoreSkill;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
}) {
  const { t } = useTranslation("plugins");
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 transition-colors hover:border-[var(--border-heavy)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
          <Sparkles className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-mono font-medium text-[var(--text-primary)] truncate block">
            {skill.name}
          </span>
          <span className="text-ui-3xs text-[var(--text-tertiary)] truncate block">
            by {skill.author}
          </span>
        </div>
        {installed ? (
          <span className="inline-flex items-center gap-1 text-ui-3xs text-[var(--text-tertiary)] px-2 py-1 shrink-0">
            <Check className="h-3 w-3" />
            {t("storeInstalledBadge", { defaultValue: "Installed" })}
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-ui-2xs px-2.5 shrink-0"
            disabled={installing}
            onClick={onInstall}
          >
            {installing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            <span className="ml-1">{t("storeInstall", { defaultValue: "Install" })}</span>
          </Button>
        )}
      </div>

      <p className="text-ui-2xs text-[var(--text-tertiary)] line-clamp-2 mt-2">
        {skill.description}
      </p>

      <div className="mt-3 flex items-center gap-3 text-ui-3xs text-[var(--text-tertiary)]">
        {skill.stars > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5" />
            {skill.stars}
          </span>
        )}
        <a
          href={skill.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 hover:text-[var(--text-secondary)]"
          title={t("storeViewOnGithub", { defaultValue: "View on GitHub" })}
        >
          <ExternalLink className="h-2.5 w-2.5" />
          GitHub
        </a>
      </div>
    </div>
  );
}
