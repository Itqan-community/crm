// Hand-written types matching supabase/migrations/0001_init.sql.
// Replace with `supabase gen types typescript` output when you set up the CLI.

export type FieldKind = 'text' | 'email' | 'phone' | 'url' | 'textarea' | 'radio' | 'checkbox';
export type SemanticRole = 'name' | 'email' | 'phone' | 'location' | 'newsletter';
export type Lang = 'ar' | 'en';
export type Bilingual = { ar: string; en: string };

export interface FormCategoryRow {
  id: string;
  key: string;
  label_ar: string;
  label_en: string;
  hint_ar: string | null;
  hint_en: string | null;
  icon: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormFieldRow {
  id: string;
  category_id: string;
  key: string;
  kind: FieldKind;
  label_ar: string;
  label_en: string;
  help_ar: string | null;
  help_en: string | null;
  placeholder_ar: string | null;
  placeholder_en: string | null;
  is_required: boolean;
  is_multi: boolean;
  options: Bilingual[];
  semantic_role: SemanticRole | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatusRow {
  id: string;
  key: string;
  label_ar: string;
  label_en: string;
  color: string;
  position: number;
  is_default: boolean;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

export interface AllowedEmailRow {
  email: string;
  full_name: string | null;
  role: 'admin' | 'member';
  created_at: string;
}

export interface SubmissionRow {
  id: string;
  reference_no: string;
  category_id: string;
  language: Lang;
  status_id: string;
  assignee_id: string | null;
  submitter_name: string;
  submitter_email: string;
  newsletter_optin: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubmissionAnswerRow {
  id: string;
  submission_id: string;
  field_id: string | null;
  field_key_snap: string;
  field_label_snap: Bilingual;
  value_text: string | null;
  value_json: unknown;
  created_at: string;
}

export interface NoteRow {
  id: string;
  submission_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export type ActivityAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'note_added'
  | 'newsletter_subscribed'
  | 'newsletter_failed'
  | 'email_failed'
  | 'slack_failed';

export interface ActivityLogRow {
  id: string;
  submission_id: string;
  actor_id: string | null;
  action: ActivityAction;
  meta: Record<string, unknown>;
  created_at: string;
}
