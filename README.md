# QQ MsgBot

一个基于 Cloudflare Workers 的 QQ 机器人网页控制台。

## 🚀 部署指南

1. Fork 或导入本仓库到 Cloudflare Workers (Connect to Git)。
2. 在 Cloudflare 的构建设置中，确保 **Build command (构建命令)** 留空，**Deploy command (部署命令)** 保持默认（`npx wrangler deploy`）。
3. 部署完成后，进入该 Worker 控制台，前往 **Settings -> Variables**，添加以下环境变量（必须）：
   - `QQ_APP_ID`: 你的 QQ 机器人 AppID
   - `QQ_CLIENT_SECRET`: 你的 QQ 机器人 AppSecret
   - `WEB_PASSWORD`: 设置一个控制台登录密码
4. 在同一页面向下滚动到 **KV Namespace Bindings (KV 命名空间绑定)**：
   - 点击 **Add binding**
   - Variable name 填入：`BOT_KV`
   - 选择或新建一个 KV 命名空间。
5. 前往 QQ 开放平台，将回调地址设置为：`https://你的Worker域名/qq-webhook`。
6. 访问你的域名，登录即可使用！
