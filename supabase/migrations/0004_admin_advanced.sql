-- ORBIT — پنل ادمین پیشرفته: RPC لاگ ممیزی + فیدهای RSS قابل‌مدیریت (idempotent)

-- 1) rpc_audit_log — خواندن لاگ ممیزی فقط توسط ادمین فعال
CREATE OR REPLACE FUNCTION public.rpc_audit_log(p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT id, actor_id, action, target, meta, created_at
    FROM public.admin_audit_log
    WHERE public.is_admin()
    ORDER BY created_at DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limit,50), 200), 1)
  ) t;
$$;

REVOKE ALL ON FUNCTION public.rpc_audit_log(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_audit_log(integer) TO authenticated;

-- 2) feed_sources — فهرست فیدهای RSS که رن‌تایم از آن‌ها می‌خواند.
--    با seed از allowlist کد شروع می‌شود؛ ادمین می‌تواند کم/زیاد کند.
CREATE TABLE IF NOT EXISTS public.feed_sources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text NOT NULL UNIQUE CHECK (url ~ '^https://[a-z0-9.-]+/'),
  label      text NOT NULL DEFAULT '' CHECK (length(label) <= 80),
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_sources ENABLE ROW LEVEL SECURITY;
-- هیچ دسترسی مستقیم؛ فقط از طریق RPC های پایین
REVOKE ALL ON public.feed_sources FROM anon, authenticated;

INSERT INTO public.feed_sources (url) VALUES
  ('https://feeds.arstechnica.com/arstechnica/index'),
  ('https://www.theverge.com/rss/index.xml'),
  ('https://techcrunch.com/feed/'),
  ('https://www.wired.com/feed/rss'),
  ('https://www.nasa.gov/feed/'),
  ('https://feeds.bbci.co.uk/news/technology/rss.xml'),
  ('https://www.theguardian.com/technology/rss')
ON CONFLICT (url) DO NOTHING;

-- 3) rpc_list_feeds — ادمین لیست کامل را می‌بیند؛ هر کسی (برای رن‌تایم) فقط
--    آدرس‌های enabled روی allowlist کد را. دامنه‌های دلخواه ادمین عمداً در
--    این خروجی عمومی هم filter می‌شوند تا پروکسی /api/rss بدون allowlist نشود.
CREATE OR REPLACE FUNCTION public.rpc_list_feeds()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH allowed(hosts) AS (VALUES (ARRAY[
    'feeds.arstechnica.com','www.theverge.com','theverge.com','techcrunch.com',
    'www.wired.com','wired.com','www.nasa.gov','nasa.gov',
    'feeds.bbci.co.uk','bbc.co.uk','www.bbc.co.uk',
    'www.theguardian.com','theguardian.com'
  ]))
  SELECT COALESCE(jsonb_agg(
      CASE WHEN public.is_admin()
        THEN to_jsonb(f)
        ELSE jsonb_build_object('url', f.url, 'label', f.label, 'enabled', f.enabled)
      END ORDER BY f.created_at), '[]'::jsonb)
  FROM public.feed_sources f, allowed a
  WHERE f.enabled
    AND (public.is_admin() OR lower(regexp_replace(f.url, '^https?://([^/:]+).*', '\1')) = ANY(a.hosts));
$$;

-- 4) rpc_add_feed — افزودن فید (اعتبارسنجی ساختاری سمت DB؛ اعتبارسنجی امنیتی
--    نهایی همیشه در SSRF guard برنامه است، نه اینجا).
CREATE OR REPLACE FUNCTION public.rpc_add_feed(p_url text, p_label text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_url IS NULL OR p_url !~ '^https://' THEN RAISE EXCEPTION 'bad url'; END IF;
  h := lower(split_part(substring(p_url from 9), '/', 1));
  IF h = '' OR position('@' in p_url) > 0 THEN RAISE EXCEPTION 'bad url'; END IF;
  IF h LIKE '%localhost%' OR h = 'metadata.google.internal' THEN RAISE EXCEPTION 'blocked host'; END IF;
  IF h ~ '^[0-9.]+$' THEN RAISE EXCEPTION 'blocked host'; END IF; -- IPv4 literal (decimal/octal forms collapse to digits)
  INSERT INTO public.feed_sources (url, label) VALUES (p_url, LEFT(COALESCE(p_label,''), 80))
    ON CONFLICT (url) DO UPDATE SET enabled = true, label = EXCLUDED.label;
  INSERT INTO public.admin_audit_log (actor_id, action, target)
  VALUES (auth.uid(), 'feed.add', p_url);
END $$;

-- 5) rpc_set_feed_enabled — فعال/غیرفعال کردن (soft delete)
CREATE OR REPLACE FUNCTION public.rpc_set_feed_enabled(p_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.feed_sources SET enabled = p_enabled WHERE id = p_id;
  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'feed.toggle', p_id::text, jsonb_build_object('enabled', p_enabled));
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_list_feeds(), public.rpc_add_feed(text,text),
  public.rpc_set_feed_enabled(uuid,boolean) TO authenticated;
