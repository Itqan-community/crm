-- =====================================================================
-- Itqan CRM — initial schema
-- Form schema (categories/fields) is decoupled from submissions/answers
-- so admins can add/edit fields from the dashboard without code changes.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_reference_no()
returns text language plpgsql as $$
declare
  chars constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  part1 text := '';
  part2 text := '';
  i int;
begin
  for i in 1..5 loop
    part1 := part1 || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  for i in 1..3 loop
    part2 := part2 || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return 'ITQ-' || part1 || '-' || part2;
end;
$$;

-- ---------------------------------------------------------------------
-- team_members  (extends auth.users — id matches auth.users.id)
-- ---------------------------------------------------------------------
create table public.team_members (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text,
  role        text not null default 'member' check (role in ('admin','member')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

-- allowed_emails — gatekeeper for magic-link sign-in
create table public.allowed_emails (
  email       text primary key,
  role        text not null default 'member' check (role in ('admin','member')),
  created_at  timestamptz not null default now()
);

-- helper booleans usable in RLS policies
create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- statuses (editable from /admin/settings)
-- ---------------------------------------------------------------------
create table public.statuses (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  label_ar     text not null,
  label_en     text not null,
  color        text not null default '#6B6B68',
  position     int not null default 0,
  is_default   boolean not null default false,
  is_terminal  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger statuses_updated_at before update on public.statuses
  for each row execute function public.set_updated_at();

-- only one default
create unique index statuses_one_default on public.statuses ((true)) where is_default;

-- ---------------------------------------------------------------------
-- form_categories
-- ---------------------------------------------------------------------
create table public.form_categories (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_ar    text not null,
  label_en    text not null,
  hint_ar     text,
  hint_en     text,
  icon        text,
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger form_categories_updated_at before update on public.form_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- form_fields
-- ---------------------------------------------------------------------
create table public.form_fields (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.form_categories(id) on delete cascade,
  key             text not null,
  kind            text not null check (kind in ('text','email','phone','url','textarea','radio','checkbox')),
  label_ar        text not null,
  label_en        text not null,
  help_ar         text,
  help_en         text,
  placeholder_ar  text,
  placeholder_en  text,
  is_required     boolean not null default false,
  is_multi        boolean not null default true,  -- only meaningful for checkbox
  options         jsonb not null default '[]'::jsonb,  -- list of {ar,en}
  semantic_role   text check (semantic_role in ('name','email','phone','location','newsletter')),
  position        int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (category_id, key)
);
create index form_fields_category_pos on public.form_fields (category_id, position);
create trigger form_fields_updated_at before update on public.form_fields
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- submissions  (metadata only)
-- ---------------------------------------------------------------------
create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  reference_no        text not null unique,
  category_id         uuid not null references public.form_categories(id) on delete restrict,
  language            text not null default 'ar' check (language in ('ar','en')),
  status_id           uuid not null references public.statuses(id) on delete restrict,
  assignee_id         uuid references public.team_members(id) on delete set null,
  submitter_name      text not null,
  submitter_email     text not null,
  newsletter_optin    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index submissions_created_at on public.submissions (created_at desc);
create index submissions_status     on public.submissions (status_id);
create index submissions_assignee   on public.submissions (assignee_id);
create index submissions_category   on public.submissions (category_id);

create or replace function public.submissions_set_defaults()
returns trigger language plpgsql as $$
declare
  attempts int := 0;
  candidate text;
  default_status uuid;
begin
  -- reference_no
  if new.reference_no is null or new.reference_no = '' then
    loop
      candidate := public.generate_reference_no();
      exit when not exists (select 1 from public.submissions where reference_no = candidate);
      attempts := attempts + 1;
      if attempts > 10 then
        raise exception 'Could not generate unique reference_no after 10 attempts';
      end if;
    end loop;
    new.reference_no := candidate;
  end if;
  -- default status
  if new.status_id is null then
    select id into default_status from public.statuses where is_default order by position limit 1;
    if default_status is null then
      raise exception 'No default status configured';
    end if;
    new.status_id := default_status;
  end if;
  return new;
end;
$$;

create trigger submissions_before_insert before insert on public.submissions
  for each row execute function public.submissions_set_defaults();

create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- submission_answers
--
-- field_key_snap and field_label_snap are SNAPSHOTS of the form_field's
-- key + bilingual label at submission time. They let the dashboard keep
-- rendering historical answers correctly even after admins rename, edit,
-- or remove the underlying field via the form-builder. field_id stays as
-- a foreign key for joins (e.g. ordering by current position), but it is
-- nullable + ON DELETE SET NULL so a hard-deleted field doesn't take its
-- past answers down with it.
-- ---------------------------------------------------------------------
create table public.submission_answers (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references public.submissions(id) on delete cascade,
  field_id          uuid references public.form_fields(id) on delete set null,
  field_key_snap    text not null,
  field_label_snap  jsonb not null,  -- {ar, en}
  value_text        text,
  value_json        jsonb,
  created_at        timestamptz not null default now(),
  unique (submission_id, field_key_snap)
);
create index submission_answers_submission on public.submission_answers (submission_id);

-- ---------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------
create table public.notes (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  author_id       uuid not null references public.team_members(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index notes_submission on public.notes (submission_id, created_at);
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------
create table public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  actor_id        uuid references public.team_members(id) on delete set null,
  action          text not null,  -- created | status_changed | assigned | note_added | newsletter_subscribed | newsletter_failed
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index activity_log_submission on public.activity_log (submission_id, created_at);

-- log: created
create or replace function public.log_submission_created()
returns trigger language plpgsql as $$
begin
  insert into public.activity_log (submission_id, actor_id, action, meta)
  values (new.id, null, 'created', jsonb_build_object('reference_no', new.reference_no, 'category_id', new.category_id));
  return new;
end;
$$;
create trigger submissions_after_insert_log after insert on public.submissions
  for each row execute function public.log_submission_created();

-- log: status / assignee change
create or replace function public.log_submission_update()
returns trigger language plpgsql as $$
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
create trigger submissions_after_update_log after update on public.submissions
  for each row execute function public.log_submission_update();

-- log: note added
create or replace function public.log_note_added()
returns trigger language plpgsql as $$
begin
  insert into public.activity_log (submission_id, actor_id, action, meta)
  values (new.submission_id, new.author_id, 'note_added',
          jsonb_build_object('note_id', new.id));
  return new;
end;
$$;
create trigger notes_after_insert_log after insert on public.notes
  for each row execute function public.log_note_added();

-- ---------------------------------------------------------------------
-- bootstrap team_members from allowed_emails on first sign-in
-- (auth.users insert -> create team_members row if email in allowed_emails)
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_team_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  allowed_role text;
begin
  select role into allowed_role from public.allowed_emails
   where lower(email) = lower(new.email);
  if allowed_role is not null then
    insert into public.team_members (id, email, full_name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), allowed_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.bootstrap_team_member();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.team_members        enable row level security;
alter table public.allowed_emails      enable row level security;
alter table public.statuses            enable row level security;
alter table public.form_categories     enable row level security;
alter table public.form_fields         enable row level security;
alter table public.submissions         enable row level security;
alter table public.submission_answers  enable row level security;
alter table public.notes               enable row level security;
alter table public.activity_log        enable row level security;

-- team_members: read by team, write by admin
create policy team_members_select on public.team_members
  for select using (public.is_team_member());
create policy team_members_admin_write on public.team_members
  for all using (public.is_admin()) with check (public.is_admin());

-- allowed_emails: admin only
create policy allowed_emails_admin on public.allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- statuses: public read (form needs label/colors), team write, admin delete
create policy statuses_public_read on public.statuses for select using (true);
create policy statuses_team_write  on public.statuses for insert with check (public.is_team_member());
create policy statuses_team_update on public.statuses for update using (public.is_team_member()) with check (public.is_team_member());
create policy statuses_admin_delete on public.statuses for delete using (public.is_admin());

-- form_categories: public read (active only via view; here allow read of all rows for team, active for anon)
create policy form_categories_public_read on public.form_categories
  for select using (is_active or public.is_team_member());
create policy form_categories_admin_write on public.form_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- form_fields: same pattern
create policy form_fields_public_read on public.form_fields
  for select using (is_active or public.is_team_member());
create policy form_fields_admin_write on public.form_fields
  for all using (public.is_admin()) with check (public.is_admin());

-- submissions: anyone can INSERT (form is public). Only team can SELECT/UPDATE/DELETE.
create policy submissions_public_insert on public.submissions
  for insert with check (true);
create policy submissions_team_select on public.submissions
  for select using (public.is_team_member());
create policy submissions_team_update on public.submissions
  for update using (public.is_team_member()) with check (public.is_team_member());
create policy submissions_admin_delete on public.submissions
  for delete using (public.is_admin());

-- submission_answers: anyone can INSERT (with valid submission_id). Only team can read.
-- Note: integrity is enforced at API route level (server uses service_role to insert in batch).
create policy submission_answers_public_insert on public.submission_answers
  for insert with check (true);
create policy submission_answers_team_select on public.submission_answers
  for select using (public.is_team_member());

-- notes: team only, edit/delete only by author
create policy notes_team_select on public.notes for select using (public.is_team_member());
create policy notes_team_insert on public.notes for insert with check (public.is_team_member() and author_id = auth.uid());
create policy notes_author_update on public.notes for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy notes_author_delete on public.notes for delete using (author_id = auth.uid() or public.is_admin());

-- activity_log: team read, system writes (anon insert allowed for newsletter logs from server)
create policy activity_log_team_select on public.activity_log for select using (public.is_team_member());
create policy activity_log_insert on public.activity_log for insert with check (true);
