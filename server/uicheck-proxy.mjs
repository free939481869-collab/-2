/**
 * 本地 UICheck 网关代理：把 Bearer Token 留在服务端，前端只访问同源 /api/uicheck。
 *
 * 环境变量：
 * - OMNIBUS_ACCESS_TOKEN（必填）网关鉴权
 * - UICHECK_GATEWAY_BASE（可选）网关前缀，默认见下方
 * - UICHECK_PROXY_PORT（可选）默认 8787
 *
 * 在项目根目录使用 .env 或 .env.local（后者覆盖前者，与 Vite 一致）。
 */

import { config } from 'dotenv';
import http from 'http';
import { URL } from 'url';

config();
config({ path: '.env.local', override: true });

/** 去掉首尾空白、外层引号；若已含 `Bearer ` 前缀则剥掉，避免 `Bearer Bearer xxx`。 */
function normalizeOmnibusToken(raw) {
  if (raw == null || raw === '') return '';
  let t = String(raw).trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, '').trim();
  }
  return t;
}

const PORT = Number(process.env.UICHECK_PROXY_PORT || 8787);
const GATEWAY_BASE = (
  process.env.UICHECK_GATEWAY_BASE ||
  'https://connectors.meitu-int.com/gateway/api.mtatpro.meitu-int.com'
).replace(/\/$/, '');
const TOKEN = normalizeOmnibusToken(process.env.OMNIBUS_ACCESS_TOKEN);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

async function forward(path, init) {
  const url = `${GATEWAY_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }
  return fetch(url, { ...init, headers });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || 'localhost';
  const u = new URL(req.url || '/', `http://${host}`);

  try {
    if (u.pathname === '/api/uicheck/health' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      const tail =
        TOKEN.length > 0 ? TOKEN.slice(-4) : null;
      res.end(
        JSON.stringify({
          ok: true,
          hasToken: Boolean(TOKEN),
          tokenLength: TOKEN.length,
          /** 末至多 4 字符（短 Token 则不足 4 位），便于核对密钥 */
          tokenTail: tail,
          gatewayBase: GATEWAY_BASE,
          hint403:
            '若 POST /UICheck/build 返回 403「无权限访问接口」，说明当前 Bearer 在网关上未被授权访问该路径；需在 Omnibus/MTAT 侧为该应用或账号开通 UICheck 接口权限，或换用已授权 Token。与请求体字段无关。',
        })
      );
      return;
    }

    if (u.pathname === '/api/uicheck/build' && req.method === 'POST') {
      const body = await readBody(req);
      const r = await forward('/UICheck/build', { method: 'POST', body });
      const text = await r.text();
      if (r.status === 403 && !TOKEN) {
        console.warn(
          '[uicheck-proxy] 403 and OMNIBUS_ACCESS_TOKEN is empty — set .env.local'
        );
      } else if (r.status === 403) {
        console.warn(
          '[uicheck-proxy] 403 from gateway: token is set but not allowed for /UICheck/build — ask admin to grant UICheck API permission'
        );
      }
      const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
      res.writeHead(r.status, { 'Content-Type': ct });
      res.end(text);
      return;
    }

    const statusMatch = u.pathname.match(/^\/api\/uicheck\/buildStatus\/([^/]+)$/);
    if (statusMatch && req.method === 'GET') {
      const requestId = decodeURIComponent(statusMatch[1]);
      const r = await forward(`/UICheck/buildStatus/${encodeURIComponent(requestId)}`, {
        method: 'GET',
      });
      const text = await r.text();
      const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
      res.writeHead(r.status, { 'Content-Type': ct });
      res.end(text);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[uicheck-proxy] http://127.0.0.1:${PORT}`);
  console.log(`[uicheck-proxy] gateway: ${GATEWAY_BASE}`);
  console.log(`[uicheck-proxy] token: ${TOKEN ? 'set' : 'MISSING — set OMNIBUS_ACCESS_TOKEN'}`);
});
