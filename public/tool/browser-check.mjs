// بررسی مرورگری بدون Playwright: کروم نصب‌شده روی سیستم را headless اجرا می‌کنیم
// و از طریق CDP همان سناریوی سوییچ زبان را می‌سنجیم.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
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

const profile = mkdtempSync(join(tmpdir(), 'orbit-cdp-'))
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--lang=fa-IR',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const reachable = async () => {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`)
    return r.ok
  } catch {
    return false
  }
}
for (let i = 0; i < 100 && !(await reachable()); i++) await sleep(100)

// --- CDP plumbing -----------------------------------------------------------
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const target = targets.find((t) => t.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
const events = []
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) {
      rej(new Error(JSON.stringify(msg.error)))
    } else {
      res(msg.result)
    }
  } else if (msg.method) {
    events.push(msg)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}

/** منتظر می‌ماند تا شرط در صفحه برقرار شود. */
const waitFor = async (expression, timeout = 15000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return true
    await sleep(150)
  }
  return false
}

const goto = async (url) => {
  events.length = 0
  await send('Page.navigate', { url })
  await waitFor('document.readyState === "complete"', 15000)
  await waitFor('(document.body.innerText || "").trim().length > 0', 20000)
  await sleep(600)
}

const snapshot = async () => ({
  path: decodeURIComponent(await evaluate('location.pathname')),
  htmlLang: await evaluate('document.documentElement.lang'),
  htmlDir: await evaluate('document.documentElement.dir'),
  cookies: await evaluate('document.cookie'),
  heading: (await evaluate('(document.querySelector("h1")||{}).innerText || ""')).trim(),
})

const toggleInfo = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => /تغییر زبان|Switch language/.test(x.getAttribute('aria-label') || ''));
  return b ? { label: b.getAttribute('aria-label'), text: b.innerText.trim(), dir: b.dir, lang: b.lang } : null;
})()`
const clickToggle = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => /تغییر زبان|Switch language/.test(x.getAttribute('aria-label') || ''));
  if (!b) return false;
  b.click();
  return true;
})()`

const results = {}

// ---- 1) پیش‌فرض: مرورگر فارسی است، ولی سایت باید انگلیسی بماند ----
await goto(`${APP}/`)
results['1_default_no_cookie'] = await snapshot()

// ---- 2) با کوکی فارسی: مسیر بدون پیشوند باید به /fa/تنظیمات برود ----
await evaluate(`document.cookie = 'ORBIT_LOCALE=fa; path=/; max-age=31536000'`)
await goto(`${APP}/settings`)
results['2_fa_cookie_settings'] = await snapshot()

// ---- 3) دکمه‌ی سوییچ در /fa/ورود ----
await goto(`${APP}/login`)
results['3_toggle_before'] = {
  ...(await snapshot()),
  toggle: await evaluate(toggleInfo),
}

results['3_clicked'] = await evaluate(clickToggle)
results['3_navigated_to_en'] = await waitFor('location.pathname.startsWith("/en")', 15000)
await sleep(1500)
results['4_after_switch_to_en'] = {
  ...(await snapshot()),
  toggle: await evaluate(toggleInfo),
}

// ---- 5) بازگشت به فارسی ----
await evaluate(clickToggle)
results['5_navigated_to_fa'] = await waitFor('location.pathname.startsWith("/fa")', 15000)
await sleep(1500)
results['5_back_to_fa'] = {
  ...(await snapshot()),
  toggle: await evaluate(toggleInfo),
}

// ---- 6) مسیر محافظت‌شده‌ی داشبورد (بدون نشست → login) ----
await goto(`${APP}/en/settings`)
results['6_dashboard_no_session'] = await snapshot()

results.consoleErrors = [
  ...new Set(
    events
      .filter((e) => e.method === 'Runtime.exceptionThrown')
      .map((e) => (e.params.exceptionDetails?.text ?? '').slice(0, 160))
  ),
]

console.log(JSON.stringify(results, null, 2))

ws.close()
chrome.kill()
await sleep(300)
try { rmSync(profile, { recursive: true, force: true }) } catch {}