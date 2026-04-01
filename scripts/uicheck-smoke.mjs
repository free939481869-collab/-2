/**
 * 按 UICheck-api.md 文档组装的示例请求（经本地代理，Token 读 .env.local）。
 *
 * 用法：
 *   1) 终端一：npm run dev:proxy
 *   2) 终端二：npm run uicheck:smoke
 *
 * 或直接调网关（需本机可访问内网且已 export OMNIBUS_ACCESS_TOKEN）：
 *   UICHECK_SMOKE_URL=https://connectors.meitu-int.com/gateway/api.mtatpro.meitu-int.com npm run uicheck:smoke
 *   （第二种方式需在请求里带 Authorization，本脚本仅演示经代理的无 Token 调用）
 */

import { config } from 'dotenv';

config();
config({ path: '.env.local', override: true });

const base = (process.env.UICHECK_SMOKE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

const body = {
  side: 2,
  projectId: 29,
  pkgUid: '97485',
  pkgVariant: 'setup64Release',
  cmds: [
    { cmd: '打开相机拍照，保存图片', imgName: 'camera' },
    {
      cmd: '美图秀秀-美化美容 / 人像美容 / 丰盈提拉 / 面部丰盈_素材未选中',
      imgName: '面部丰盈_素材未选中',
    },
  ],
  deviceId: 0,
};

const url = `${base}/api/uicheck/build`;
console.log('POST', url);

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const text = await r.text();
console.log('HTTP', r.status);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
