// ابزار موقتی برای بررسی رفتار مسیریابی زبان (فقط توسعه، بعداً حذف می‌شود).
const B = 'http://localhost:3000';

const cases = [
  { label: 'no-cookie + Accept-Language:fa  GET /', url: `${B}/`, headers: { 'accept-language': 'fa-IR,fa;q=0.9' } },
  { label: 'no-cookie                        GET /news', url: `${B}/news`, headers: { 'accept-language': 'fa-IR,fa;q=0.9' } },
  { label: 'no-cookie                        GET /settings', url: `${B}/settings` },
  { label: 'cookie:fa                        GET /', url: `${B}/`, headers: { cookie: 'ORBIT_LOCALE=fa' } },
  { label: 'cookie:fa                        GET /notes', url: `${B}/notes`, headers: { cookie: 'ORBIT_LOCALE=fa' } },
  { label: 'cookie:fa                        GET /settings', url: `${B}/settings`, headers: { cookie: 'ORBIT_LOCALE=fa' } },
  { label: 'cookie:fa                        GET /fa/notes', url: `${B}/fa/notes`, headers: { cookie: 'ORBIT_LOCALE=fa' } },
  { label: 'cookie:bogus                     GET /', url: `${B}/`, headers: { cookie: 'ORBIT_LOCALE=xx' } },
];

for (const c of cases) {
  const res = await fetch(c.url, { redirect: 'manual', headers: c.headers });
  const loc = res.headers.get('location');
  console.log(`${c.label}  ->  ${res.status} ${loc ? decodeURIComponent(loc) : '(no redirect)'}`);
}

// کوکی زبان هم باید روی پاسخ ست شود (فقط وقتی زبان انتخابی کاربر ثبت‌شده باشد).
const withCookie = await fetch(`${B}/`, { redirect: 'manual', headers: { cookie: 'ORBIT_LOCALE=fa' } });
console.log('\nset-cookie on / with ORBIT_LOCALE=fa:', withCookie.headers.getSetCookie());