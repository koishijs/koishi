---
sidebarDepth: 2
---

# 了解配置文件

## 使用配置文件

打开你创建的目录，你会发现有一个 `koishi.yml` 文件。它大概长这样：

```yaml title=koishi.yml
port: 8080

plugins:
  console:
    open: true
  dataview:
  logger:
  manager:
  status:
```

你在设置界面进行的操作最终都会写入这个文件。因此，你也可以选择直接修改这个文件并重新运行项目，效果同你修改配置文件是一样的。`plugins` 字段保存了各个插件的配置，其中以 `~` 字符开头的插件不会启动。其余的字段都是全局配置。

## 使用环境变量

你可以通过插值语法在配置文件中使用环境变量。例如：

```yaml title=koishi.yml
plugins:
  adapter-discord:
    bots:
      - token: ${{ env.DISCORD_TOKEN }}
```

当项目启动时，会将环境变量中的值替换进去。

除了系统提供的环境变量外，Koishi 还支持 [dotenv](https://github.com/motdotla/dotenv)。你可以在当前目录创建一个 `.env` 文件，并在里面填写你的环境变量。这个文件已经被包含在 `.gitignore` 中，你可以在其中填写隐私信息（例如账号密码）而不用担心被上传到远端。
