# QQ MsgBot

一个基于 Cloudflare Workers 的 QQ 机器人网页控制台。支持收发文字消息、主动/被动回复切换。

## 🚀 一键部署（或通过 Git 部署）

1. Fork 或导入本仓库到 Cloudflare Workers (Connect to Git)。
2. 在部署配置中，系统会自动读取 `wrangler.jsonc` 和 `package.json`，直接点击部署即可。
3. 部署完成后，进入你的 Worker 控制台，前往 **Settings -> Variables**，添加以下环境变量：
   - `QQ_APP_ID`: 你的 QQ 机器人 AppID
   - `QQ_CLIENT_SECRET`: 你的 QQ 机器人 AppSecret
   - `WEB_PASSWORD`: 你自己设置的控制台登录密码
4. 在同一页面向下滚动到 **KV Namespace Bindings**：
   - 点击 **Add binding**
   - Variable name 填入：`BOT_KV`
   - 选择一个 KV 命名空间（没有的话点击 Create new 新建一个）。
5. 前往 QQ 开放平台，将回调地址设置为：`https://你的域名/qq-webhook`。
6. 访问你的域名，输入刚才设置的 `WEB_PASSWORD` 即可开始使用！
