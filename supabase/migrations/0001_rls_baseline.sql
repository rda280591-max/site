-- ORBIT — RLS baseline (DevSecOps audit)
-- فرض: جداول کاربردی فقط user_notes و bookmarks هستند (کد سمت کلاینت هیچ جدول
-- دیگری را صدا نمی‌زند؛ همه داده اخبار از پروکسی /api/rss می‌آید).
-- هر جدول دیگری که در پروژه ساخته شود هم با همین الگو قفل شود.

-- 1) فعال‌سازی RLS روی همه جدول‌های موجود بدون پالیسی (deny-by-default).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname, c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relpersistence = 'p'
      AND c.relname NOT LIKE 'supabase_%'          -- internal tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=r.relname) THEN
      -- پالیسی پیش‌فرضِ رد: تا وقتی پالیسی واقعی auth.uid() ننوشته‌ایم،
      -- حتی anon key هم هیچ ردیفی نمی‌بیند.
      EXECUTE format(
        'CREATE POLICY deny_all_no_policy ON public.%I FOR ALL TO anon, authenticated USING (false)',
        r.relname);
    END IF;
  END LOOP;
END $$;

-- 2) user_notes — مالکیت کامل بر اساس auth.uid()
CREATE TABLE IF NOT EXISTS public.user_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) <= 20000),   -- سقف UGC
  pinned      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.user_notes FROM anon;   -- ناشناس مطلقاً دسترسی نداشته باشد

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_owner_select" ON public.user_notes;
CREATE POLICY "notes_owner_select" ON public.user_notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_owner_insert" ON public.user_notes;
CREATE POLICY "notes_owner_insert" ON public.user_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_owner_update" ON public.user_notes;
CREATE POLICY "notes_owner_update" ON public.user_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notes_owner_delete" ON public.user_notes;
CREATE POLICY "notes_owner_delete" ON public.user_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3) bookmarks — همان الگوی مالکیت
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id  text NOT NULL,
  title       text NOT NULL CHECK (length(title) <= 500),     -- سقف UGC
  url         text NOT NULL CHECK (url ~ '^https?://'),       -- ضد javascript:/data:
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
REVOKE ALL ON public.bookmarks FROM anon;

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bm_owner_select" ON public.bookmarks;
CREATE POLICY "bm_owner_select" ON public.bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bm_owner_insert" ON public.bookmarks;
CREATE POLICY "bm_owner_insert" ON public.bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bm_owner_delete" ON public.bookmarks;
CREATE POLICY "bm_owner_delete" ON public.bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- UPDATE روی bookmark معنا ندارد → پالیسی ساخته نمی‌شود = ممنوع (deny by default).

-- 4) هر جدول تازه‌ای در آینده: همین قالب را کپی کن؛ «جدول بدون پالیسی» یعنی
--    deny-all نه open-access. هیچ پالیسی USING بدون auth.uid() نپذیرفته نشود،
--    مگر SELECT read-only روی جدول عمومی (که فعلاً نداریم).
