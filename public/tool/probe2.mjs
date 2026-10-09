// عیب‌یابی: پاسخ سرور به /en/login و /login (با و بی کوکی) را دقیق نشان می‌دهد.
const B = 'http://localhost:3000'

const probe = async (label, url, headers = {}) => {
  const res = await fetch(url, { redirect: 'manual', headers })
  const body = await res.text()
  const title = body.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  const htmlLang = body.match(/<html[^>]*lang="([^"]*)"/)?.[1] ?? ''
  const hasBlockingScript = /themeScript|orbit-theme/.test(body)
  console.log(
    `${label}\n  status=${res.status} location=${res.headers.get('location') ?? '-'}` +
    `\n  x-nextjs-cache=${res.headers.get('x-nextjs-cache') ?? '-'}` +
    `\n  set-cookie=${JSON.stringify(res.headers.getSetCookie())}` +
    `\n  title=${JSON.stringify(title)} htmlLang=${htmlLang} themeScript=${hasBlockingScript}` +
    `\n  bytes=${body.length}`
  )
}

await probe('A) bare /login, no cookie', `${B}/login`)
await probe('B) bare /login, cookie=fa', `${B}/login`, { cookie: 'ORBIT_LOCALE=fa' })
await probe('C) /en/login', `${B}/en/login`)
await probe('D) /login with a stale NEXT_LOCALE=en cookie', `${B}/login`, {
  cookie: 'ORBIT_LOCALE=fa; NEXT_LOCALE=en',
})