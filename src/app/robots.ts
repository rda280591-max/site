import type { MetadataRoute } from 'next';

/**
 * ORBIT — robots.txt (SEO + Agentic Browsing)
 /* All public pages are indexed; service routes (auth/api/_next) are closed.
 *
 * FIX — Agentic Browsing (1/2 → 2/2): ربات‌های هوش مصنوعی (GPTBot، ClaudeBot،
 * PerplexityBot و…) باید بتوانند محتوای عمومی را بخوانند؛ مسدود کردن آن‌ها
 * باعث می‌شد بررسی «AI crawls allowed» در Lighthouse رد شود. یک قانون صریح و
 * اجازه‌محور برای user-agent های AI اضافه شد (کلاینت‌ها فقط /login و /auth را
 * نمی‌بینند؛ بقیه صفحات عمومی است).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fdgneg.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/auth/', '/api/', '/_next/', '/login', '/ورود'],
      },
      {
        // Agentic browsing: explicit AI-bot access to public content
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'PerplexityBot',
          'Google-Extended',
          'CCBot',
          'Bytespider',
        ].join(','),
        allow: '/',
        disallow: ['/auth/', '/api/', '/login', '/ورود'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
