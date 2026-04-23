-- =====================================================================
-- Move the phone field to render AFTER location.
-- Knowing the country/city first lets us predict the dial code for the
-- phone input (e.g. "Riyadh, KSA" → default +966). Previously phone sat
-- above location, so we had no signal to pre-select a country.
--
-- Affected:
--   contributor : phone 30 → 45 (location stays 40)
--   admin       : phone 30 → 45 (location stays 40)
--   content     : phone 25 → 35 (location stays 30)
--   app         : phone 25 → 35 (location stays 30)
--   general     : unchanged (category has no location field)
-- =====================================================================

update public.form_fields f
   set position = case c.key
                    when 'contributor' then 45
                    when 'admin'       then 45
                    when 'content'     then 35
                    when 'app'         then 35
                  end
  from public.form_categories c
 where f.category_id = c.id
   and f.key = 'phone'
   and c.key in ('contributor', 'admin', 'content', 'app');
