-- =====================================================================
-- Allow admins to record a display name when adding a teammate's email,
-- and use it on first sign-in instead of falling back to the email
-- string. Existing rows pick up null and inherit the email-as-name
-- fallback until edited.
-- =====================================================================

alter table public.allowed_emails add column full_name text;

create or replace function public.bootstrap_team_member()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  allowed_record public.allowed_emails%rowtype;
begin
  select * into allowed_record from public.allowed_emails
   where lower(email) = lower(new.email);
  if found then
    insert into public.team_members (id, email, full_name, role)
    values (
      new.id,
      new.email,
      coalesce(allowed_record.full_name, new.raw_user_meta_data->>'full_name', new.email),
      allowed_record.role
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
