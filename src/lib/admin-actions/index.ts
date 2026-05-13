// Barrel re-export so call sites keep using `@/lib/admin-actions`.
// Each module below has its own 'use server' directive — server-action
// identity is preserved across the re-export.
export {
  setSubmissionStatus,
  archiveSubmissions,
  setSubmissionAssignee,
  createManualSubmission,
  addNote,
  deleteNote,
} from './submissions';
export { upsertStatus, deleteStatus } from './statuses';
export { addAllowedEmail, removeAllowedEmail } from './team';
export {
  upsertCategory,
  deleteCategory,
  upsertField,
  deleteField,
  setFieldActive,
} from './form-schema';
