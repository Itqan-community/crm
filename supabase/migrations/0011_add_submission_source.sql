-- =====================================================================
-- Add `source` provenance to submissions, so we can tell apart entries
-- captured via the public form, a phone call, an event booth, or a
-- partner referral. Existing rows default to channel='form' since that's
-- the only intake path before this change.
-- =====================================================================

alter table public.submissions
  add column source jsonb not null
  default '{"channel":"form","referral":null}'::jsonb;

-- Cheap index to keep `?source=...` filters fast even as the table grows.
create index submissions_source_channel
  on public.submissions ((source->>'channel'));

-- ---------------------------------------------------------------------
-- log_submission_created — refresh so the activity feed knows who
-- created the submission (the previous version hardcoded actor_id=null,
-- which masked the team member behind every manual entry) and so the
-- meta payload includes the source the row was captured through.
--
-- For public form submissions auth.uid() is null, which preserves the
-- prior anonymous-actor behaviour exactly.
-- ---------------------------------------------------------------------
create or replace function public.log_submission_created()
returns trigger language plpgsql as $$
begin
  insert into public.activity_log (submission_id, actor_id, action, meta)
  values (
    new.id,
    auth.uid(),
    'created',
    jsonb_build_object(
      'reference_no', new.reference_no,
      'category_id', new.category_id,
      'source', new.source
    )
  );
  return new;
end;
$$;
