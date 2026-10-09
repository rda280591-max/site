// بررسی مرورگری: (۱) حلقه‌ی رفرش رفع شده؟ (۲) در /en هیچ متن فارسی نمانده؟
// با کروم نصب‌شده + CDP کار می‌کند (بدون Playwright).
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://localhost:3000'

const port = await new Promise((res) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port
    s.close(() => res(p))
  })
})
const profile = mkdtempSync(join(tmpdir(), 'orbit-verify-'))
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--lang=fa-IR',
  '--window-size=1280,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break
  } catch {}
  await sleep(100)
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 0
const pending = new Map()
const events = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    if (m.error) {
      rej(new Error(JSON.stringify(m.error)))
    } else {
      res(m.result)
    }
  } else if (m.method) events.push(m)
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) {
    throw new Error(
      `evaluate failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n` +
        `expression: ${String(expression).slice(0, 200)}`
    )
  }
  return r.result.value
}

/**
 * در میانه‌ی ناوبری، document.body لحظه‌ای null است؛ پس expression باید بدون
 * exception مقدار false بدهد تا waitFor واقعاً «صبر» کند نه اینکه کرش کند.
 */
const waitFor = async (expr, timeout = 20000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await evaluate(expr)) return true
    } catch {
      // در حال گذار بین دو صفحه‌ایم؛ دوباره امتحان کن.
    }
    await sleep(150)
  }
  return false
}

const persianLeftovers = async () => {
  const raw = await evaluate(
    `JSON.stringify((document.body.innerText || '').match(/[\\u0600-\\u06FF]+/g) || [])`
  )
  return [...new Set(JSON.parse(raw || '[]'))].slice(0, 25)
}

// یک بار در ابتدا سنجیده می‌شود تا اگر خودِ عبارت شکسته باشد، همین‌جا لو برود.
console.log('persianLeftovers self-test:', JSON.stringify(await persianLeftovers()))

const consoleProblems = () =>
  events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => (e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text ?? '').slice(0, 300))

/**
 * مهلت می‌دهد و برمی‌گرداند که «آیا صفحه در این مدت بارگذاری مجدد داشته».
 * معیار عملی حلقه‌ی رفرش همین است: در حالت idle نباید بارگذاری تازه‌ای بیاید.
 */
const reloadsWhileIdle = async (ms = 2500) => {
  const before = events.filter((e) => e.method === 'Page.loadEventFired').length
  await sleep(ms)
  return events.filter((e) => e.method === 'Page.loadEventFired').length - before
}

const results = {}

// ---------- ۱) صفحه‌ی انگلیسی ورود: هیچ فارسی نباید بماند ----------
// شماره‌ی گذرهای DOM و بارگذاری‌های سند را دقیق می‌شمریم تا «حلقه» از «چند درخواست مجاز» جدا شود.
await evaluate(`window.__navCount = 0`)
events.length = 0
const t0 = Date.now()
await send('Page.navigate', { url: `${APP}/en/login` })
await waitFor('document.readyState === "complete"', 15000)
await waitFor('(document.body.innerText || "").trim().length > 0', 20000)
await sleep(1500)
const navEvents = events.filter(
  (e) => e.method === 'Page.frameNavigated' && e.params?.frame?.parentId === undefined
)
results['1_login_en'] = {
  path: decodeURIComponent(await evaluate('location.pathname')),
  elapsedMs: Date.now() - t0,
  loadEvents: events.filter((e) => e.method === 'Page.loadEventFired').length,
  navigationEvents: navEvents.length,
  navigationUrls: navEvents.map((n) => decodeURIComponent(n.params.frame.url)),
}
results['1_login_en_html'] = {
  lang: await evaluate('document.documentElement.lang'),
  dir: await evaluate('document.documentElement.dir'),
}
results['1_login_en_persian'] = await persianLeftovers()
results['1_login_en_reloadsWhileIdle'] = await reloadsWhileIdle()
writeFileSync('tool/shots/verify-login-en.png',
  Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

// ---------- ۲) داشبورد محافظت‌شده بدون نشست: باید یک‌بار به /en/login برود، نه حلقه ----------
events.length = 0
await send('Page.navigate', { url: `${APP}/en/settings` })
await sleep(4000)
const navs = events
  .filter((e) => e.method === 'Page.frameNavigated' && e.params?.frame?.parentId === undefined)
  .map((e) => e.params.frame.url)
const loads = events.filter((e) => e.method === 'Page.loadEventFired').length
results['2_guard'] = {
  finalPath: decodeURIComponent(await evaluate('location.pathname')),
  navigations: navs.map((u) => decodeURIComponent(u)),
  navigationCount: navs.length,
  loadEvents: loads,
  stillChanging: await (async () => {
    const before = decodeURIComponent(await evaluate('location.pathname'))
    await sleep(2500)
    return before !== decodeURIComponent(await evaluate('location.pathname'))
  })(),
}

// ---------- ۳) با کوکی fa روی /login ----------
// مسیر بدون پیشوند + کوکی fa باید به /fa/ورود برود (و پیش‌فرض بدون کوکی: en).
await evaluate(`document.cookie = 'ORBIT_LOCALE=fa; path=/; max-age=31536000'`)
events.length = 0
const t3 = Date.now()
await send('Page.navigate', { url: `${APP}/login` })
await waitFor('document.readyState === "complete"', 15000)
await waitFor('(document.body.innerText || "").trim().length > 0', 20000)
await sleep(3000)
const faLoginNavs = events.filter(
  (e) => e.method === 'Page.frameNavigated' && e.params?.frame?.parentId === undefined
)
results['3_login_fa'] = {
  finalPath: decodeURIComponent(await evaluate('location.pathname')),
  elapsedMs: Date.now() - t3,
  loadEvents: events.filter((e) => e.method === 'Page.loadEventFired').length,
  navigationEvents: faLoginNavs.length,
  navigationUrls: faLoginNavs.map((n) => decodeURIComponent(n.params.frame.url)),
  // اگر واقعاً لوپ باشد، در این ۲ ثانیه هم شماره‌ی بارگذاری بالا می‌رود.
  loadEventsAfterIdle: await (async () => {
    const before = events.filter((e) => e.method === 'Page.loadEventFired').length
    await sleep(2000)
    return (
      events.filter((e) => e.method === 'Page.loadEventFired').length - before
    )
  })(),
}
results['3_login_fa_persian_sample'] = (await persianLeftovers()).slice(0, 6)
results['3_login_fa_reloadsWhileIdle'] = await reloadsWhileIdle()

// ---------- ۴) گارد روی /fa/settings: باز هم باید یک‌بار هدایت شود ----------
events.length = 0
await send('Page.navigate', { url: `${APP}/fa/settings` })
await sleep(4000)
const faNavs = events
  .filter((e) => e.method === 'Page.frameNavigated' && e.params?.frame?.parentId === undefined)
  .map((e) => e.params.frame.url)
results['4_guard_fa'] = {
  finalPath: decodeURIComponent(await evaluate('location.pathname')),
  navigationCount: faNavs.length,
  navigations: faNavs.map((u) => decodeURIComponent(u)),
}

results['4_guard_fa_reloadsWhileIdle'] = await reloadsWhileIdle()

results.consoleErrors = [...new Set(consoleProblems())]

console.log(JSON.stringify(results, null, 2))

ws.close()
chrome.kill()
await sleep(300)
try { rmSync(profile, { recursive: true, force: true }) } catch {}