# QQ MsgBot

基于 Cloudflare Workers + D1 + Durable Objects 的 QQ 机器人网页控制台，支持实时 WebSocket 推送，无 KV 读写限额烦恼。

## 🚀 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/你的用户名/qq-msgbot)

> 点击上方按钮，Cloudflare 将自动完成仓库拉取、D1 数据库创建、Durable Objects 配置及表结构初始化。
> 
> 部署完成后，请前往 Worker 的 **Settings → Variables and Secrets** 添加以下环境变量：
> - `QQ_APP_ID`：QQ 机器人 AppID
> - `QQ_CLIENT_SECRET`：QQ 机器人 AppSecret
> - `WEB_PASSWORD`：控制台登录密码
>
> 然后在 QQ 开放平台将回调地址配置为 `https://你的域名/qq-webhook` 即可开始使用。
