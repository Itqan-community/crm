-- =====================================================================
-- Person tags — team-defined categorisation of submitters
-- (e.g. متطوع / مطور / مصمم) plus volunteer-availability tags
-- (e.g. صباحًا / مساءً / عطلة نهاية الأسبوع). Managed from /admin/tags.
-- =====================================================================

-- ---------------------------------------------------------------------
-- tags (editable from /admin/tags, mirrors the statuses pattern)
-- ---------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_ar    text not null,
  label_en    text not null,
  kind        text not null default 'general' check (kind in ('general','availability')),
  color       text not null default '#6B6B68',
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- submission_tags (many-to-many; a person's request can carry several
-- tags, e.g. "مصمم" + "متطوع" + "مساءً")
-- ---------------------------------------------------------------------
create table public.submission_tags (
  submission_id  uuid not null references public.submissions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  assigned_by    uuid references public.team_members(id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (submission_id, tag_id)
);
create index submission_tags_tag on public.submission_tags (tag_id);

-- log: tag added / removed
-- SECURITY DEFINER like the other log_* triggers (see 0005): 0004 dropped
-- the public insert policy on activity_log, so a plain trigger function
-- running under the caller's RLS would be denied on the cascade insert.
-- The existence guard skips logging while a submission deletion cascades
-- its submission_tags deletes — an activity row for a vanished parent
-- would violate activity_log's FK (seen live: delete of a tagged
-- submission failed with 23503 without it).
create or replace function public.log_submission_tag_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.submissions where id = new.submission_id) then
      return new;
    end if;
    insert into public.activity_log (submission_id, actor_id, action, meta)
    values (new.submission_id, auth.uid(), 'tag_added',
            jsonb_build_object('tag_id', new.tag_id));
    return new;
  else
    if not exists (select 1 from public.submissions where id = old.submission_id) then
      return old;
    end if;
    insert into public.activity_log (submission_id, actor_id, action, meta)
    values (old.submission_id, auth.uid(), 'tag_removed',
            jsonb_build_object('tag_id', old.tag_id));
    return old;
  end if;
end;
$$;
create trigger submission_tags_after_write_log
  after insert or delete on public.submission_tags
  for each row execute function public.log_submission_tag_changed();

-- ---------------------------------------------------------------------
-- RLS — team read/write, admin-only tag delete (mirrors statuses)
-- ---------------------------------------------------------------------
alter table public.tags             enable row level security;
alter table public.submission_tags  enable row level security;

create policy tags_team_select on public.tags
  for select using (public.is_team_member());
create policy tags_team_insert on public.tags
  for insert with check (public.is_team_member());
create policy tags_team_update on public.tags
  for update using (public.is_team_member()) with check (public.is_team_member());
create policy tags_admin_delete on public.tags
  for delete using (public.is_admin());

create policy submission_tags_team_select on public.submission_tags
  for select using (public.is_team_member());
create policy submission_tags_team_insert on public.submission_tags
  for insert with check (public.is_team_member());
create policy submission_tags_team_delete on public.submission_tags
  for delete using (public.is_team_member());

-- ---------------------------------------------------------------------
-- Seed starter tags (editable/deletable from /admin/tags)
-- ---------------------------------------------------------------------
insert into public.tags (key, label_ar, label_en, kind, color, position) values
  ('volunteer',       'متطوع',                  'Volunteer',              'general',      '#2E7D32', 10),
  ('developer',       'مطور',                   'Developer',              'general',      '#2563EB', 20),
  ('designer',        'مصمم',                   'Designer',               'general',      '#7C3AED', 30),
  ('content_writer',  'كاتب محتوى',             'Content writer',         'general',      '#D97706', 40),
  ('avail_morning',   'صباحًا',                 'Mornings',               'availability', '#0891B2', 10),
  ('avail_evening',   'مساءً / ليلًا',           'Evenings / nights',      'availability', '#DB2777', 20),
  ('avail_weekend',   'عطلة نهاية الأسبوع',     'Weekends',               'availability', '#059669', 30),
  ('avail_flexible',  'مرن',                    'Flexible',               'availability', '#6B6B68', 40);
