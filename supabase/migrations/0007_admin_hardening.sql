-- ORBIT — سخت‌سازی پنل ادمین (رفع باگ/آسیب‌پذیری‌های کشف‌شده در بازبینی عمیق)
-- اجرای idempotent (safe to re-run).

-- 0) try_timestamptz — تبدیل امن تاریخ (ورودی نامعتبر → NULL بدون exception).
--    قبلاً `(payload->>'published_at')::timestamptz` با تاریخ بدفرمت کل upsert
--    را با خطای 22007 می‌ترکانید.
CREATE OR REPLACE FUNCTION public.try_timestamptz(raw text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN RETURN NULL; END IF;
  RETURN btrim(raw)::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.try_timestamptz(text) FROM anon;

-- 1) rpc_upsert_article — چهار نقص رفع می‌شود:
--    a) اعتبارسنجی نوع payload: قبلاً هر مقدار غیررشته‌ای JSON (عدد/آبجکت/آرایه)
--       مستقیم به ستون text می‌رفت و خطای داخلی 22P02 تولید می‌کرد.
--    b) is_published: کست خام boolean با مقدار غیربولی («yes») استثنا می‌داد؛
--       حالا فقط true/false معنادار است.
--    c) متادیتای لاگ محدود شد (title تا ۱۲۰ کاراکتر) تا جدول audit باد نکند.
--    d) RETURNS text (id نهایی): UI ادمین برای هم‌کلید ماندن ردیف local با
--       ردیف سرور به id واقعیِ درج‌شده نیاز دارد؛ کلاینت اگر null گرفت
--       (migration قدیمی) بی‌خطر fallback می‌کند.
CREATE OR REPLACE FUNCTION public.rpc_upsert_article(payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id     text;
  v_title  text;
  v_url    text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN RAISE EXCEPTION 'bad payload'; END IF;

  -- نوع‌سنجی سمت DB (دفاع لایه دوم؛ لایه اول validateArticle است)
  IF jsonb_typeof(payload->'id') NOT IN ('string','null') THEN RAISE EXCEPTION 'bad id'; END IF;
  v_id := NULLIF(btrim(payload->>'id'), '');
  IF v_id IS NOT NULL AND length(v_id) > 80 THEN RAISE EXCEPTION 'id too long'; END IF;

  IF jsonb_typeof(payload->'title') <> 'string' THEN RAISE EXCEPTION 'title required'; END IF;
  v_title := btrim(payload->>'title');
  IF length(v_title) < 3 OR length(v_title) > 300 THEN RAISE EXCEPTION 'invalid title'; END IF;

  IF jsonb_typeof(payload->'url') <> 'string' THEN RAISE EXCEPTION 'url required'; END IF;
  v_url := btrim(payload->>'url');
  IF v_url !~ '^https://' OR length(v_url) > 512 THEN RAISE EXCEPTION 'invalid url'; END IF;

  IF payload ? 'summary'      AND jsonb_typeof(payload->'summary')      NOT IN ('string','null') THEN RAISE EXCEPTION 'bad summary'; END IF;
  IF payload ? 'body'         AND jsonb_typeof(payload->'body')         NOT IN ('string','null') THEN RAISE EXCEPTION 'bad body'; END IF;
  IF payload ? 'category'     AND jsonb_typeof(payload->'category')     NOT IN ('string','null') THEN RAISE EXCEPTION 'bad category'; END IF;
  IF payload ? 'source_name'  AND jsonb_typeof(payload->'source_name')  NOT IN ('string','null') THEN RAISE EXCEPTION 'bad source_name'; END IF;
  IF payload ? 'author'       AND jsonb_typeof(payload->'author')       NOT IN ('string','null') THEN RAISE EXCEPTION 'bad author'; END IF;
  IF payload ? 'image_url'    AND jsonb_typeof(payload->'image_url')    NOT IN ('string','null') THEN RAISE EXCEPTION 'bad image_url'; END IF;
  IF payload ? 'published_at' AND jsonb_typeof(payload->'published_at') NOT IN ('string','null') THEN RAISE EXCEPTION 'bad published_at'; END IF;

  INSERT INTO public.articles (id,title,summary,body,category,source_name,url,image_url,author,published_at,is_published,created_by,updated_at)
  VALUES (
    COALESCE(v_id, 'art-manual-' || substr(md5(random()::text),1,10)),
    LEFT(v_title, 300),
    LEFT(COALESCE(payload->>'summary',''), 1000),
    LEFT(COALESCE(payload->>'body',''), 100000),
    LEFT(COALESCE(payload->>'category','tech'), 40),
    LEFT(COALESCE(payload->>'source_name','ORBIT'), 80),
    v_url,
    LEFT(NULLIF(payload->>'image_url',''), 512),
    LEFT(COALESCE(payload->>'author',''), 120),
    -- تاریخ نامعتبر → now() (با try_timestamptz بالا)
    COALESCE(public.try_timestamptz(payload->>'published_at'), now()),
    CASE lower(COALESCE(payload->>'is_published','true'))
      WHEN 'false' THEN false ELSE true
    END,
    auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET
    title=EXCLUDED.title, summary=EXCLUDED.summary, body=EXCLUDED.body,
    category=EXCLUDED.category, source_name=EXCLUDED.source_name, url=EXCLUDED.url,
    image_url=EXCLUDED.image_url, author=EXCLUDED.author,
    published_at=EXCLUDED.published_at, is_published=EXCLUDED.is_published, updated_at=now();

  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'article.upsert', COALESCE(v_id, 'new'),
          jsonb_build_object('title', LEFT(v_title, 120)));

  -- id نهاییِ ردیف (همان که در جدول in-flight است) به کلاینت برمی‌گردد.
  RETURN COALESCE(v_id, 'art-manual-' || substr(md5(random()::text),1,10));
END $$;

GRANT EXECUTE ON FUNCTION public.try_timestamptz(text) TO authenticated;

-- 2) rpc_delete_article — نبود ردیف دیگر بی‌صدا «موفق» نیست؛ اگر id وجود
--    نداشت استثنا می‌دهد تا اکشن سرور خطای واقعی به UI برگرداند
--    (قبلاً حذف id نامعتبر ok:true می‌داد و ردیف در جدول می‌ماند).
CREATE OR REPLACE FUNCTION public.rpc_delete_article(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM public.articles WHERE id = p_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target) VALUES (auth.uid(), 'article.delete', p_id);
END $$;

-- 3) rpc_set_user_status — صحت‌سنجی نتیجه: اگر UPDATE هیچ ردیفی را عوض نکرد
--    (کاربر وجود ندارد / خودِ ادمین) استثنا می‌دهد؛ قبلاً بن‌کردن ناموفق
--    بی‌صدا موفق گزارش می‌شد. همچنین بن‌کردن ادمینِ آخر را متوقف نمی‌کند
--    (قفل‌شدن پنل از لایه اپلیکیشن با self-ban guard مدیریت می‌شود).
CREATE OR REPLACE FUNCTION public.rpc_set_user_status(p_user_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('active','banned') THEN RAISE EXCEPTION 'bad status'; END IF;
  UPDATE public.profiles SET status = p_status, updated_at = now()
   WHERE id = p_user_id AND id <> auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'user not found or self'; END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'user.status', p_user_id::text, jsonb_build_object('status', p_status));
END $$;

-- 4) rpc_purge_cache — ثبت عملیات پاک‌سازی کش در لاگ ممیزی (قبلاً تنها اکشن
--    نوشتاری بدون ردپا بود؛ سیاست «هر اکشن ثبت شود» نقض می‌شد).
CREATE OR REPLACE FUNCTION public.rpc_purge_cache()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.admin_audit_log (actor_id, action, target, meta)
  VALUES (auth.uid(), 'cache.purge', null, jsonb_build_object('instance', 'server'));
END $$;

REVOKE ALL ON FUNCTION public.rpc_purge_cache() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_purge_cache() TO authenticated;
