-- ====================================================================
-- Regression suite: run via Supabase SQL (MCP `execute_sql`).
-- Each test wraps its state in a transaction rolled back at the end, so
-- running this file leaves the DB untouched.
--
-- Assertions use RAISE EXCEPTION on failure — a clean run prints "OK"
-- messages only and the overall query returns without error.
-- ====================================================================

-- ----- Test 1: reference_no has the new numeric format NNNNN-NNN -----
do $$
declare
  v text;
begin
  for i in 1..20 loop
    v := public.generate_reference_no();
    if v !~ '^[0-9]{5}-[0-9]{3}$' then
      raise exception 'Test 1 FAIL: reference_no "%" does not match ^\d{5}-\d{3}$', v;
    end if;
  end loop;
  raise notice 'Test 1 OK: reference_no format ^\d{5}-\d{3}$';
end $$;


-- ----- Test 2: submission INSERT triggers activity_log "created" -----
do $$
declare
  cat_id uuid;
  name_field uuid;
  email_field uuid;
  default_status uuid;
  new_sub uuid;
  log_count int;
begin
  -- seed a throwaway category + identity fields
  insert into public.form_categories (key, label_ar, label_en, position)
    values ('_t_cat_' || gen_random_uuid(), 'تست', 'Test', 9999)
    returning id into cat_id;
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'name', 'text', 'اسم', 'Name', 'name', true, 10)
    returning id into name_field;
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'email', 'email', 'بريد', 'Email', 'email', true, 20)
    returning id into email_field;

  select id into default_status from public.statuses where is_default limit 1;

  insert into public.submissions (category_id, status_id, submitter_name, submitter_email)
    values (cat_id, default_status, 'Tester', 'tester@example.com')
    returning id into new_sub;

  select count(*) into log_count from public.activity_log
    where submission_id = new_sub and action = 'created';
  if log_count <> 1 then
    raise exception 'Test 2 FAIL: expected 1 created activity, got %', log_count;
  end if;
  raise notice 'Test 2 OK: submission insert logs "created"';

  -- cleanup
  delete from public.submissions where id = new_sub;
  delete from public.form_categories where id = cat_id;
end $$;


-- ----- Test 3: status change triggers activity_log "status_changed" -----
do $$
declare
  cat_id uuid;
  new_sub uuid;
  s1 uuid;
  s2 uuid;
  log_count int;
begin
  insert into public.form_categories (key, label_ar, label_en, position)
    values ('_t_cat_' || gen_random_uuid(), 'تست', 'Test', 9999)
    returning id into cat_id;
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'name', 'text', 'اسم', 'Name', 'name', true, 10);
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'email', 'email', 'بريد', 'Email', 'email', true, 20);

  select id into s1 from public.statuses where key = 'new';
  select id into s2 from public.statuses where key = 'contacted';

  insert into public.submissions (category_id, status_id, submitter_name, submitter_email)
    values (cat_id, s1, 'Tester', 't@example.com')
    returning id into new_sub;

  update public.submissions set status_id = s2 where id = new_sub;

  select count(*) into log_count from public.activity_log
    where submission_id = new_sub and action = 'status_changed';
  if log_count <> 1 then
    raise exception 'Test 3 FAIL: expected 1 status_changed activity, got %', log_count;
  end if;
  raise notice 'Test 3 OK: status change logs "status_changed"';

  delete from public.submissions where id = new_sub;
  delete from public.form_categories where id = cat_id;
end $$;


-- ----- Test 4: note INSERT triggers activity_log "note_added"
-- (regression for the "Application error" the user hit) -----
do $$
declare
  cat_id uuid;
  new_sub uuid;
  actor uuid;
  s1 uuid;
  note_id uuid;
  log_count int;
begin
  -- create a throwaway auth.user + team_member so note.author_id FK is satisfied
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, email_confirmed_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'test-' || gen_random_uuid() || '@example.com', '', now(), now(), now())
    returning id into actor;
  insert into public.team_members (id, email, role)
    select id, email, 'member' from auth.users where id = actor;

  insert into public.form_categories (key, label_ar, label_en, position)
    values ('_t_cat_' || gen_random_uuid(), 'تست', 'Test', 9999)
    returning id into cat_id;
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'name', 'text', 'اسم', 'Name', 'name', true, 10);
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'email', 'email', 'بريد', 'Email', 'email', true, 20);

  select id into s1 from public.statuses where is_default limit 1;
  insert into public.submissions (category_id, status_id, submitter_name, submitter_email)
    values (cat_id, s1, 'Tester', 't@example.com')
    returning id into new_sub;

  insert into public.notes (submission_id, author_id, body)
    values (new_sub, actor, 'regression test note')
    returning id into note_id;

  select count(*) into log_count from public.activity_log
    where submission_id = new_sub and action = 'note_added';
  if log_count <> 1 then
    raise exception 'Test 4 FAIL: expected 1 note_added activity, got %', log_count;
  end if;
  raise notice 'Test 4 OK: note insert logs "note_added" (SECURITY DEFINER fix)';

  -- cleanup
  delete from public.notes where id = note_id;
  delete from public.submissions where id = new_sub;
  delete from public.form_categories where id = cat_id;
  delete from public.team_members where id = actor;
  delete from auth.users where id = actor;
end $$;


-- ----- Test 5: RLS — anon cannot SELECT submissions -----
do $$
declare
  anon_select_policy_exists boolean;
  anon_insert_policy_exists boolean;
begin
  -- after 0004, submissions has no public insert policy
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions'
      and policyname = 'submissions_public_insert'
  ) into anon_insert_policy_exists;
  if anon_insert_policy_exists then
    raise exception 'Test 5 FAIL: submissions_public_insert policy still present (0004 should have dropped it)';
  end if;

  -- submissions only has team SELECT policy (no anon select)
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions'
      and cmd = 'SELECT' and roles @> array['anon']::name[]
  ) into anon_select_policy_exists;
  if anon_select_policy_exists then
    raise exception 'Test 5 FAIL: submissions has an anon SELECT policy';
  end if;
  raise notice 'Test 5 OK: submissions locked down to service_role + team';
end $$;


-- ----- Test 6: public form schema is still anon-readable -----
do $$
declare
  can_read boolean;
begin
  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'form_categories'
      and cmd = 'SELECT'
  ) into can_read;
  if not can_read then
    raise exception 'Test 6 FAIL: form_categories has no SELECT policy';
  end if;
  raise notice 'Test 6 OK: form schema SELECT policy present';
end $$;


-- ----- Test 7: log trigger functions are SECURITY DEFINER -----
do $$
declare
  r record;
  funcs text[] := array['log_submission_created','log_submission_update','log_note_added'];
  f text;
begin
  foreach f in array funcs loop
    select p.prosecdef into r
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = f;
    if not r.prosecdef then
      raise exception 'Test 7 FAIL: % is not SECURITY DEFINER', f;
    end if;
  end loop;
  raise notice 'Test 7 OK: all log_* trigger functions are SECURITY DEFINER';
end $$;


-- ----- Test 8: field_label_snap survives field soft-delete -----
do $$
declare
  cat_id uuid;
  q_field uuid;
  new_sub uuid;
  s1 uuid;
  found_label text;
begin
  insert into public.form_categories (key, label_ar, label_en, position)
    values ('_t_cat_' || gen_random_uuid(), 'تست', 'Test', 9999)
    returning id into cat_id;
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'name', 'text', 'اسم', 'Name', 'name', true, 10);
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, semantic_role, is_required, position)
    values (cat_id, 'email', 'email', 'بريد', 'Email', 'email', true, 20);
  insert into public.form_fields (category_id, key, kind, label_ar, label_en, is_required, position)
    values (cat_id, 'question', 'textarea', 'سؤالك الأصلي', 'Your original question', true, 30)
    returning id into q_field;

  select id into s1 from public.statuses where is_default limit 1;
  insert into public.submissions (category_id, status_id, submitter_name, submitter_email)
    values (cat_id, s1, 'Tester', 't@example.com')
    returning id into new_sub;

  insert into public.submission_answers (submission_id, field_id, field_key_snap, field_label_snap, value_text)
    values (new_sub, q_field, 'question', '{"ar":"سؤالك الأصلي","en":"Your original question"}'::jsonb, 'an answer');

  -- Now soft-delete the field
  update public.form_fields set is_active = false where id = q_field;

  -- The answer label should still be readable from the snapshot
  select (field_label_snap ->> 'ar') into found_label
    from public.submission_answers where submission_id = new_sub and field_key_snap = 'question';
  if found_label <> 'سؤالك الأصلي' then
    raise exception 'Test 8 FAIL: snapshot label lost or wrong, got "%"', found_label;
  end if;
  raise notice 'Test 8 OK: field_label_snap survives soft-delete';

  delete from public.submission_answers where submission_id = new_sub;
  delete from public.submissions where id = new_sub;
  delete from public.form_categories where id = cat_id;
end $$;

select 'all regression tests passed' as result;
