// ORBIT — شناسای User-Agent ربات‌های معتبر هوش مصنوعی (فاز ۴ Agentic Browsing)
// SECURITY: این لیست فقط «سست‌تر کردن» شمارنده ریت‌لیمیت مجاز را محدود می‌کند؛
// هرگز احراز هویت/مسیر خصوصی را باز نمی‌کند. تطبیق روی substring کوچک‌نویس.

/** Lowercase tokens expected in a legitimate AI crawler's UA */
const AI_CRAWLER_TOKENS: readonly string[] = [
  'gptbot', // OpenAI (training/search crawl)
  'oai-searchbot',     // OpenAI search index
  'chatgpt-user', // live ChatGPT requests (Operator/Browsing)
  'openai', // fallback for older versions
  'claudebot',         // Anthropic crawl
  'claude-web',        // Claude web fetch
  'claude-user',       // Claude computer-use / browsing agent
  'anthropic-ai',      // API-side fetcher
  'perplexitybot',     // Perplexity crawl
  'perplexity-user', // live Perplexity request
  'google-extended',   // Gemini training opt-in crawler
  'googleother', // other Google services (e.g. Gemini fetch)
  'bytespider',        // ByteDance/TikTok
  'ccbot',             // Common Crawl
  'applebot-semantic', // Apple semantic index
] as const;

/**
 * آیا این User-Agent متعلق به یک ایجنت/کرالر AI شناخته‌شده است؟
 * @param ua هدر user-agent خام (یا null)
 */
export function isAiAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return AI_CRAWLER_TOKENS.some((token) => lower.includes(token));
}
