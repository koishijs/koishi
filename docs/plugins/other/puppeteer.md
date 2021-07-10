---
sidebarDepth: 2
---

# 网页截图 (Puppeteer)

::: warning
为了正常使用这个插件，你首先需要确保你的电脑上已经安装有 Chrome。同时，我们建议你保持 Chrome 和本插件的更新，因为版本不匹配可能会导致本插件无法正常使用。
:::

koishi-plugin-puppeteer 本身提供了网页截图（shot）指令和 TeX 渲染指令（tex），同时也封装了一系列与网页进行交互的接口。利用这些接口我们可以开发更多以渲染图片为基础的插件。

## 指令：shot

网页截图。

- 基本语法：`shot <url>`
- 别名：screenshot
- 选项列表：
  - `-f, --full` 对整个可滚动区域截图
  - `-v, --viewport <viewport>` 指定视口

## 指令：tex

LaTeX 渲染。渲染器由 [https://www.zhihu.com/equation](https://www.zhihu.com/equation) 提供。

- 基本语法：`tex <code>`
- 选项列表：
  - `-s, --scale  <scale>` 缩放比例

## 类：Puppeteer

可以通过 `ctx.puppet` 访问。

### puppet.launch()

- 返回值: `Promise<void>`

启动并连接浏览器。

### puppet.close()

- 返回值: `Promise<void>`

关闭浏览器并取消连接。

### puppet.page()

- 返回值: `Promise<Page>`

创建一个新页面。

### puppet.svg(options?)

- **options:** `SVGOptions` 图形选项
- 返回值: `SVGElement`

启动并连接浏览器。

### puppet.render(content, callback?)

- **content:** `string` 要渲染的 HTML
- **callback:** `(page, next) => Promise<string>` 回调函数
  - **page:** `Page` 页面实例
  - **next:** `(handle: ElementHandle) => Promise<string>` 渲染函数
- 返回值: `string`

渲染一个 HTML 页面。

## 扩展事件

### puppeteer/validate

- **url:** `string`
- 返回值: `string`

判断一个给定的 URL 是否可以访问。如果不能访问，返回一个字符串作为报错信息。

## 配置项

### browser

- 类型: [`LaunchOptions`](https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerlaunchoptions)

启动浏览器时使用的配置。

### protocols

- 类型: `string[]`
- 默认值: `['http', 'https']`

允许的协议列表。如果提供的 URL 的协议不在这个列表内将会提示“请输入正确的网址”。

### loadTimeout

- 类型: `number`
- 默认值: `10000`

加载页面的最长时间，单位为毫秒。当一个页面等待时间超过这个值时，如果此页面主体已经加载完成，则会发送一条提示消息“正在加载中，请稍等片刻”并继续等待加载；否则会直接提示“无法打开页面”并终止加载。

### idleTimeout

- 类型: `number`
- 默认值: `30000`

等待页面空闲的最长时间，单位为毫秒。当一个页面等待时间超过这个值时，将停止进一步的加载并立即发送截图。

### maxLength

- 类型: `number`
- 默认值: `1000000`

单张图片的最大尺寸，单位为字节。当截图尺寸超过这个值时会自动截取图片顶部的一段进行发送。
