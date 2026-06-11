export type FormFieldType =
  | "string"
  | "textarea"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "multiselect";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  name?: string;
  type: FormFieldType;
  required?: boolean;
  description?: string;
  default_value?: unknown;
  example?: string;
  options?: FormFieldOption[];
}

export interface SavedAgent {
  id: string;
  workspace_path: string;
  identifier: string;
  title: string;
  description: string;
  version: string;
  skill_content: string;
  form_schema: FormField[];
  memory_schema: Record<string, unknown>;
  source_session_id: string | null;
  time_created: string;
  time_updated: string;
}
