import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * ORBIT — پیکربندی Next.js
 *
 * پلاگین next-intl به‌طور پیش‌فرض به «./src/i18n/request.ts» نگاه می‌کند؛
 * مسیر را صریح می‌دهیم تا اگر ساختار پوشه‌ها عوض شد، قطع نشود.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * SECURITY — هدرهای امنیتی سطح-ترانسپورت
 * روی همه پاسخ‌ها (شامل static assets) اعمال می‌شوند؛ Vercel/CDN هم این‌ها را
 * پاس‌_through می‌کند. referrer-policy و X-Frame-Options برای لاگین Supabase
 * مهم‌اند.
 *
 * NOTE — script-src 'unsafe-inline': این پروژه روی Vercel/edge اجرا می‌شود که
 * rewrite هدر CSP با placeholder nonce را پشتیبانی نمی‌کند (nonce واقعی باید
 * در زمان رندر تزریق شود). تا زمانی که nonce سرتاسری پیاده نشده، الگوی رسمی
 * Next.js ترکیب unsafe-inline + strict-dynamic است: اسکریپت‌های ثالثی که با
 * attribute nonce بارگذاری می‌شوند allowlist را دور می‌زنند و بقیه inline
 * فقط وقتی مجازند که یک اسکریپت nonce‌دار آن‌ها را تزریق کند.
 * توجه: تمام dangerouslySetInnerHTML این سایت ثابت‌های compile-time هستند
 * (theme-script، انیمیشن، JSON-LD) — هیچ ورودی کاربر داخلشان نمی‌رود.
 */
// PERF/FIX — ریشه‌ی «صفحه خالی بنفش-سیاه» روی Vercel:
// نسخه قبلی script-src فقط بر پایه دو SHA-256 ثابت بود؛ اما Next.js/Turbopack
// در production چند inline script متغیر هم به HTML تزریق می‌کند (pushهای
// self.__next_f برای hydration/RSC، requestAnimationFrame ری اکشن‌بندینگ و...).
// این اسکریپت‌ها مسدود می‌شدند → HTML سرور داخل <div hidden> می‌ماند، هیچ JS
// hydrate نمی‌کرد و کاربر فقط پس‌زمینه نئونی body را می‌دید.
// الگوی رسمی Next.js وقتی nonce سرتاسری ممکن نیست (edge rewrite بدون nonce
// واقعی)، ترکیب unsafe-inline + strict-dynamic است: اسکریپت‌های ثالثِ nonceدار
// allowlist را دور می‌زنند و inlineها فقط با حضور یک اسکریپت nonceدار مجازند.
// NOTE تمام dangerouslySetInnerHTML این سایت ثابت compile-time هستند (theme،
// انیمیشن، JSON-LD escape‌شده) — ورودی کاربر داخلشان نمی‌رود.
// FIX — حذف 'strict-dynamic': طبق CSP3، وقتی strict-dynamic (یا nonce) در
// script-src حضور دارد، کل source-list از جمله 'unsafe-inline' و hashها
// نادیده گرفته می‌شوند. نسخه قبلی به همین دلیل حتی theme-script مجاز را هم
// بلاک می‌کرد. الگوی صحیحِ بدون-nonce: self + unsafe-inline.
const CSP_SCRIPT_SRC =
  "script-src 'self' 'unsafe-inline'";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  CSP_SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // connect-src: Supabase (auth + rest realtime) + خودِ origin (api/rss)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // frame-src: امبد YouTube/Vimeo در کارت‌های ویدیوی اخبار
  "frame-src 'self' https://www.youtube.com https://player.vimeo.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// گزارش‌دهی: نسخه سخت‌گیرانه‌تر (بدون unsafe-inline) فقط Report-Only منتشر می‌شود
// تا نقض‌های بالقوه در DevTools دیده شوند، بدون آنکه هرگز صفحه را بشکنند.
const CSP_STRICT_SCRIPT_SRC = "script-src 'self' 'strict-dynamic'";
const CSP_REPORT_ONLY = CSP_DIRECTIVES.replace(CSP_SCRIPT_SRC, CSP_STRICT_SCRIPT_SRC);

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
  // NOTE فعلاً report-only؛ برای فعال‌سازی سخت‌گیری واقعی باید nonce سرتاسری
  // (سرور Next به‌جای edge rewrite) پیاده شود تا inlineهای خود Next مجاز بمانند.
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // HSTS فقط معنادار روی HTTPS؛ بی‌ضرر در local (هدر نادیده گرفته می‌شود)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Reduce repeated work for packages that expose large entry points.
  experimental: {
    optimizePackageImports: ['next-intl'],
  },

  // Keep production output small; Next 16 already minifies with SWC.
  compress: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
