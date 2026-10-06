-- =====================================================================
-- Tag groups — admin-defined classification axes for person tags
-- (e.g. "أوقات التطوع", "مستوى الخبرة", "اللغات"). tags.kind becomes a
-- reference to tag_groups.key instead of a fixed two-value enum, so the
-- team can add new axes from /admin/tags without code changes.
-- =====================================================================

create table public.tag_groups (
  key         text primary key,
  label_ar    text not null,
  label_en    text not null,
  position    int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger tag_groups_updated_at before update on public.tag_groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS — team read, admin write (internal taxonomy, not public data)
-- ---------------------------------------------------------------------
alter table public.tag_groups enable row level security;

create policy tag_groups_team_select on public.tag_groups
  for select using (public.is_team_member());
create policy tag_groups_admin_write on public.tag_groups
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed the two existing implicit groups. Their keys match the current
-- tags.kind values, so the eight seeded tags land in them with no data
-- changes.
-- ---------------------------------------------------------------------
insert into public.tag_groups (key, label_ar, label_en, position) values
  ('general',      'تصنيفات عامة', 'General tags', 0),
  ('availability', 'أوقات التطوع', 'Availability', 10);

-- ---------------------------------------------------------------------
-- kind is now a group reference, not a fixed enum. The FK (with ON
-- DELETE RESTRICT) keeps groups deletable only after their tags move —
-- same protection statuses have via status_in_use.
-- ---------------------------------------------------------------------
alter table public.tags drop constraint if exists tags_kind_check;
alter table public.tags
  add constraint tags_group_fk foreign key (kind)
  references public.tag_groups(key) on delete restrict;
