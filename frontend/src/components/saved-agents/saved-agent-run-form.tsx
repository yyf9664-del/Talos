"use client";

import { useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRunSavedAgent } from "@/hooks/use-saved-agents";
import { getChatRoute } from "@/lib/routes";
import { queryKeys } from "@/lib/constants";
import { useChatStore } from "@/stores/chat-store";
import { useSettingsStore } from "@/stores/settings-store";
import { startStream } from "@/lib/session-stream-registry";
import type { FormField, SavedAgent } from "@/types/saved-agent";

type FieldValue = string | number | boolean | string[] | undefined;

/** Initial form state derived from each field's default value (best-effort). */
function initialValues(fields: FormField[]): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of fields) {
    const def = f.default_value;
    switch (f.type) {
      case "boolean":
        out[f.id] = typeof def === "boolean" ? def : false;
        break;
      case "multiselect":
        out[f.id] = Array.isArray(def) ? (def as string[]) : [];
        break;
      case "number":
      case "integer":
        out[f.id] = typeof def === "number" ? def : "";
        break;
      default:
        out[f.id] = typeof def === "string" ? def : "";
    }
  }
  return out;
}

/** Whether a required field has a usable value. */
function hasValue(field: FormField, value: FieldValue): boolean {
  if (field.type === "boolean") return true; // a boolean always has a value
  if (field.type === "multiselect") return Array.isArray(value) && value.length > 0;
  if (field.type === "number" || field.type === "integer") {
    return value !== "" && value !== undefined && value !== null;
  }
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

const UNSUPPORTED_TYPES = new Set(["file", "files"]);

export function SavedAgentRunForm({
  agent,
  onClose,
}: {
  agent: SavedAgent;
  onClose: () => void;
}) {
  const { t } = useTranslation("saved-agents");
  const router = useRouter();
  const queryClient = useQueryClient();
  const runMut = useRunSavedAgent();
  const selectedModel = useSettingsStore((s) => s.selectedModel);
  const selectedProviderId = useSettingsStore((s) => s.selectedProviderId);

  const fields = useMemo(() => agent.form_schema || [], [agent.form_schema]);
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initialValues(agent.form_schema || []),
  );
  const [showErrors, setShowErrors] = useState(false);

  const missingRequired = useMemo(
    () =>
      fields.some(
        (f) =>
          f.required &&
          !UNSUPPORTED_TYPES.has(f.type) &&
          !hasValue(f, values[f.id]),
      ),
    [fields, values],
  );

  const setValue = (id: string, value: FieldValue) =>
    setValues((prev) => ({ ...prev, [id]: value }));

  const handleSubmit = () => {
    if (missingRequired) {
      setShowErrors(true);
      return;
    }

    const inputs: Record<string, unknown> = {};
    for (const f of fields) {
      if (UNSUPPORTED_TYPES.has(f.type)) continue;
      const raw = values[f.id];
      if (f.type === "number") {
        if (raw === "" || raw === undefined) continue;
        inputs[f.id] = Number(raw);
      } else if (f.type === "integer") {
        if (raw === "" || raw === undefined) continue;
        inputs[f.id] = Math.trunc(Number(raw));
      } else if (f.type === "boolean") {
        inputs[f.id] = Boolean(raw);
      } else if (f.type === "multiselect") {
        inputs[f.id] = Array.isArray(raw) ? raw : [];
      } else {
        if (raw === "" || raw === undefined) continue;
        inputs[f.id] = raw;
      }
    }

    runMut.mutate(
      {
        id: agent.id,
        inputs,
        model: selectedModel ?? undefined,
        provider_id: selectedProviderId ?? undefined,
      },
      {
        onSuccess: (data) => {
          useChatStore.getState().startGeneration(data.session_id, data.stream_id);
          void startStream(data.session_id, data.stream_id);
          queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
          router.push(getChatRoute(data.session_id));
        },
      },
    );
  };

  const isPending = runMut.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("runTitle", { title: agent.title })}</DialogTitle>
          <DialogDescription>
            {fields.length === 0 ? t("noInputs") : t("runDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {fields.map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => setValue(field.id, v)}
              showError={showErrors}
            />
          ))}
        </div>

        {runMut.isError && (
          <p className="text-xs text-[var(--color-destructive)]">{t("runFailed")}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSubmit}
            disabled={isPending || (showErrors && missingRequired)}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isPending ? t("running") : t("run")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  showError,
}: {
  field: FormField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  showError: boolean;
}) {
  const { t } = useTranslation("saved-agents");
  const label = field.name || field.id;
  const unsupported = UNSUPPORTED_TYPES.has(field.type);
  const invalid =
    showError &&
    field.required &&
    !unsupported &&
    !hasValue(field, value);

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
        <span>{label}</span>
        {field.required ? (
          <span className="text-[var(--color-destructive)]">*</span>
        ) : (
          <span className="text-ui-3xs text-[var(--text-tertiary)]">
            {t("optional")}
          </span>
        )}
      </label>
      {field.description && (
        <p className="text-ui-2xs text-[var(--text-tertiary)]">{field.description}</p>
      )}

      {unsupported ? (
        <p className="text-xs text-[var(--text-tertiary)] italic">
          {t("unsupportedField")}
        </p>
      ) : (
        <FieldInput field={field} value={value} onChange={onChange} />
      )}

      {invalid && (
        <p className="text-ui-2xs text-[var(--color-destructive)]">
          {t("requiredError")}
        </p>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}) {
  const { t } = useTranslation("saved-agents");
  const options = field.options || [];

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          aria-label={field.name || field.id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.example}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="flex w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-transparent px-3 py-2 text-sm shadow-[var(--shadow-sm)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        />
      );

    case "number":
    case "integer":
      return (
        <Input
          aria-label={field.name || field.id}
          type="number"
          step={field.type === "integer" ? 1 : "any"}
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          placeholder={field.example}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      );

    case "select":
      return (
        <select
          aria-label={field.name || field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-[var(--radius)] border border-[var(--border-default)] bg-transparent px-3 text-sm shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        >
          <option value="">{t("selectPlaceholder")}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label || opt.value}
            </option>
          ))}
        </select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (optValue: string) => {
        onChange(
          selected.includes(optValue)
            ? selected.filter((v) => v !== optValue)
            : [...selected, optValue],
        );
      };
      return (
        <div className="space-y-1.5 rounded-[var(--radius)] border border-[var(--border-default)] p-2.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer"
            >
              <input
                type="checkbox"
                aria-label={opt.label || opt.value}
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5 accent-[var(--brand-primary)]"
              />
              <span>{opt.label || opt.value}</span>
            </label>
          ))}
        </div>
      );
    }

    default:
      return (
        <Input
          aria-label={field.name || field.id}
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder={field.example}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
