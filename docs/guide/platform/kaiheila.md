---
sidebarDepth: 2
---

# 接入开黑啦

1. 前往 [开发者平台](https://developer.kaiheila.cn/)，选择「机器人」并点击「新建」
2. 在机器人连接模式中配置 Webhook 或 WebSocket 中的一种：
    - 如果是 Webhook，请记下页面中的 token 和 verify_token，并作为机器人的配置项，同时让 Koishi 暴露一个 URL，填入下方的 Callback URL 中，启动 Koishi 后点击「机器人上线」
    - 如果是 WebSocket，则只需记录 token 并作为机器人的配置项即可，你可以在任何时候启动 Koishi
    - 页面中的其他值不用管，但请注意 token 不要泄露
