---
sidebarDepth: 2
---

# 转发消息 (Forward)

@koishijs/plugin-forward 支持在不同的频道之间转发消息。

```yaml koishi.config.yaml
plugins:
  forward:
    # 请使用 {platform}:{channelId} 的格式
    - source: onebot:123456789
      target: discord:987654321
```

当用户 Alice 在频道 `source` 中发送消息 foo 的时候，koishi 就会在频道 `target` 中发送如下的内容。接着，频道 `target` 中的用户 Bob 也可以通过引用回复这条消息的方式将自己想说的话发回到频道 `source` 中去。

<panel-view title="聊天记录">
<chat-message nickname="Koishi" avatar="/koishi.png">
<p>Alice: foo</p>
</chat-message>
<chat-message nickname="Bob" color="#00994d">
<blockquote><p>Alice: foo</p></blockquote>
<p>bar</p>
</chat-message>
</panel-view>
