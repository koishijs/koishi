---
sidebarDepth: 2
---

# 实用工具 (Tools)

koishi-plugin-tools 是一系列小功能的合集。这些小功能将全部作为 tools 指令的子指令。

尽管这看起来像是个大杂烩，但你可以按照需要在配置项中只开启其中的一部分。事实上，这个插件的体积并不及 koishi-plugin-common 或 koishi-plugin-teach，你大可以放心地引入它。如果你也写了什么有趣的小玩意儿，也欢迎给我们发个 pull request。

## 指令：alpha

调用 [Wolfram Alpha](https://www.wolframalpha.com/) 查询。

默认关闭，你需要申请一个 Wolfram App 并配置 `wolframAlphaAppId` 以开启本功能。

- 基本语法：`alpha <expr>`
- 选项列表：
  - `-f, --full` 显示完整回答

## 指令：brainfuck

编写并调试 [BrainFuck](http://www.muppetlabs.com/~breadbox/bf) 代码。

默认开启，配置 `brainfuck` 为 `false` 以关闭本功能。

- 基本语法：`brainfuck <code> -- <input>`

### 配置项：brainfuck.cellSize

- 类型: `number`
- 默认值: `8`

每个单元占用的比特数。

### 配置项：brainfuck.maxSteps

- 类型: `number`
- 默认值: `16384`

允许的最大步数。如果超出这个数目将会抛出错误：max step exceeded。

### 配置项：brainfuck.memorySize

- 类型: `number`
- 默认值: `1024`

允许的最大单元数目。如果超出这个数目将会抛出错误：max memory exceed。

## 指令：crypto

## 指令：magi

调用 [magi](https://magi.com) 搜索。

默认开启，配置 `magi` 为 `false` 以关闭本功能。

- 基本语法：`magi <text>`
- 选项列表：
  - -c, --confidence 显示可信度

## 指令：maya

玛雅日历换算。

默认开启，配置 `maya` 为 `false` 以关闭本功能。

- 基本语法：`maya <YYYY-MM-DD> [BC|AD]`

## 指令：mcping

查看 Minecraft 服务器信息。

默认开启，配置 `mcping` 为 `false` 以关闭本功能。

- 基本语法：`mcping <url>`

## 指令：music

点歌。目前支持 qq, netease 平台。

默认开启，配置 `music` 为 `false` 以关闭本功能。

- 基本语法：`music <keyword>`
- 选项列表：
  - -p, --platform \<platform> 点歌平台

### 配置项：music.platform

- 类型: `string`
- 默认值: `'qq'`

默认的点歌平台。

### 配置项：music.showWarning

- 类型: `boolean`

点歌失败时是否发送提示。

## 指令：oeis

调用 [OEIS](https://oeis.org) 数列查询。

默认开启，配置 `oeis` 为 `false` 以关闭本功能。

输入用逗号隔开的数作为要查询的数列的前几项，或者直接输入以 id:A 打头的数列编号。

- 基本语法：`oeis <sequence>`

## 指令：qrcode

生成二维码。

默认开启，配置 `qrcode` 为 `false` 以关闭本功能。

- 基本语法：`qrcode <text>`
- 选项列表：
  - -m, --margin \<margin>  边界尺寸
  - -s, --scale \<scale>  比例系数
  - -w, --width \<width>  图片大小
  - -d, --dark \<color>  暗部颜色
  - -l, --light \<color>  亮部颜色

## 指令：translate

调用 [有道翻译](http://fanyi.youdao.com/)。

默认关闭，你需要申请一个有道翻译 App 并配置 `youdaoAppKey` 和 `youdaoSecret` 以开启本功能。

支持的语言名包括 zh-CHS, en, ja, ko, fr, es, pt, it, ru, vi, de, ar, id, it。

- 基本语法：`translate <text>`
- 选项列表：
  - -f, --from \<lang>  源语言
  - -t, --to \<lang>  目标语言
