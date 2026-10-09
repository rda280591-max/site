// src/app/api/admin/upload/route.ts — پروکسی آپلود تصویر کاور ادمین
// SECURITY: توکن access هرگز به کلاینت داده نمی‌شود؛ احراز هویت + نقش ادمین
// سمت سرور (requireAdmin) چک می‌شود. اعتبارسنجی نوع/حجم فایل دوباره اینجا
// انجام می‌شود چون هیچ ورودی از کلاینت قابل اعتماد نیست.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/services/admin/adminGuard';
import { createRateLimiter, ipKey } from '@/core/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * FIX — آپلود بدون Rate Limit بود: یک ادمینِ آسیب‌دیده (یا XSS ذخیره‌شده در
 * پنل) می‌توانست هزاران فایل ۲ مگابایتی روی storage بریزد. ۱۰ آپلود/دقیقه
 * به‌ازای IP برای پنل ادمین کافی است.
 */
const uploadLimiter = createRateLimiter(10, 60);

const MAX_BYTES = 2_097_152; // 2MB — هم‌راستا با file_size_limit باکت و کلاینت
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/**
 * امضای بایتی واقعی تصویر (JPEG/PNG/WebP/AVIF). SVG و هر نوع دیگر رد می‌شود.
 */
function sniffImageType(b: Buffer): boolean {
  if (b.length < 12) return false;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  // WebP: RIFF....WEBP
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return true;
  // AVIF/ISO-BMFF: ....ftypavif / avis / heic...
  if (b.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = b.subarray(8, 12).toString('ascii');
    return brand === 'avif' || brand === 'avis';
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    // FIX — CSRF روی endpoint آپلود: برخلاف Server Actionها، Route Handler در
    // Next.js بررسی Origin ندارد؛ فرم cross-origin می‌تواند با کوکی نشستِ
    // ادمین فایل آپلود کند. مبدأ باید با host خودِ درخواست یکی باشد.
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host');
      let ok = false;
      try {
        ok = !!host && new URL(origin).host === host;
      } catch {
        ok = false;
      }
      if (!ok) return NextResponse.json({ error: 'forbidden origin' }, { status: 403 });
    }

    // FIX — Rate limit per-IP قبل از مصرف quota storage
    if (!uploadLimiter.check(ipKey(req.headers)).allowed) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const { supabase } = await requireAdmin();

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'missing file' }, { status: 400 });
    }
    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: 'unsupported type' }, { status: 415 });
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'invalid size (max 2MB)' }, { status: 413 });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_IMAGE_BUCKET ?? 'article-images';
    // نام فایل کاملاً سروری → هیچ user-controlled path وارد storage نمی‌شود
    // FIX (SECURITY): پیشوند تصادفی با crypto.randomUUID (CSPRNG) — Math.random
    // قابل پیش‌بینی است و مهاجم می‌توانست کلیدهای بعدی آپلود را حدس بزند
    // (enumeration/overwrite attempt). randomUUID در Node 18+ و مرورگرها موجود است.
    const rand =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        : (() => {
            const bytes = new Uint8Array(12);
            globalThis.crypto.getRandomValues(bytes);
            return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
          })();
    const key = `covers/${Date.now().toString(36)}-${rand}.${ext}`;

    const buf = Buffer.from(await file.arrayBuffer());
    // FIX — Content-Type اعلامی کلاینت قابل اعتماد نیست (یک .php/HTML با
    // header جعلی رد می‌شد). امضای بایتی (magic bytes) واقعی فایل چک می‌شود؛
    // SVG عمداً مجاز نیست (XSS روی دامنه استوریج).
    if (!sniffImageType(buf)) {
      return NextResponse.json({ error: 'file content is not a supported image' }, { status: 415 });
    }
    const { error } = await supabase.storage.from(bucket).upload(key, buf, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: 'storage upload failed' }, { status: 502 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(key);
    return NextResponse.json({ url: data.publicUrl });
  } catch {
    // requireAdmin روی خطا redirect می‌کند؛ اینجا فقط خطاههای غیرمنتظره را می‌گیریم
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
