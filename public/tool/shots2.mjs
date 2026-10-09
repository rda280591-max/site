// بررسی دقیق‌تر: صفحه‌ها را می‌گیرد و متن‌های باقی‌مانده‌ی فارسی را لیست می‌کند.
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
const profile = mkdtempSync(join(tmpdir(), 'orbit-shot2-'))
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--lang=fa-IR',
  '--window-size=1400,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break
  } catch { }
  await sleep(100)
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 0
const pending = new Map()
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
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false })

const evaluate = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value

const waitFor = async (expr, timeout = 20000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try { if (await evaluate(expr)) return true } catch { }
    await sleep(150)
  }
  return false
}

const shot = async (file) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

const persian = async () => {
  const raw = await evaluate(
    `JSON.stringify([...new Set(((document.body.innerText||'').match(/[\\u0600-\\u06FF]+/g)||[]))])`
  )
  return JSON.parse(raw || '[]')
}

const visit = async (label, url, file) => {
  await send('Page.navigate', { url })
  await waitFor('document.readyState === "complete"')
  await waitFor('(document.body.innerText||"").trim().length > 0')
  await sleep(3500)
  const path = decodeURIComponent(await evaluate('location.pathname'))
  const fa = await persian()
  console.log(`\n=== ${label} ===\n  url  : ${url}\n  path : ${path}\n  fa   : ${JSON.stringify(fa)}`)
  if (file) console.log('  shot :', await shot(file))
}

// داشبورد انگلیسی بدون نشست → login. ولی برای دیدن ویجت‌ها به صفحه‌ی notes/settings می‌رویم
// که هم گارد دارند و هم بعد از hydrate رندر می‌شوند.
await visit('EN /en/login', `${APP}/en/login`, 'tool/shots/en-login.png')
await visit('EN /en/settings', `${APP}/en/settings`, 'tool/shots/en-settings.png')
await visit('EN /en/notes', `${APP}/en/notes`, 'tool/shots/en-notes.png')
await visit('EN /en/news', `${APP}/en/news`, 'tool/shots/en-news.png')
await visit('FA /fa/تنظیمات', `${APP}/fa/settings`, 'tool/shots/fa-settings.png')

ws.close()
chrome.kill()
await sleep(300)
try { rmSync(profile, { recursive: true, force: true }) } catch { }