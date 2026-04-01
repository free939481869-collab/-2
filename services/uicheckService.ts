/**
 * UICheck：经 Vite 代理到本地 server/uicheck-proxy.mjs，勿在浏览器存放 Token。
 */

const BASE = '/api/uicheck';

export interface UicheckBuildBody {
  side: 2;
  projectId: number;
  pkgUid: string;
  pkgVariant: string;
  cmds: Array<{
    cmd: string;
    imgName: string;
  }>;
  deviceId: number;
  /** 文档 curl 示例未包含；若你们网关仍要求再传 */
  sourceBuildId?: string;
  callback_url?: string;
}

function gatewayErrorMessage(data: unknown, text: string, status: number): string {
  if (typeof data === 'object' && data !== null) {
    const o = data as { msg?: unknown; code?: unknown; error?: unknown };
    if (o.msg != null) {
      const code = o.code != null ? `[${o.code}] ` : '';
      return `${code}${String(o.msg)}`;
    }
    if (o.error != null) return String(o.error);
  }
  return text || `HTTP ${status}`;
}

/** 文档约定成功为 `code: 200`；部分网关用 HTTP 200 承载业务错误，需与 HTTP 状态一并判断 */
function assertGatewayBusinessOk(data: unknown, text: string, httpStatus: number): void {
  if (typeof data !== 'object' || data === null) return;
  const o = data as { code?: unknown };
  if (o.code === undefined) return;
  const ok = o.code === 200 || o.code === '200';
  if (!ok) {
    throw new Error(gatewayErrorMessage(data, text, httpStatus));
  }
}

export async function uicheckHealth(): Promise<{
  ok: boolean;
  hasToken: boolean;
  gatewayBase: string;
  tokenLength?: number;
  tokenTail?: string | null;
  hint403?: string;
}> {
  const res = await fetch(`${BASE}/health`, { cache: 'no-store' });
  const data = (await res.json()) as {
    ok: boolean;
    hasToken: boolean;
    gatewayBase: string;
    tokenLength?: number;
    tokenTail?: string | null;
    hint403?: string;
  };
  if (!res.ok) throw new Error(`health ${res.status}`);
  return data;
}

export async function uicheckBuild(body: UicheckBuildBody): Promise<unknown> {
  const res = await fetch(`${BASE}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(gatewayErrorMessage(data, text, res.status));
  }
  assertGatewayBusinessOk(data, text, res.status);
  return data;
}

export async function uicheckBuildStatus(requestId: string): Promise<unknown> {
  const enc = encodeURIComponent(requestId);
  const res = await fetch(`${BASE}/buildStatus/${enc}`);
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(gatewayErrorMessage(data, text, res.status));
  }
  assertGatewayBusinessOk(data, text, res.status);
  return data;
}
