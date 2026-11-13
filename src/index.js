import { FRONTEND_HTML } from './frontend.js';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { DurableObject } from 'cloudflare:workers';

// ... (保留之前的工具函数、DO 类、API 路由等所有逻辑) ...
// 为了节省篇幅，这里不重复列出全部后端代码。
// 请保留你刚才成功部署的、除了前端返回以外没有任何改动的 src/index.js。

// 只需确认入口文件底部是这样的：
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 👇 检查前端代码是否加载成功
    if (url.pathname === '/') {
      if (!FRONTEND_HTML) {
        return new Response('前端代码加载失败，请检查 src/frontend.js 是否正确导出。', { status: 500 });
      }
      return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (url.pathname === '/qq-webhook') return handleQQWebhook(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url.pathname);
    if (url.pathname === '/ws') {
      const id = env.CHAT_ROOM.idFromName('global');
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
