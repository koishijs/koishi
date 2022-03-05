---
sidebarDepth: 2
---

# 发送反馈 (Feedback)

## 指令：feedback

- 基本语法：`feedback <message>`

feedback 指令用于向开发者反馈信息：

```yaml title=koishi.yml
plugins:
  feedback:
    # 填写接收者的账号，格式为 {platform}:{userId}
    - onebot:123456789
```

这样，当有人调用 feedback 指令时，传入的 message 就会自动被私聊发送给你。你也可以直接回复收到的反馈信息，机器人会把这些消息重新发回到调用 feedback 指令的上下文。这里的用法类似后面将介绍的 [消息转发](./forward.md)。

<panel-view title="聊天记录 (私聊)">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>收到来自 Alice 的反馈信息：</p>
<p>我也不知道该写什么总之这是一句话</p>
</chat-message>
<chat-message nickname="Operator" color="#f4a460">
<blockquote>
<p>收到来自 Alice 的反馈信息：</p>
<p>我也不知道该写什么总之这是一句话</p>
</blockquote>
<p>那么这是一句回复</p>
</chat-message>
</panel-view>
