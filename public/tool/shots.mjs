// عکس‌برداری سریع از دو حالت زبان (بدون Playwright، با کروم نصب‌شده + CDP).
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const APP = 'http://localhost:3000'
const OUT = process.argv[2] ?? 'tool/shots'

const port = await new Promise((res) => {
  const s = createServer()
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port
    s.close(() => res(p))
  })
})
const profile = mkdtempSync(join(tmpdir(), 'orbit-shot-'))
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--lang=fa-IR',
  '--window-size=1280,860',
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
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
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
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 860,
  deviceScaleFactor: 1,
  mobile: false,
})

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result
    .value

const waitFor = async (expr, timeout = 20000) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(expr)) return true
    await sleep(150)
  }
  return false
}

const shot = async (file) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

// ۱) مسیر / بدون کوکی → باید /en برود (مرورگر fa است)
await send('Page.navigate', { url: `${APP}/` })
await waitFor('document.readyState === "complete"')
await waitFor('(document.body.innerText||"").trim().length > 0')
await sleep(1500)
console.log('en page:', await evaluate('location.pathname'))
console.log('shot:', await shot(join(OUT, 'login-en.png')))

// ۲) کوکی fa + /login → /fa/ورود و اسکرین‌شات دکمه‌ی فارسی
await evaluate(`document.cookie = 'ORBIT_LOCALE=fa; path=/; max-age=31536000'`)
await send('Page.navigate', { url: `${APP}/login` })
await waitFor('document.readyState === "complete"')
await waitFor('(document.body.innerText||"").trim().length > 0')
await sleep(1500)
console.log('fa page:', decodeURIComponent(await evaluate('location.pathname')))
console.log('shot:', await shot(join(OUT, 'login-fa.png')))

ws.close()
chrome.kill()
await sleep(300)
try { rmSync(profile, { recursive: true, force: true }) } catch { }