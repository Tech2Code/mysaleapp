-- =====================================================================
-- 0049: Drop unused bootstrap_first_admin() RPC
-- =====================================================================

drop function if exists public.bootstrap_first_admin();
