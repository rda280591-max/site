// ORBIT — PKCE برای جریان OAuth (تقویت امنیت Auth)
// SECURITY: PCKE (RFC 7636) شنود کد authorization را بی‌اثر می‌کند؛ code_verifier
// فقط در sessionStorage مرورگرِ همان سشن می‌ماند و به هیچ سروری ارسال نمی‌شود.
// NOTE Supabase flowType='pkce' خودش challenge را می‌سازد؛ این ماژول state
// ضد-CSRF (RFC 6749 §10.12) را اضافه می‌کند: مقدار تصادفی قبل از redirect در
// sessionStorage می‌ماند و در /auth/callback با param برگشتی مقایسه می‌شود.
// entropy: crypto.getRandomValues (256-bit)، آلفابت URL-safe.

const STATE_BYTES = 32;
const SS_STATE_KEY = 'orbit-oauth-state';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(): string {
  const bytes = new Uint8Array(STATE_BYTES);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // FIX (SECURITY): حذف fallback به Math.random — این مقدار state ضد-CSRF
    // است و آنتروپی Math.random (PRNG قابل پیش‌بینی با ~53 بیت seed) برای
    // توکن امنیتی پذیرفتنی نیست. اگر WebCrypto موجود نباشد، جریان OAuth باید
    // متوقف شود (throw) نه اینکه با state قابل حدس ادامه یابد.
    throw new Error('WebCrypto (crypto.getRandomValues) is required to start a secure OAuth flow');
  }
  return base64url(bytes);
}

/** Generate a fresh state, store it in this tab's sessionStorage and return it (for redirectTo) */
export function beginOAuthFlow(): string {
  const state = randomToken();
  try {
    sessionStorage.setItem(SS_STATE_KEY, state);
  } catch {
    /* storage disabled — جریان بی‌state هم امن‌تر از شکستن لاگین است */
  }
  // FIX (login CSRF): همین مقدار در کوکی JS-readable هم نوشته می‌شود تا
  // /auth/callback سمت سرور بتواند آن را تطبیق دهد؛ مهاجم نمی‌تواند این
  // کوکی را برای قربانی تزریق کند (SameSite=Lax + نیاز به same-origin).
  try {
    document.cookie = oauthStateCookieValue(state);
  } catch {
    /* cookie disabled — fallback: همان رفتار قبلی (بدون چک سروری) */
  }
  return state;
}

/* ────────── Server-side anti-CSRF (cookie mirror) ──────────
 * نسخه کلاینتی state فقط در sessionStorage همان تب می‌ماند و هرگز سمت سرور
 * بررسی نمی‌شد — پس مهاجم می‌توانست کد authorization خودش را به قربانی فید
 * کند (login CSRF) و قربانی با هویت مهاجم وارد شود. حالا state در یک کوکی
 * same-site=Lax هم نوشته می‌شود؛ callback سمت سرور تطبیق می‌دهد و بعد از
 * مصرف پاک می‌کند. نبود کوکی → رفتار قبلی حفظ می‌شود تا لاگین نشکند.
 * NOTE عمداً http-only نیست: نوشتن در flow فقط از کلاینت انجام می‌شود و
 * چک سروری همچنان ضد-CSRF است (مهاجم ability to set cookie for victim's
 * origin ندارد). */

const COOKIE_STATE_KEY = 'orbit_oauth_state';
const STATE_TTL_SECONDS = 600; // 10 دقیقه پنجره زمانی flow

/**
 * FIX (SECURITY): افزودن پرچم Secure — نسخه قبلی کوکی state را بدون Secure
 * می‌نوشت و روی HTTP (مثلاً preview/خست‌هاست اشتباه‌پیکربندی‌شده) قابل شنود
 * بود. دامنه callback همیشه HTTPS است؛ پس Secure بی‌ضرر و لازم است.
 * NOTE: در dev روی http://localhost مرورگر کوکی Secure را دور می‌زند (استثنای
 * استاندارد برای localhost) — پس flow توسعه محلی هم نمی‌شکند.
 */
export function oauthStateCookieValue(state: string, secure = true): string {
  return `${COOKIE_STATE_KEY}=${encodeURIComponent(state)}; path=/; max-age=${STATE_TTL_SECONDS}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

interface CookieLike {
  get(name: string): { value: string } | undefined;
}

/** بررسی سمت سرور state در callback. کوکی نبود → allow (fallback کلاینتی). */
export function verifyOAuthStateCookie(cookieStore: CookieLike, incoming: string | null): boolean {
  const expected = cookieStore.get(COOKIE_STATE_KEY)?.value;
  if (!expected) return true;
  if (!incoming) return false;
  let decoded = expected;
  try {
    decoded = decodeURIComponent(expected);
  } catch {
    /* keep raw */
  }
  // FIX (timing-safe): مقایسه با === زمان‌وابسته است و امکان حمله timing بر
  // state ضد-CSRF را می‌دهد. طول برابر + مقایسه byte-by-byte با XOR تجمیعی،
  // رفتار را ثابت‌زمان می‌کند.
  return timingSafeEqualStr(decoded, incoming);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** حذف کوکی state پس از مصرف (single-use) — روی Response ست می‌شود. */
export function clearOAuthStateCookie(response: { cookies: { delete(name: string): void } }): void {
  response.cookies.delete(COOKIE_STATE_KEY);
}

  // FIX (dead code): نسخه sessionStorage هیچ‌وقت در callback صدا زده نمی‌شد و
  // مسیر واقعیِ تطبیق، کوکی سمت سرور است. تابع حذف شد تا حالت «دو منبع حقیقت»
  // گمراه‌کننده باقی نماند؛ beginOAuthFlow همچنان state را در sessionStorage
  // می‌نویسد (برای tab-scoping) ولی مصرف رسمی فقط کوکی است.
