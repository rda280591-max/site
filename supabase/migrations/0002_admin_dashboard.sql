-- ORBIT — داشبورد ادمین: نقش‌ها، جدول مقالات دستی، لاگ ممیزی و ایندکس‌ها
-- اجرای idempotent (safe to re-run).

-- 1) profiles — پروفایل کاربر (نقش + وضعیت بن)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned')),
  last_login timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- همگام‌سازی خودکار پروفایل هنگام ثبت‌نام OAuth
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

-- به‌روزرسانی last_login در هر نشست جدید
CREATE OR REPLACE FUNCTION public.touch_last_login()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_login = now(), updated_at = now() WHERE id = auth.uid();
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- نوشتن نقش فقط با تابع SECURITY DEFINER پایین (نه مستقیم) انجام می‌شود.

-- 2) articles — محتوای دستی که ادمین منتشر می‌کند
CREATE TABLE IF NOT EXISTS public.articles (
  id          text PRIMARY KEY,               -- slug پایدار مثل art-manual-xxxx
  title       text NOT NULL CHECK (length(title) <= 300),
  summary     text NOT NULL DEFAULT '' CHECK (length(summary) <= 1000),
  body        text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT 'tech',
  source_name text NOT NULL DEFAULT 'ORBIT',
  url         text NOT NULL,
  image_url   text,
  author      text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  is_published boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- همه (شامل RSC سرور با anon key) فقط مقالات منتشرشده را می‌خوانند
DROP POLICY IF EXISTS "articles_public_read" ON public.articles;
CREATE POLICY "articles_public_read" ON public.articles
  FOR SELECT TO anon, authenticated USING (is_published = true);

-- هیچ‌کس از بیرون نمی‌نویسد؛ CRUD فقط از طریق RPC ادمین
REVOKE INSERT, UPDATE, DELETE ON public.articles FROM anon, authenticated;

-- 3) admin_audit_log — ردپای هر اکشن ادمین
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id   uuid NOT NULL,
  action     text NOT NULL,
  target     text,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_only_via_rpc" ON public.admin_audit_log FOR ALL TO authenticated USING (false);
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;

-- 4) توابع کمکی ادمین (SECURITY DEFINER — چک نقش داخل تابع)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.rpc_upsert_article(payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.articles (id,title,summary,body,category,source_name,url,image_url,author,published_at,is_published,created_by,updated_at)
  VALUES (
    COALESCE(payload->>'id', 'art-manual-' || substr(md5(random()::text),1,10)),
    LEFT(COALESCE(payload->>'title',''), 300),
    LEFT(COALESCE(payload->>'summary',''), 1000),
    COALESCE(payload->>'body',''),
    COALESCE(payload->>'category','tech'),
    COALESCE(payload->>'source_name','ORBIT'),
    payload->>'url',
    payload->>'image_url',
    LEFT(COALESCE(payload->>'author',''), 120),
    COALESCE((payload->>'published_at')::timestamptz, now()),
    COALESCE((payload->>'is_published')::boolean, true),
    auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    title=EXCLUDED.title, summary=EXCLUDED.summary, body=EXCLUDED.body,
    category=EXCLUDED.category, source_name=EXCLUDED.source_name, url=EXCLUDED.url,
    image_url=EXCLUDED.image_url, author=EXCLUDED.author,
    published_at=EXCLUDED.published_at, is_published=EXCLUDED.is_published, updated_at=now();
  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'article.upsert', COALESCE(payload->>'id','new'), jsonb_build_object('title', payload->>'title'));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_delete_article(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.articles WHERE id = p_id;
  INSERT INTO public.admin_audit_log (actor_id, action, target) VALUES (auth.uid(), 'article.delete', p_id);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_set_user_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('active','banned') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE public.profiles SET status = p_status, updated_at = now() WHERE id = p_user_id AND id <> auth.uid();
  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'user.status', p_user_id::text, jsonb_build_object('status', p_status));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_list_profiles()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'status',status,'last_login',last_login))
  FROM public.profiles WHERE public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(), public.rpc_upsert_article(jsonb),
  public.rpc_delete_article(text), public.rpc_set_user_status(uuid,text),
  public.rpc_list_profiles(), public.touch_last_login() TO authenticated;

-- 5) ایندکس‌ها (B-Tree برای فیلترهای داغ)
CREATE INDEX IF NOT EXISTS idx_articles_pub ON public.articles (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_cat ON public.articles (category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.admin_audit_log (actor_id, created_at DESC);
