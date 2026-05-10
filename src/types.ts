export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ToolTextResult = {
  content: Array<{ type: "text"; text: string }>;
};

export type ExecutionListItem = {
  execution_id: string;
  test_case_id?: number;
  test_case_name?: string;
  status?: string;
  project_id?: number;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: string | null;
  duration_ms?: number | null;
  failed_steps?: number | null;
};
