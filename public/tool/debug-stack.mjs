import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://localhost:3000';

const port = await new Promise((res) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--no-sandbox',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break;
  } catch { }
  await sleep(100);
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res) => { ws.onopen = res; });

let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  const handler = (e) => {
    const m = JSON.parse(e.data);
    if (m.id === n) {
      ws.removeEventListener('message', handler);
      if (m.error) {
        rej(m.error);
      } else {
        res(m.result);
      }
    }
  };
  ws.addEventListener('message', handler);
  ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable');
await send('Network.enable');

ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Network.webSocketFrameReceived') {
    const payload = m.params.response.payloadData;
    if (payload.includes('reloadPage') || payload.includes('TurbopackInternalError')) {
      console.log('FULL ERROR PAYLOAD:');
      console.log(payload);
    }
  }
});

await send('Page.navigate', { url: `${APP}/en/login` });
await sleep(4000);

ws.close();
chrome.kill();
