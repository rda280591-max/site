-- ORBIT — همگام‌سازی پروفایل‌ها: هر کاربر auth که هنوز ردیف profiles ندارد
-- ساخته می‌شود (رفع «گیر کردن روی صفحه اصلی هنگام ورود به /admin» برای
-- کاربرانی که قبل از ساخت جدول profiles ثبت‌نام کرده بودند). idempotent.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, last_login)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, last_login = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- بک‌فیل: ساخت ردیف profiles برای همه کاربران موجودِ بدون پروفایل
INSERT INTO public.profiles (id, email, last_login)
SELECT u.id, u.email, now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
