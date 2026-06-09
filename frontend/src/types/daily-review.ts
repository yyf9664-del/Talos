export interface DailyReviewSourceFile {
  path: string;
  relative_path: string;
  modified_at: string;
  size: number;
  truncated: boolean;
}

export interface DailyReview {
  id: string;
  review_date: string;
  folder_path: string;
  title: string;
  content_markdown: string;
  source_files: DailyReviewSourceFile[];
  model: string | null;
  provider_id: string | null;
  time_created: string;
  time_updated: string;
}

export type DailyReviewListItem = Omit<DailyReview, "content_markdown">;

export interface DailyReviewGenerateRequest {
  folder_path: string;
  review_date: string;
  model?: string | null;
}
