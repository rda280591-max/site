-- ORBIT — متریک «فعال ۲۴ ساعت» داشبورد (idempotent)
-- ریشه باگ: fetchDashboardMetrics از supa.auth.admin.listUsers استفاده می‌کرد
-- که فقط با service_role کار می‌کند؛ با anon key همیشه خطا و .catch(()=>0)
-- داشت → کارت active24h در پروداکشن «همیشه صفر». حالا شمارش داخل Postgres
-- با SECURITY DEFINER انجام می‌شود و ادمین-محور است.

CREATE OR REPLACE FUNCTION public.rpc_active_users_24h()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)
  FROM auth.users u
  WHERE public.is_admin()
    AND u.last_sign_in_at >= now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION public.rpc_active_users_24h() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_active_users_24h() TO authenticated;
