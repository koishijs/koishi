---
sidebarDepth: 2
---

# 模拟调用 (Sudo)

## 指令：sudo

- 基本语法：`sudo <command>`
- 最低权限：3
- 选项：
  - `-u, --user [@user]` 目标用户（私聊）
  - `-m, --member [@user]` 目标用户（群聊）
  - `-c, --channel [#channel]` 目标频道

sudo 指令允许你模拟其他用户调用指令。例如当你在私聊上下文时：

```sh
teach foo bar                       # 无效，因为 teach 指令只对群上下文生效
sudo -g #456 teach foo bar          # 有效，相当于在群 456 调用 teach foo bar
```

除此以外，你还可以模拟在其他频道中调用（假设你现在在频道 123 中调用指令）：

```sh
sudo -g #456 command                # 模拟你在群 456 的上下文
sudo -u @789 command                # 模拟用户 789 的私聊上下文
sudo -m @789 command                # 模拟用户 789 在当前频道的上下文
sudo -u @789 -g #456 command        # 模拟用户 789 在频道 456 的上下文
```

尽管切换了调用上下文，但 sudo 指令的输出仍然产生在原上下文中。这在你想调用群指令的时候是很有用的。

::: tip 提示
为了安全性考虑，sudo 命令设计的最低使用权限为 3 级，同时切换的用户等级不能高于或等于调用者自身。
:::
