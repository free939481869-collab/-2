import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './Button';
import {
  uicheckBuild,
  uicheckBuildStatus,
  uicheckHealth,
  UicheckBuildBody,
} from '../services/uicheckService';

const POLL_MS = 5000;

function isUicheckPermissionError(msg: string): boolean {
  return (
    msg.includes('403') ||
    msg.includes('[403]') ||
    msg.includes('无权限访问接口')
  );
}

function permissionDeniedHelp(): string {
  return [
    '403：当前 Token 在网关上无权调用 /UICheck/build（与请求体字段是否正确无关）。',
    '请在 Omnibus/MTAT 为应用或账号开通 UICheck 接口权限，或换已授权 Token；确认 VPN/环境与文档一致。',
    '顶部「检查代理」会显示 Token 末四位，请与控制台密钥核对。',
  ].join('\n');
}

export function UicheckPanel() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<string>('');
  const [projectId, setProjectId] = useState('29');
  const [pkgUid, setPkgUid] = useState('97485');
  const [pkgVariant, setPkgVariant] = useState('setup64Release');
  const [cmdsText, setCmdsText] = useState(
    '打开相机拍照，保存图片|camera\n美图秀秀-美化美容 / 人像美容 / 丰盈提拉 / 面部丰盈_素材未选中|面部丰盈_素材未选中'
  );
  const [deviceId, setDeviceId] = useState('0');
  const [requestId, setRequestId] = useState('');
  const [lastStatus, setLastStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const parseCmds = (raw: string): Array<{ cmd: string; imgName: string }> => {
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const sep = line.lastIndexOf('|');
        if (sep <= 0 || sep >= line.length - 1) return null;
        const cmd = line.slice(0, sep).trim();
        const imgName = line.slice(sep + 1).trim();
        if (!cmd || !imgName) return null;
        return { cmd, imgName };
      })
      .filter((v): v is { cmd: string; imgName: string } => Boolean(v));
  };

  const refreshHealth = useCallback(async () => {
    try {
      const h = await uicheckHealth();
      if (!h.hasToken) {
        setHealth('代理已启动但未配置 OMNIBUS_ACCESS_TOKEN');
        return;
      }
      const bits: string[] = [`代理就绪 · 网关 ${h.gatewayBase}`];
      const tail = h.tokenTail;
      if (typeof tail === 'string' && tail.length > 0) {
        bits.push(`Token 末位 …${tail}（与 Omnibus 密钥末尾核对）`);
      } else if (typeof h.tokenLength === 'number' && h.tokenLength > 0) {
        bits.push(`Token 长度 ${h.tokenLength}（未返回末位片段时请重启终端里的 uicheck-proxy）`);
      }
      setHealth(bits.join(' · '));
    } catch (e) {
      setHealth(
        e instanceof Error
          ? `无法连接代理: ${e.message}（请先 npm run dev，会同时启动 uicheck-proxy）`
          : '健康检查失败'
      );
    }
  }, []);

  useEffect(() => {
    if (open) void refreshHealth();
  }, [open, refreshHealth]);

  const handleSubmit = async () => {
    const cmds = parseCmds(cmdsText);
    const pid = Number(projectId);
    if (!Number.isFinite(pid) || !pkgUid || !pkgVariant || cmds.length === 0) {
      setLastStatus(
        '请填写 projectId（数字）、pkgUid、pkgVariant，并按 “cmd|imgName” 格式至少填写一行 cmds（与文档一致）'
      );
      return;
    }
    const body: UicheckBuildBody = {
      side: 2,
      projectId: pid,
      pkgUid,
      pkgVariant,
      cmds,
      deviceId: Number(deviceId) || 0,
    };
    setLoading(true);
    setLastStatus('');
    try {
      const data = await uicheckBuild(body);
      const rid = (() => {
        if (!data || typeof data !== 'object') return '';
        const top = (data as { requestId?: unknown }).requestId;
        if (typeof top === 'string') return top;
        if (typeof top === 'number') return String(top);
        const nested = (data as { response?: { requestId?: unknown } }).response?.requestId;
        if (typeof nested === 'string') return nested;
        if (typeof nested === 'number') return String(nested);
        return '';
      })();
      if (rid) setRequestId(rid);
      setLastStatus(JSON.stringify(data, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastStatus(
        isUicheckPermissionError(msg) ? permissionDeniedHelp() : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const pollOnce = async () => {
    if (!requestId.trim()) {
      setLastStatus('请先提交 build 拿到 requestId');
      return;
    }
    setLoading(true);
    try {
      const data = await uicheckBuildStatus(requestId.trim());
      setLastStatus(JSON.stringify(data, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastStatus(
        isUicheckPermissionError(msg) ? permissionDeniedHelp() : msg
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!polling || !requestId.trim()) return;
    const t = window.setInterval(() => {
      void uicheckBuildStatus(requestId.trim())
        .then((data) => setLastStatus(JSON.stringify(data, null, 2)))
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          setLastStatus(
            isUicheckPermissionError(msg) ? permissionDeniedHelp() : msg
          );
        });
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [polling, requestId]);

  return (
    <section className="mt-10 border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-left font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
      >
        <span>UICheck 验收接入（异步构建 / 轮询状态）</span>
        <span className="text-gray-400 text-sm">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-0 space-y-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">{health || '加载中…'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-gray-600">projectId</span>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="必填"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600">pkgUid</span>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={pkgUid}
                onChange={(e) => setPkgUid(e.target.value)}
                placeholder="必填"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600">pkgVariant</span>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={pkgVariant}
                onChange={(e) => setPkgVariant(e.target.value)}
                placeholder="必填"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600">deviceId</span>
              <input
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">cmds（每行 `cmd|imgName`）</span>
            <textarea
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono min-h-[100px]"
              value={cmdsText}
              onChange={(e) => setCmdsText(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              示例：打开相机拍照，保存图片|camera
            </p>
          </label>
          <div className="flex flex-wrap gap-3 items-center">
            <Button type="button" onClick={() => void refreshHealth()} variant="secondary">
              检查代理
            </Button>
            <Button type="button" onClick={handleSubmit} isLoading={loading}>
              提交 build
            </Button>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="text"
                className="px-2 py-1 rounded border border-gray-200 w-48 text-xs font-mono"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
                placeholder="requestId"
              />
            </label>
            <Button type="button" onClick={() => void pollOnce()} variant="secondary" disabled={loading}>
              查询一次状态
            </Button>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={polling}
                onChange={(e) => setPolling(e.target.checked)}
              />
              每 {POLL_MS / 1000}s 自动轮询
            </label>
          </div>
          {lastStatus && (
            <pre
              className={`text-xs rounded-xl p-4 overflow-auto max-h-64 whitespace-pre-wrap ${
                lastStatus.includes('无权调用 /UICheck/build')
                  ? 'bg-amber-50 border border-amber-200 text-amber-950'
                  : 'bg-gray-50 border border-gray-100 text-gray-800'
              }`}
            >
              {lastStatus}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
