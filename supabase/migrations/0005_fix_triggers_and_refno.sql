-- =====================================================================
-- Two fixes:
--
-- 1. After 0004 dropped the `activity_log_insert` policy with `(true)`,
--    the AFTER-trigger functions (log_note_added, log_submission_update,
--    log_submission_created) started failing under user-scoped RLS — a
--    note insert from a team_member would be denied at the cascade. Mark
--    these functions SECURITY DEFINER so they execute with the function
--    owner's privileges and bypass RLS, exactly like our other helpers
--    (is_team_member, is_admin, bootstrap_team_member).
--
-- 2. Reference numbers are now purely numeric (no letters, no "ITQ-"
--    prefix). Format: NNNNN-NNN (8 digits with a separator). Existing
--    reference_no values are not migrated — only newly inserted rows
--    get the new format.
-- =====================================================================

-- (1) Wrap log functions with SECURITY DEFINER + locked search_path.

create or replace function public.log_submission_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (submission_id, actor_id, action, meta)
  values (new.id, null, 'created',
          jsonb_build_object('reference_no', new.reference_no, 'category_id', new.category_id));
  return new;
end;
$$;

create or replace function public.log_submission_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_id is distinct from old.status_id then
    insert into public.activity_log (submission_id, actor_id, action, meta)
    values (new.id, auth.uid(), 'status_changed',
            jsonb_build_object('from', old.status_id, 'to', new.status_id));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.activity_log (submission_id, actor_id, action, meta)
    values (new.id, auth.uid(), 'assigned',
            jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
  end if;
  return new;
end;
$$;

create or replace function public.log_note_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (submission_id, actor_id, action, meta)
  values (new.submission_id, new.author_id, 'note_added',
          jsonb_build_object('note_id', new.id));
  return new;
end;
$$;

-- (2) Numeric-only reference numbers: NNNNN-NNN.

create or replace function public.generate_reference_no()
returns text language plpgsql as $$
declare
  digits constant text := '0123456789';
  part1 text := '';
  part2 text := '';
  i int;
begin
  for i in 1..5 loop
    part1 := part1 || substr(digits, 1 + floor(random() * length(digits))::int, 1);
  end loop;
  for i in 1..3 loop
    part2 := part2 || substr(digits, 1 + floor(random() * length(digits))::int, 1);
  end loop;
  return part1 || '-' || part2;
end;
$$;
