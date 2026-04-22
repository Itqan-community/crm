-- =====================================================================
-- Tighten RLS — drop the broad public INSERT policies.
--
-- The /api/submissions route is the only writer for submissions and
-- submission_answers, and it uses the service_role client (which bypasses
-- RLS). Same for activity_log writes from server-side helpers. Allowing
-- anonymous INSERT was a defense-in-depth lapse: an attacker with the
-- public anon key could insert arbitrary submissions, answers, and
-- activity rows directly against the database, bypassing our validation
-- and rate limiting.
-- =====================================================================

drop policy if exists submissions_public_insert        on public.submissions;
drop policy if exists submission_answers_public_insert on public.submission_answers;
drop policy if exists activity_log_insert              on public.activity_log;

-- (No replacement policies needed — service_role bypasses RLS.)
