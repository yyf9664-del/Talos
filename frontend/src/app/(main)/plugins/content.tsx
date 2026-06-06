"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Puzzle,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import {
  usePluginsStatus,
  usePluginDetail,
  usePluginToggle,
} from "@/hooks/use-plugins";
import { useConnectors } from "@/hooks/use-connectors";
import type { PluginInfo } from "@/types/plugins";

const SOURCE_COLORS: Record<string, string> = {
  builtin: "bg-blue-500/10 text-blue-500",
  global: "bg-amber-500/10 text-amber-500",
  project: "bg-emerald-500/10 text-emerald-500",
  plugin: "bg-purple-500/10 text-purple-500",
  bundled: "bg-blue-500/10 text-blue-500",
  custom: "bg-orange-500/10 text-orange-500",
};

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-emerald-500",
  needs_auth: "bg-amber-500",
  failed: "bg-red-500",
  disconnected: "bg-[var(--text-tertiary)]",
  disabled: "bg-[var(--text-tertiary)]",
};

const SOURCE_ORDER = ["builtin", "global", "project"];

/* ------------------------------------------------------------------ */
/* Tab content (embedded in Settings)                                  */
/* ------------------------------------------------------------------ */

export function PluginsTabContent() {
  const { t } = useTranslation("plugins");
  const { data, isLoading } = usePluginsStatus();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const entries = useMemo(
    () => Object.entries(data?.plugins ?? {}),
    [data],
  );

  // Source groups that actually have plugins, in canonical order.
  const sources = useMemo(
    () => SOURCE_ORDER.filter((s) => entries.some(([, p]) => p.source === s)),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(([name, p]) => {
      if (sourceFilter !== "all" && p.source !== sourceFilter) return false;
      if (q) {
        return (
          name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, search, sourceFilter]);

  return (
    <div className="space-y-5">
      {/* Description */}
      <p className="text-xs text-[var(--text-tertiary)] -mt-1">
        {t("pluginsDescription")}
      </p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("pluginsSearchPlaceholder")}
          className="w-full h-10 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)]"
        />
      </div>

      {/* Source filter chips */}
      {sources.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", ...sources].map((src) => {
            const active = sourceFilter === src;
            return (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1 rounded-full text-ui-2xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--brand-primary)] text-[var(--brand-primary-text)]"
                    : "bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-tertiary)]"
                }`}
              >
                {src === "all" ? t("filterAll") : t(src, src)}
              </button>
            );
          })}
        </div>
      )}

      {/* Card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-[var(--surface-tertiary)] animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)] text-center py-12">
          {t("noPlugins")}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {filtered.map(([name, plugin]) => (
            <PluginCard
              key={name}
              name={name}
              plugin={plugin}
              expanded={expanded === name}
              onToggleExpand={() => setExpanded(expanded === name ? null : name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plugin Card + Detail                                                */
/* ------------------------------------------------------------------ */

function PluginCard({
  name,
  plugin,
  expanded,
  onToggleExpand,
}: {
  name: string;
  plugin: PluginInfo;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation("plugins");
  const toggle = usePluginToggle();

  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 transition-colors hover:border-[var(--border-heavy)]">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-secondary)]">
          <Puzzle className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {name}
            </span>
            <span className="text-ui-3xs text-[var(--text-tertiary)] shrink-0">
              {t("version", { version: plugin.version })}
            </span>
          </div>
          <p className="text-ui-2xs text-[var(--text-tertiary)] line-clamp-2 mt-0.5">
            {plugin.description}
          </p>
        </div>
        <Switch
          checked={plugin.enabled}
          onCheckedChange={(checked) => toggle.mutate({ name, enable: checked })}
          disabled={toggle.isPending}
          className="shrink-0"
        />
      </div>

      {/* Footer: tags + counts */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-ui-3xs px-1.5 py-0.5 rounded-full ${
              SOURCE_COLORS[plugin.source] ?? SOURCE_COLORS.builtin
            }`}
          >
            {t(plugin.source)}
          </span>
          <span className="inline-flex items-center gap-1 text-ui-3xs text-[var(--text-tertiary)]">
            <Sparkles className="h-3 w-3" />
            {plugin.skills_count}
          </span>
          {plugin.mcp_count > 0 && (
            <span className="inline-flex items-center gap-1 text-ui-3xs text-[var(--text-tertiary)]">
              <Workflow className="h-3 w-3" />
              {plugin.mcp_count}
            </span>
          )}
        </div>

        <button
          onClick={onToggleExpand}
          className="inline-flex items-center gap-0.5 text-ui-3xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
        >
          {t("details")}
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </div>

      {expanded && <PluginDetailPanel name={name} />}
    </div>
  );
}

function PluginDetailPanel({ name }: { name: string }) {
  const { t } = useTranslation("plugins");
  const { data, isLoading } = usePluginDetail(name);
  const { data: connectorsData } = useConnectors();

  const connectors = connectorsData?.connectors ?? {};

  if (isLoading) {
    return (
      <div className="mt-3 border-t border-[var(--border-default)] pt-3">
        <div className="h-8 rounded bg-[var(--surface-tertiary)] animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const connectorIds = data.connector_ids ?? [];

  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3">
      {/* Skills */}
      {data.skills.length > 0 && (
        <div className="mb-3">
          <h4 className="text-ui-2xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {t("skills")} ({data.skills.length})
          </h4>
          <div className="space-y-1">
            {data.skills.map((skill) => (
              <div key={skill.name} className="flex gap-2">
                <span className="text-xs font-mono text-[var(--text-primary)] shrink-0">
                  {skill.name}
                </span>
                <span className="text-ui-2xs text-[var(--text-tertiary)] truncate">
                  {skill.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required connectors */}
      {connectorIds.length > 0 && (
        <div>
          <h4 className="text-ui-2xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            {t("requiredConnectors")} ({connectorIds.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {connectorIds.map((cid) => {
              const connector = connectors[cid];
              const statusColor = connector
                ? STATUS_COLORS[connector.status] ?? STATUS_COLORS.disconnected
                : STATUS_COLORS.disconnected;

              return (
                <span
                  key={cid}
                  className="inline-flex items-center gap-1.5 text-ui-2xs text-[var(--text-primary)] rounded border border-[var(--border-default)] bg-[var(--surface-secondary)] px-2 py-1"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
                  {connector?.name ?? cid}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
