---
sidebarDepth: 1
externalIcon: false
---

# v3 更新日志

## [Koishi 3.13.0](https://github.com/koishijs/koishi/releases/tag/3.13.0)

### Notable Changes

- **orm:** 大幅优化了 query 语法，支持了表达式和操作符机制

### Features

- **discord:** 支持了当遇到错误时将继续发送剩余片段 (#267) (=7dd8292ced2cabf0762a8592f32860e57e15fa4b)
- **eval:** 针对 CoffeeScript 支持了 top-level await (#319) (=b0096427290d8403fe9f8cc57a61b89b2a7df9f2)
- **orm:** 支持了请求表达式和正则语法 (#305) (=657e4b2b9ac79031c2715da185e676b0a96c9d0c)
- **orm:** 支持了传入 IndexType 以严格匹配的语法 (=3cc390ad65df1d4c9dd7ba2d79b0c9137ce856e5)
- **orm:** 支持了 `$regexFor` 操作符 (=8e5fe1a706381243b965118db507ac5e9a53b609)

### Bug Fixes

- **cli:** 修复了 koishi start 不自动支持 koishi.config.yml 的问题 (#306) (=bac8a011300648329edc80aeb93e4113525b923c)
- **eval:** 修复了同时使用 `useSpread` 和 `useBuiltIns` 导致的冲突 (#316) (=ad05b4e4a7d52457f8ca2c6710b75c6ccec9e817)
- **mongo:** 不手动传入默认的 27017 端口以避免 `MongoParseError` (#312) (=11bbad7d879ebb1f6ce09b3261340e491ad7fae5)
- **teach:** 修复了当使用正则表达式时存储了错误的转义表达式的问题 (#309) (=ce19057eeb34406320633bb26628f1a4dc3fb635)

## [Koishi 3.12.3](https://github.com/koishijs/koishi/releases/tag/3.12.3)

### Features

- **adventure:** 优化了类型标注 (=bfc5ded68b5e8f3bd0e011d2682c23d80bccd73f)
- **adventure:** 新增了 `Action.useItem()` 的 `onTimeout` 配置项 (=16a22f075df35ba8bb3f1d6521979b73f34cc9b5)
- **teach:** 移除了正则表达式的兼容性检测代码 (#299) (#300) (=b3c5d73e928da52024c17f5b8b5f43d50584663e)

### Bug Fixes

- **core:** 使用 `Number.isFinite()` 以检验输入内容 (#302) (=e625328a925c2eb48703b39bf1de7edd6c6dcdb5)
- **discord:** 修复了部分情况下会发生连续两次重连的问题 (#297) (=845afc03668f1ce390edaff2fa833690dc57d1b0)
- **eval:** 修复了错误的插值行为 (#304) (=616142bcfc37364da20e417319fd6bf56b1ed966)
- **teach:** 修复了特定正则表达式的匹配不符合预期的问题 (#249) (=20e6522bc34c07a5bd7bdc668b9b1b2553a4f954)
- **webui:** 修复了对 MySQL 的不兼容问题 (#295) (=cc27cd8f51307e5668fc2046516fd33f81ac5ad7)

## [Koishi 3.12.2](https://github.com/koishijs/koishi/releases/tag/3.12.2)

### Features

- **adventure:** 新增了 item.add, item.remove, item.set 指令 (=73cf5bf345ba2022796cabbceeb4b597534cdced)
- **common:** 将插件入口分离以便于用户部分安装 (=12346abacf4eabd56878bd14fce88d906529201f)
- **discord:** 支持了 `handleMixedContent` 配置项 (#279) (=8fb69129186f21e6b746b51a58e51b26f885d22a, =253b0d6584ad1882efcd176d53594e5ecbc293fe, =e96a920e679300afc4674f06386d2fa4a41a2cbb)
- **discord:** 支持了 reaction 相关事件和 API (=21d06f25c677209ced79857cbea1912c220d798b, =f0d9a61dce557aac81d04cf9e08c37c55958c3dd)
- **kaiheila:** 支持了 reaction 相关事件 (#296) (=173ce8547261919106278194a934ea492db37d36)

### Bug Fixes

- **adventure:** 修复了 `Event.gain()` 未修改 `session._gains` 的问题 (=58a290f4bd55f5396c5122d3965157d8f96d9dc6)
- **adventure:** 修复了部分情况下 use 指令可以在无法使用物品状态下调用的问题 (=eb11cc1a33b66e2459dbd8acbcaa33c26d81ae02)
- **adventure:** 修复了剧情存在状态时 items 回调函数报错的问题 (=26621aa4c84ecffa82127ebadfc0a23f5c1bf34f)
- **common:** 优化了 bind 指令的文本提示 (=c654d66527b4f55b071baf08219376ba07eaacaa)

## [Koishi 3.12.1](https://github.com/koishijs/koishi/releases/tag/3.12.1)

### Features

- **adventure:** 新增了 adventure/gain 和 adventure/before-timer 事件 (=126832a4e42c594d2ad561eb8adf4c68eec2c3f9)
- **adventure:** 优化了 `Event.gain()` 操作的行为 (=1981c0c45586f7da7169b87d6edfd5272ff44e76, =4b01056f872b753bfceeb8b7efcd58f6568e5215)
- **adventure:** 支持了 `phase.prepare` 属性，用于在阶段初期初始化状态 (=b6c052756478e800d0d9a15e0133be225d8fec22)
- **adventure:** 新增了若干 `Action.choose()` 的配置项 (=b22612ce0c9b6801ef61a67c4a42e48e03b875e4)
- **adventure:** add-item 指令支持了 -p 选项，用于控制物品添加行为是否触发相关事件 (=bd54c8656c742bd1d598892a7a09341c21b94d5d)
- **discord:** 新增了 `bot.$setGroupName()`, `bot.$setGroupCard()` 方法 (#283) (=83cfa2a16a1061639395a25c3ec7f67654402650)
- **discord:** 优化了图片类消息段的发送行为 (#280) (#282) (=12207bdee5adcb30633e9db7f4c5809fec1e7a04)
- **onebot:** 支持了最新的 go-cqhttp API (=90d9dc864c522969b26de2000e062c295323ea0f)
- **test-utils:** `MockedApp` 默认情况下将不使用数据库缓存 (=782d33ff69cdb36fbff61f62418844fd87ce9386)

### Bug Fixes

- **adventure:** 优化了结局列表的输出 (=b527e0e7850fcef26b4eb6537c7de8b0c8d894aa)
- **adventure:** 剧情锁将定时解除，以防止内存泄漏 (=af73653e4f5b62d649562035a1a2b4ec9bcaa038)
- **chat:** 修复了 debug 输出时报错的问题 (=5f34a0e7efa76057da495979cb41b5bd4238bc91)
- **common:** 修复了 assign 和 authorize 指令的异常行为 (#292) (=c342ce0cbbdff951be9bd7bb5e2af0c2cb3d5622)
- **core:** 针对贪婪匹配的参数支持了自定义类型 (=2087b7c8deeae5495f1970dc693e14d77459ce7e)
- **core:** 针对快捷调用支持了自定义类型 (=a055b26cb5d641f8604a605a14da99fa8abc134a)
- **utils:** 当插值中出现 ReferenceError 时使用空串替代 (=0426a86ffde2baf2f28ff1f5449d3653211abb5b)

## [Koishi 3.12.0](https://github.com/koishijs/koishi/releases/tag/3.12.0)

### Notable Changes

- 新增了工具库 koishi-dev-utils，支持了使用装饰器开发插件

### Features

- **core:** 现在自定义参数类型也可以配置为贪婪匹配了 (=11e9fe3240c847dc1c63a5f40598af7d2bbde947)
- **dev-utils:** 新增了 koishi-dev-utils (=fdd954148454e68092da062db7ad21a0e6c0c1be, =3ce5fc7588a7225ae2c7d3634735551c1ee973eb, =26bcd3a5ba9d04899aae46811b872d90f89aebd2, =fbae1161dea82969ae671b7f0736a7152f9ff184, =79b86323173388dee5e55a7ffb7173738905de68, =3bd9ed1eaa9b4358dc018f93fe963261dea692e7, =c1a90dad6189674aa630bf0fb86a5ee24af7931c)
- **discord, kaiheila:** send 事件现在支持了 `groupId` 属性 (=8976f250d04f69fb835fc93ca9bebf2e5b8e8d8a)
- **eval:** 新增了配置项 `serializer` (=58f8281650d979cebdd46efe3cdb6e636e1ecf51)

### Bug Fixes

- **adventure:** 修复了用户数据中存有未知结局时会产生报错的问题 (=72d8ae7459caa6493ad505086426a8d910ccdcae)
- **chat:** 修复了与其他适配器共同使用时的类型错误 (=a5af832d1a1f697be3ee345c346b672355cced4d)
- **core:** 修复了 koa-bodyparser 的类型错误 (=5fd2228e02ccc6498e5f76bde9049bbe80c70675)
- **eval:** 修复了少量平台中 SyntaxError 不附带位置信息的问题 (=ac7e67b67b7179e3a662577ecd43df0f4f46aead)
- **puppeteer:** 修复了 selector 参数被错误转义的问题 (=03507fadb5f5c19763e278a68b0f2907b571e81a)
- **webui:** 修复了未安装数据库时 status 指令报错的问题 (=27717c91fe5603f5aa0ba7bf1490b15fbc2ec80d)

## [Koishi 3.11.2](https://github.com/koishijs/koishi/releases/tag/3.11.2)

### Features

- **cli:** 加入了模块缓存以获得更快的加载速度 (=5f1860ccdd0216d68221d482f12b7b64a11047c2)
- **core:** 支持了在无数据库情况下使用 `ctx.broadcast()` (=cfca0798bda7cad913966a338b83c8ae3d39ec70)
- **dice:** 支持了经典的 rxdy 掷骰语法 (=8a5f9152a9169e930fe2d492f0d099e4268f1a5d)
- **kaiheila:** 支持了 markdown 消息段 (=f7d9dca5b83bf4ed0d4386b60b74cf22e2db434e)

### Bug Fixes

- **cli:** 修复了生成的配置文件中，含有特殊字符的插件名没有引号的问题 (#275) (=2badfdfb645f7d5f6d10d1fa3e8ed27bf8d0fd12)
- **cli:** 修复了当一个插件含有文件级命名子插件时，子插件重载可能失败的问题 (=3a0d25d372e966c1e1124615c17ea08caad301c0)
- **github:** 支持了 request review from team (=b60c8903f6b2de3bc7caaffe107628ae560eb862)
- **webui:** 补全了缺失的依赖库 (#277) (=4053909020a8d1827b2d8b6bee39bb4068aaf68c)

## [Koishi 3.11.1](https://github.com/koishijs/koishi/releases/tag/3.11.1)

### Notable Changes

- koishi-plugin-webui 新增了插件市场视图

### Features

- **webui:** 新增了插件市场视图 (=b2604777c6a3d9be194f60ca8dbc45aa9d05b244, =5913209cb61ba8ad4a5074f5c1860e6b299f2a62, =54bd7633884736ce6eadfd7ff899f53e9050407a, =983c374e6e8389a567de948885cc968a76e5a56f, =23274905df657c20b92c93d60c97bb708c10364e, =b7eff39add979c091e3a7a89d0afb1f63fd37602)

### Bug Fixes

- **adventure:** 修复了重复计算结局达成次数的问题 (=dfd683c5c9a488157010c8c20f26e7b792134431)
- **adventure:** 修复了 ending 指令查看剧情线失效的问题 (=4d77b86af6d3e00ea063b9ffdec2862423ef0fe0)
- **adventure:** 修复了 show 指令直接调用时参数丢失的问题 (=e87ac4dc619a1d889534ece2c625fe89fac57802)
- **cli:** 修复了成功启动前 SIGINT/SIGTERM 无效的问题 (=632dc6156febb0a613b0c2dcd1c84a7e4d3e6ffb)
- **core:** 修复了由于 esbuild 导致的插件不一致问题 (=398ad5bd3f882a2922293afff8b0b5dc72ec9969)

## [Koishi 3.11.0](https://github.com/koishijs/koishi/releases/tag/3.11.0)

### Notable Changes

- koishi-test-utils@6.0.0 正式发布
- koishi 配置文件新增了 deamon 配置项，用于定制监控进程的行为

### Features

- **adapter:** 为部分平台支持了 at 消息段的 `name` 属性 (=142597470f5034738018fe9fbe82bcabf7745266, =bf3721c4d91bfdb5c586a937ec40c96a0ba82bc0, =824874c2b96225638632793d905c7ae4508bb3f3)
- **chat:** 支持了 QQ 系统内置表情包 (=eb7f7a90c23c9e84ef8b86faaf16bf306090ac14)
- **chat:** 支持了 @用户名 的显示 (=8b667ba61a1bf2cafa2f2f0b580bd52eac1361af)
- **cli:** 新增了 `deamon` 配置项 (=46be1006b648393f91dfacfd4a969a2fd2346a5f)
- **cli:** 支持了 exit 指令的输出内容模板 (=8880c863313657dddd7c1a1a9f03a342ac5fdb84)
- **cli:** 新增了 exit 事件，用于处理接收到 SIGINT 时的行为 (=3ca3f728875d306304870891eea712e0a41744ac)
- **core:** 每一个 `Context.delegate()` 注册的属性都有对应的事件了 (=3dd372dbd161cbe57d839d3177cfb4ea12dc6895)
- **onebot:** 支持了 `session.author.roles` 属性 (=aef0404018071ec2fd7a29cdb93d80012bcacaed)

### Bug Fixes

- **adapter:** 修复了部分平台无法发送本地图片的问题 (#266) (=409dcbc7108b6906adb62dc69081d3ec63c6d727)
- **chess:** 修复了图片发送失败和自动检测环境中存在的问题 (#263) (=0e9b724cb7b93566469fbe2eb1052235afc9f5d8)
- **common:** 修复了无法使用 echo 指令发送跨平台消息的问题 (#264) (=5b56651ec5cde3d4131a7ce1bcd58bd3041aaa1f)
- **test-utils:** 移除了错误的 `mockedApp.start()` 方法 (=5d1023aef7c85d91535f541f5cd18e92aa757457)

## [Koishi 3.10.2](https://github.com/koishijs/koishi/releases/tag/3.10.2)

### Features

- **chat:** 优化了 at 消息段的处理 (=d80af91267986e1455c1f52998248c2d460c5a3c)
- **common:** assign 指令支持了 -T 选项，用于取消频道代理者 (=40afea00a027b62b2a5e51375c7036a75309d5f2)
- **core:** 支持了函数类型的 `app.options.prefix` (=578008098031fc7942a074e907d8c9ca8601a46b)
- **discord:** 为 at, sharp 消息段添加了 name 属性 (=43a23cae0c096d257dcd4aa944455d16215956c2)
- **kaiheila:** 导出了 `KaiheilaBot` 构造函数 (#258) (=8fb118e57b8bfafda1711e2b50a7cb9cdd5c6dc6)
- **puppeteer:** 使用 inline-block 布局以获得更好的截图区域 (=8f3c98dd7bcbf4ab41289db025894d228f9f438b)
- **webui:** 将自动删除距今过于遥远的统计数据 (=767853efadae08db3c1ba06fe4daedc085ee3e20)
- **webui:** 新增了指令调用频率的统计图表 (#252) (=4d5d87a533e02ecab5f573247f4732ae40156feb)

### Bug Fixes

- **common:** 修复了错误的类型标注 (#254) (=ab64feec34f59aab3a21f25409d089398604d41b)
- **discord:** 修复了 message-deleted 事件缺少 `id` 属性的问题 (#251) (=bbd8d6c3e9684ddb3bc6ca2e71ab839c7b1d6aa3)
- **webui:** 修复了群聊消息频率统计图表当鼠标悬浮时出现报错的问题 (=361ea7c145b1e247f30fed394511a9c4e0756c9b)

## [Koishi 3.10.1](https://github.com/koishijs/koishi/releases/tag/3.10.1)

### Features

- **cli:** 优化了 koishi init 时可供选择的插件列表 (=a9b7000ac6c2da383bb3fe679cc84f78be2f5f1b)
- **kaiheila:** 新增了 `kaiheila.attachMode` 配置项 (=7bc59993f59bea5e2b4d3e751965fa58e4c85d58)
- **github:** 新增了 github.issue 和 github.star 指令 (=104841c9be749ade6c44dab6bcc59d5d4e32a596)
- **webui:** 将「机器人」页面合并入「仪表盘」页面 (=d70fdcff63690ae4ec0e3afb8d2c57c4f08d8652)

### Bug Fixes

- **cli:** 修复了插件热重载功能将小概率触发调用爆栈的问题 (=45690007150441cbb568f85049395085756a301e)
- **discord:** 修复了不符合规范的 `user.avatar` (=14c92ca96723f7f96ebda93e20f7c5ce8436d9b1)
- **discord:** 修复了 `bot.getMessage()` 返回值缺少 `groupId` 的问题 (=c5a012437744e396d500d67a3996fc5d9dfc2c3c)
- **image-search:** 修复了消息段错误导致在部分平台上无法发送的问题 (=ff82bd60fa2959f5387d71d84028e046a04f93aa)
- **webui:** 修复了配合 MySQL 使用时小概率上传数据失败的问题 (#248) (=2a0bbfb2d53520ba14a9014e9015f511a5d92d24)

## [Koishi 3.10.0](https://github.com/koishijs/koishi/releases/tag/3.10.0)

### Notable Changes

- 全部文档已经合并到了主仓库，并补充了许多内容，也更便于接收 Pull Request

### Features

- **core:** 移除了 `database.removeUser()` 等方法，请使用 ORM API (=10d157002de0c0da902bd97278761f845201d9cb)
- **core:** 重构代码并调整了 Argv 的类型标注 (=9139e7a7eed8e20921420201ca1822858029fd3d)
- **discord:** 支持了 `discord.endpoint` 配置项 (=1646d9c720b81496178498987031e666e86f2464)
- **kaiheila:** 支持了 card, image, video, file 消息段的发送 (=41566d99d04e075631098a0d5ce14a68b4dc03e3, =6d82272488e5aec4f637e85ae8912bfb7e170e46)
- **mysql:** 支持了 ORM 声明中外键的初始化 (#243) (=6104b9aedeb1668f24f704470c892b48108a869f)
- **webui:** 支持了无数据库条件下使用 WebUI (#234) (=b211cd8fff64f4abbc9c9832106411fa8c63fa8d)

### Bug Fixes

- **puppeteer:** 优化了类型标注 (=db5177584b4e8744138257d5fa8ecd7590e9a52e)
- **utils:** `template.set()` 对于对象模板应该使用深层合并而非覆盖 (#244) (=8d0551441e61796a0af90a1f9f26359b2886c56d)

## [Koishi 3.9.2](https://github.com/koishijs/koishi/releases/tag/3.9.2)

### Notable Changes

- koishi-plugin-eval + koishi-plugin-puppeteer 组合支持了 JSX 渲染的功能

### Features

- **chat:** 移除了上下文相关配置，请直接使用上下文选择器 (=2060ed543acbe0aa09a09f6b8c08e0479e5d4539)
- **chat:** 新增了 `maxMessages` 配置项，可用于控制最大保存的消息数量 (=8b91a7be35b3ce4348595df777c7dbe8f273ecc2)
- **core:** 支持了 `app._command.resolve()`，可用于查找可能的指令 (#241) (=48598db9d6b46d7dc5f340d52f57a2ab3dfce0f9)
- **eval:** 对 esbuild, typescript, coffeescript 支持了 JSX 语法 (=5425e526f733a64031f4a61d6c3414b05bc1517d, =ef71dd26f4935bdeb8aebe1efa427a8d5c01cd4f)
- **puppeteer:** 为 koishi-plugin-eval 提供了渲染 JSX 并输出的功能 (=fc00ff6b92e71fefa94fdacefab2c907ad95b744)
- **puppeteer:** 新增了 `ctx.puppeteer` 接口，可用于 koishi-plugin-chess 等插件 (=7a8254402577824b7ddda37eb835bced6b57a4f7, =49f50c7f77a5fd446d3c45cd3976f64fd169080f)
- **utils:** 支持了 `segment.transformAsync()` 方法 (=861c3223bb18f7cc99d3a7393b44abd8302b5111)
- **webui:** 加入了插件状态徽章，部分插件将被标记为“副作用”“网页扩展” (=69a69201ac3a0c557dcbff9b1afa66dced92d982)
- **webui:** 加入了 npm 版本显示，可用于查看非本地依赖是否是最新版本 (=2827a5c353860507f9c4c6c3241ba8d15a167ca2)

### Bug Fixes

- **monitor:** 修复了 MySQL 数据库初始化报错的问题 (#238) (=6ccca1be332d5a221c28530831e7d8ab5669e4ae)

## [Koishi 3.9.1](https://github.com/koishijs/koishi/releases/tag/3.9.1)

### Features

- **cli:** 支持了在配置文件中使用上下文选择器 (#226) (=1612a0984eaccb5a16ee8e81deab2dc5600875c8)
- **eval:** 支持了 addons 中补全用户定义的后缀名并加载 (=1834daf2e9cba6edbf4ca8c7b146817e458937fd)
- **eval:** 支持了 CoffeeScript (#230) (=61e5ea983bb014b044a8229f8ef235d443cc0947)
- **webui:** 优化了插件页面，支持了运行时热重载插件 (=0e2672325119da2eed5b50c3aa86b8fe0540c268, =722f34360bd51a12ce9941f4a12f8ae7fb739011)
- **webui:** 将本地图片代理服务器的逻辑重构到 chat 插件中 (=47b1e525abe190f3ac42abd4cc0b0f77479a0a48)

### Bug Fixes

- **chat:** 修复了聊天页面的内容溢出问题 (#222) (=92873e264de37960911fb1eac0d2ed2549526d60)
- **cli:** 热重载现在可以监测 yaml, json 配置文件的变化了 (=51552f72ba031a0a322e161d0801aa57852cc296)
- **core:** 使用 Map 代替 Object 存储指令别名，以避免可能的攻击 (#232) (=bc8729044e818535b1eb222d79587fe8c75f393e)
- **eval:** evaluate 指令的返回值现在也经过 eval/before-send 事件了 (=a1e80ddb9ac3c33fcbcb99c28366784898f8d377)
- **onebot:** 修复了错误的垃圾回收行为 (#227) (=2097fe8f2cf3944b38ff101599a4cd7b027041b5)
- **webui:** 优化了 `<k-card>` 组件中的文本样式 (#228) (=ad94455f02a7aebf1144ebba1fe40f9b1c809235)

## [Koishi 3.9.0](https://github.com/koishijs/koishi/releases/tag/3.9.0)

### Notable Changes

- koishi-plugin-eval@3.0.0 正式发布
- koishi 支持了文件级别的插件热重载和重载缓冲机制，能够更好地应对复杂项目中的热重载

### Features

- **cli:** 支持了 `config.logDiff` 配置项，将应用于 `Logger.showDiff` (=c07692bb352aa702729de53f27906bf34110b72f)
- **cli:** 支持了文件级别的插件热重载 (=753c560da7df7db45de3a6eabd23024626ae0770)
- **cli:** 支持了 yaml 格式的配置文件的生成和读取 (=33ca25ee68e135a584616021959809173182e3d1)
- **eval:** 支持了 `moduleLoaders` 配置项，可用于配置 addons 中使用的语言解析器 (=593131625d4149f5e035fd27ea2cb4c2005f71d7)
- **eval:** 支持了在 addons 中直接引入 yaml 文件作为模块 (=a3b529765cbfb5ce60a2df5b147bb45631527ba1)
- **webui:** 支持了 WebSocket 断线重连 (=b0df6d857acc9c54b6738a642c7597004a6a0724)
- **webui:** `<k-numeric>` 组件将自动适配数据大小所适合的单位 (=4ee40b77a88b3ca75a9b8137ced58556adbcff03)

### Bug Fixes

- **cli:** 修复了短时间多次重载可能导致的崩溃问题 (=3d4ebb8481743b4a0245493319e54024dce12ab8)
- **core:** 支持了异步的 `cmd.check()` 回调函数 (#218) (=2818e32b126f23c8ea800848bb05133cd8d627d4)
- **eval:** 修复了保存 storage 数据失败时，下一次会继续失败的问题 (#225) (=2b6cc3b8162b37dd225248851e92d5a3e0f93df7)
- **mongo:** 补全了缺少的类型依赖 (=cc4e004b832b0b290dc7beaf36665426e11b4d5f)
- **mysql:** 补全了缺少的类型依赖 (=cc4e004b832b0b290dc7beaf36665426e11b4d5f)

## [Koishi 3.8.0](https://github.com/koishijs/koishi/releases/tag/3.8.0)

### Notable Changes

- koishi start 加入了针对 koishi.config.js 等文件变动的重载支持
- koishi-plugin-eval 支持了多语言接口（目前官方仅支持 typescript）

### Features

- **cli:** 新增了 `watch.fullReload` 配置项 (=44881a7b8263fe84f5271f98815343c7a2a7b2df)
- **core:** 修改了 `autoAssign`, `autoAuthorize` 的默认值以获得更好的上手体验 (=8a7503d651c39d6ab0a04508843a7032e3f10236)
- **core:** 优化了 `Adapter.WsClient` 的提示信息 (=959fa2b4498429c539ec49a37d7b04d86033e204)
- **eval:** 新增了 `loader` 配置项，可用于实现多语言 (=b4dc3350bf327895744bc33fc62d006e6445142b, =f16c64f7d60c4b35cd4211f3a31699e86aa64a25, =8639942d937593ace10f753efb90fa6a539642c5)
- **puppeteer:** 新增了 puppeteer/start 事件 (=ad9aa35b5d254562435c9069465ff065b560d4c9)
- **webui:** 重构了部分代码，将 `ctx.webui` 实现为一个 Adapter 实例，同时与沙箱有关的功能移至 koishi-plugin-chat (=6089379fae4f4b6ac1d5d21288cea57acc3689c6, =8735b3b9cccee00f7d35eb91fc2f99c1d0d97caa, =43e00b924940c12cb704a6673e14501237699b8d, =fc0b2a7137b580ef1ceff360c286e3d46a232cc8)

### Bug Fixes

- **chat:** 修复了 windows 客户端发消息产生的 \r 导致控制台信息异常的问题 (=7e1953901ad8252b3558961c185a820830501157)
- **discord:** 修复了 #212 带来的报错问题 (=3a7e6b27d22c625504e756df856f5ac857420b3f)
- **onebot:** 修改了 http, ws-reverse 协议中的默认路径为 `/onebot` (=f4ab9c176d4c17bad39e8ffe5e92150983d3eb2d)
- **webui:** 使用 `ref` 代替 `ctx.$el`，修复了生产环境报错问题 (#221) (=312356c6d424e7a9ab2e1caccbc3b33a49758bc1)
- **webui:** 修复了 body 无法滚动的问题 (#220) (=e3b68947b3a364c734f03aa09a0306b32861733d)
- **webui:** 修复了 #215 带来的沙箱页面样式失效问题 (=3f489741a7fa8672fe2690469c9f04d9cf2d66a6)
- **webui:** 修复了 MySQL 支持未能正确实现 ORM 导致 webui 加载报错的问题 (#224) (=211bd99421399711c5ab720725f0b32ff6b7d9a0)

## [Koishi 3.7.2](https://github.com/koishijs/koishi/releases/tag/3.7.2)

### Features

- **discord:** 优化了消息类会话的附属字段 (#212) (=a280e52561551d7fe6174dcc675ff5046022ab02)
- **eval:** 现在可以在上下文中直接访问 `ctx.worker` 了 (=1e23160347c3708a4a726a3ae7ff0e290826ec94)
- **eval:** 实验性地支持了 `worker.addSetupFile()` (=c5f3079e9c6053e712b18a8e35269b7e40c3f110)
- **utils:** `segment.from()` 新增了第二个参数 `options` (=6c59d862b5479ec7578491075dfa7219d444aba9)
- **webui:** 支持了虚拟消息列表，解决了大量消息同屏渲染的性能问题 (#215) (=3a72c99e8335721f49cb7aa60af370e4fc302296)
- **webui:** 图片查看器支持了快捷键（包括方向键，esc 和回车） (=91247e14cadc12af450e42ffc0dd27dd462aee7d)

### Bug Fixes

- **cli:** 修复了 koishi init 在 windows 上可能报错的问题 (#205) (=691b7c7c6bc174da870b0adf838bd6df89f7d1ba)
- **cli:** 修复了执行热重载时会非预期地重载部分插件的问题 (=32e9f2da3e54015d3f43e92076450dc5d7955e8a)
- **teach:** 修复了错误的 `authority.context` 配置项行为 (#208) (=89d53b10a85c40d2f5b27d10867b592b699f5811)
- **webui:** 修复了插件提供的 CSS 没有被网页加载的问题 (#214) (=1de4e7b6470f3e39f75cfb9166dc10820eafbbb4)
- **webui:** 修复了 title 配置项对导航栏不生效的问题 (#213) (=b429522775c4cbcca0ef1ae482a49093d920a7ce)

## [Koishi 3.7.1](https://github.com/koishijs/koishi/releases/tag/3.7.1)

### Features

- **adventure:** 加入了好感度相关教学功能 (=f7e77f03ebdbc4160ee5c26be24547b2160b482c)
- **adventure:** 重新组织了模块结构 (=d6dd1289629ae8d066a302105fc61998f0ef8740)
- **chat:** 支持了客户端发送消息 (=27da2e5e0febbd8cebde8901f6773a0e5babc26c)
- **chat:** 支持了头像显示和引用回复 (=9ced6c19361f5b612843116f2046b2b5389dd16f, =2abdd458847211f747e185ee00cdb12773d5a7cf)
- **core:** 在 send 事件中加入更多 author 字段 (=59ebaa468c79782edbdeb9032bfb7c309b5f12aa)
- **webui:** 支持了资源服务器以解决跨域问题 (=16f24411cecb5053f4e8191e0487b346a81e9715)
- **webui:** 支持了图片查看器，包括图片点击缩放、切换和旋转等功能 (=9d20614d4fc13e55efed6757d6b04d3ffc023596, =95e5181be07858106a3957bb7bc4e3db87485e0b, =6a48912e7d55350c57a699f093a6405f385baeb8)

### Bug Fixes

- **chat:** 修复了没有鉴权的问题 (=c0738b7efa1ac93aee9ef08b251c9410c22cdc2b)
- **cli:** 支持了在 koishi.config.js 中使用 es 模块语法 (=8a20fa7957ffe1ab51b2437eea67ec37e5274279)
- **common:** 修复了撤回失败时异常报错的问题 (=c9f665ef4e22bbfb72126801400cbe741672f494)
- **common:** 修复了无配置时部分事件会触发报错的问题 (#209) (=3ab470fb2ce3c8c6eb10d7acef9ddbffeef8304e)

## [Koishi 3.7.0](https://github.com/koishijs/koishi/releases/tag/3.7.0)

### Notable Changes

- 提供了 `ctx.with()` 方法，能够妥善处理插件之间的依赖关系

### Features

- **chat:** 支持了消息推送 (=eb1ed8582d99530f8a16feff0f95cd0e53ed0b46, =d6509c3e8f90dcbb76ba2c01c86f2ec5cd7cf6f4)
- **core:** 支持了 `ctx.with()` 方法 (=fa03edebe00c0bb0e00bbd9743844ebc65041c20)
- **discord:** 添加了一批 Bot API (#193) (#204) (=aae8a25f1b62897067c88e66f5bf810e8c1e902a)
- **eval:** 支持了沙箱本地存储 (#96) (=1d8ee8ffe7ad88f052f490e01ae8463f598aac59, =f705a03058823904dc258fe242c11ce33bfd0351)
- **eval:** 重构了事件钩子，允许用户处理发送行为 (#194) (=cf4be063646c9e6046628dd64e87b1f8834c5aed)

### Bug Fixes

- **discord:** 修复了发送本地文件失败的问题 (#201) (#202) (=e0576e5ff74fc80ff12b6869410ee4570106db82)
- **teach:** 修复了未使用 Assets API 时前端显示 NaN 的问题 (=a45811dafc4c9be9e462262463ce944c2d1c981f)
- **utils:** 修复了 `segment.parse()` 未返回转义前文本节点的问题 (=2cad31231aa4e4d3cb6b2218ed43cfd64e280875)
- **webui:** 修复了未使用 Assets API 时服务端报错的问题 (=4c84f33a86cdec25fef529dd708b6206414e55ce)
- **webui:** 修复了鼠标悬浮到小时图表的时候报错的问题 (=22988d5cb46533c9703e814602fb91b748173bbd)
- **webui:** 修复了登录和登出时页面切换异常的问题 (=72373773eda0aa9f6174755bf324bb08e0bad87e)
- **webui:** 修复了使用扩展路由时，初始访问无法显示页面的问题 (=5b5a21c1a0f5c7d68959f7aaa3a1e41eeec4115e)

## [Koishi 3.6.1](https://github.com/koishijs/koishi/releases/tag/3.6.1)

### Features

- **assets:** 支持了 base64 协议 (=95adc1773591e613ecc70339db688cda96dd6347)
- **assets:** 优化了配置项默认值的推导 (=8ec40d7e470209ca770396e310e2d9b2a05c2c6f)
- **core:** 支持了函数类型的 `optionConfig.hidden` (=c72f607befaf12e918b097bc76aee0a320900af1)
- **common:** recall 指令每次撤回后将按照 `delay.broadcast` 延迟一段时间 (=dfede399984728f7fe3350b4e786a5c11641a499)
- **github:** github 指令选项添加了权限限制和上下文检查 (#182) (=a4264e9f302116538fa678aeca9a6f1b6ad13fd6)
- **webui:** 在沙箱中支持了 clear 指令，用于清除历史记录 (=d23c170af8ccc2ec5d28df18d22b024800d201a6)
- **webui:** 在沙箱中支持了发送和接收图片，并提供了统一的 chat-panel 组件 (=7c1724a1b4c9e07dbf004d63ad79014fb37f642f, =0f95246ad269c9c4525bfe90f1181713b8c3129a)

### Bug Fixes

- **cli:** 修复了触发热重载时会删除部分 node_modules 中的文件缓存的问题 (=ee7bf3df3b23281a456bf9e7c05fa7b05c0fdd6e)
- **core:** 修复了在指令回调中 `return session.execute()` 会导致产生两个输出的问题 (=a2993f7a3409f3cbc3cf604026218eedfa24dea6)
- **core:** 修复了指令调用以插值结尾时，会产生错误输出的问题 (#190) (=ed1e2d07c43af159bbcfed258a0d840a201a02f4)
- **discord:** 修复了 `axiosConfig` 配置对发送 embed 消息无效的问题 (#198) (=679e8e00bace7ccc481ee91fb5f50e45908e9464)
- **eval:** 修复了当会话不处于生命周期时，调用 eval 会导致报错的问题 (#197) (=66342989cfaa0c9578d3e6fbee75ea6850420134)
- **kaiheila:** 修复了网络异常时可能导致程序崩溃的问题 (=bc1817051a44b215a1f53abc79c89629ae6f3997)
- **mongo:** 修复了 `db.update()` 不产生效果的问题 (#188) (=d5c707fe6a1d7e0a3e13b41dced81e3fb8600871)

## [Koishi 3.6.0](https://github.com/koishijs/koishi/releases/tag/3.6.0)

### Notable Changes

- koishi-plugin-status 更名为 koishi-plugin-webui 并发布，支持了由插件扩展页面的功能
- koishi-plugin-common 支持了 recall 指令，同时丰富了 echo 指令的语法

### Features

- **chat:** 初始化 chat 插件，提供了等价于原 common 插件 debug 的功能 (=c3270c47240666afaf82c0de54b5fde7bdb654ff)
- **common:** 将每个子功能分别暴露为插件导出 (=8f1ba356967cfdf9dd0a2ecc65069a3810a22d56)
- **common:** 新增了 echo -c / -u 选项，用于指定输出的目标 (=70bb26c0fbf6d5cafac258b8806a265e5af08cb5)
- **common:** 新增了 recall 指令，用于撤回当前频道中的发言 (=f78651677542915318235d2e60b21702b9c88bcb)
- **core:** 允许在一个插件内注册当另一个插件加载时触发的子插件 (=cfd91517f74854bddfe24d2ed35c5b910ba4da8b)
- **core:** 新增了 `Context.delegate()` 方法 (=84dc67650bba26e4c82f087345f4c7e7f4427ef7)
- **discord:** 支持了发送 base64 格式的资源消息段 (#196) (=2e94f454b91080997a998999a2574b1152a94bc8)
- **utils:** 支持了在模板中使用双花括号插值的语法 (=5c7ff2a0bcf052baf49f3ddaaf724ebcdf97b2be)
- **utils:** 支持了 `segment.image()` 方法中直接传入 Buffer 或 ArrayBuffer，会自动转换为 base64 格式 (=02691b8c86b6faf851f43762cdae7d42fa213177)
- **webui:** 重构了服务端代码，提供了 `ctx.webui` 接口，并允许其他插件扩展页面 (=a8ff8a62abeb0483b1bc4a61dc3aa4607fb81b70, =e7e28cb4c0806fca1ddc720845f7287b014060ab, =d626a14c7f6341cf0e25fb76c754360a3f1e0f8d, =904e589fa0a613931796b8d6b9127f04eba7e948, =2cf79b5ecf457e00ae646729482ecfb068498498, =217fbcdba46cec74559e022bd37e41d35a85a1e5)
- **webui:** 支持了页面访问权限检查 (=a9b4cf4bfda4330167a6a5870375e1814cbe82a2)

### Bug Fixes

- **onebot:** 修复了错误的 `bot.$sendGroupNotice` 实现 (#191) (=dc7d83247d877812f11172a8aae810fb2d323d36)
- **puppeteer:** 修复了 tex 指令输入没有被转义的问题 (=d8b0f7558389c5554a3c8d880d9c581b65f531e1)

## [Koishi 3.5.0](https://github.com/koishijs/koishi/releases/tag/3.5.0)

- koishi-plugin-status@4.0.0 正式发布
- 新增了 `ctx.transformAssets()` 方法，结合同时发布的新官方插件 koishi-plugin-assets，可用于实现图片等资源文件的在线转存 (#186)

### Features

- **assets:** 支持了使用 koa 构建的图片转存服务 (=990748efebe9c713863a9be270a90af99413e7db)
- **assets:** 支持了 [sm.ms](https://sm.ms/) 的图片转存服务 (=95ad71e27eda07501632344cde76a1c297365f10)
- **cli:** koishi init 现在支持初始化 discord 机器人了 (=cc8f60907273f17bff2d1cd2124179e80c6ed3cf)
- **core:** 新增了 `ctx.assets` 接口和 `ctx.transformAssets()` 方法 (=fa9331f30d0fec2fb9c325772a4d525fe7477fcb)
- **github:** 支持了资源转存机制，以避免链接失效的问题 (=f6875a17aa3fd9543d19cebee86f8ce08d1274d1)
- **mysql:** 利用 ORM 机制，现在不需要手动指定 index 了 (=f15df3b2754a330df77e355a8fc54603d44971f8)
- **status:** 优化了 `Profile` 的获取机制和类型标注 (=f8f8d6efcc428b85064fd589207b43771500541a)
- **status:** 新增了「教学」页面，将显示 koishi-plugin-teach 相关信息 (=29f2d8a762f43cd697adb34cdfd4e1f6d6fcb68a)
- **teach:** 使用 ORM API 重构并简化了部分数据库代码 (#185) (=cca4ded842ad6d1bfe8e27012472f9a18547ad3d)
- **teach:** 支持了资源转存机制，以避免链接失效的问题 (=b009502cd71a3bff305e4db36e7b514fc76a3d52)
- **utils:** 新增了 `segment.transform()` 方法 (=a78f40791515854f015c1afd71d6c412271a01f0)

### Bug Fixes

- **core:** 修复了使用 WebSocket 在运行时长时间离线导致的报错问题 (#180) (=ff470d5af998a3e3d958e4fc4ee273036cae12e6)
- **github:** 修复了 GitHub 相关功能不支持带 `.` 的仓库名的问题 (#183) (=a09081417d0fda300dc9401a2ad9a074e5280a20)
- **github:** 修复了 GitHub 相关数据库使用 MySQL 的初始化问题 (#184) (=eb9ada57ad73729137f85929f8187b519f8bfc41)
- **github:** 修复了快速回复机制失效的问题 (=8b6f0a452c34dfffc5697e6fa5e5fc427051ca58)
- **kaiheila:** 修复了 WebSocket 重连失败的问题 (#187) (=2b99b08a3f02b0955a41fe1445038190707ac04b)
- **kaiheila:** 修复了 WebSocket 启动时未能获取机器人信息的问题 (=6a47e39d33235543c76d691763db9f28750c0a46)

## [Koishi 3.4.0](https://github.com/koishijs/koishi/releases/tag/3.4.0)

### Notable Changes

- koishi-plugin-github@3.0.0 正式发布，将支持众多新特性 (#174)
- 支持了 [ORM API](../guide/database.md#使用-orm) (#178)，整合了多个插件的重复代码，有效降低了数据库实现的难度

### Features

- **core:** 支持了 ORM API (#179) (=f2e5535df0c82e947c0fd133b366dda8174fa409, =256a04002a1bf4ef55de4580f8ca43accaf53acf)
- **core:** 新增了配置项 `selfUrl`，将被 telegram, github 等功能共用 (=967d3f5f7115c132b8431802c2844f2126b85c9a)
- **github:** 支持了 github.repos 指令，用于安全地添加 webhooks (=9e962dc98d44527e99c3681896df5b6f070f18a3, =c67ffeea691568ff96db60c00878c0f7e5a57cff)
- **github:** 优化了 github 指令，用于在任意频道内订阅已添加的仓库 (=6ef52a53714df877d629710d8a2d9be16c7efcd5)
- **github:** 优化了指令的提示信息，将 github 和 github.repos 指令整合使用 (=53f4e8fe8347ee125f20e0232fc2fe366458ab3d)
- **utils:** `clone()` 方法支持了 RegExp 和 Date 类型的数据 (=f2e5535df0c82e947c0fd133b366dda8174fa409)
- **utils:** 使用内置模板函数来格式化输出的时间以实现不同地区输出的统一 (=f2e5535df0c82e947c0fd133b366dda8174fa409)

### Bug Fixes

- **core:** 修复了当含有插值调用的时候，有小概率不会获取内层指令所需字段的问题 (=f2e5535df0c82e947c0fd133b366dda8174fa409)
- **utils:** 修复了 `clone()` 方法无法处理 undefined 和 null 的问题 (=f2e5535df0c82e947c0fd133b366dda8174fa409)
- **github:** 修复了一个 typo (#181) (=5378134c57e2602d6ad014c916702127d1928aa3)
- **github:** 修复了大小写混用带来的无法识别问题 (=780466330c3a7897256879e60032dc4ce03de9f1)

## [Koishi 3.3.1](https://github.com/koishijs/koishi/releases/tag/3.3.1)

### Notable Changes

- koishi-plugin-rss@2.0.0 正式发布

### Features

- **github:** 优化了 markdown 处理，现在能够推送图片信息了 (=16c7059549416703f732af1f3f4adf6cf9705300)
- **status:** 默认情况下将使用相对路径作为 endpoint (=acfbdc06cc663bcdd703dcd80390c2dfabfa09f4)
- **status:** 支持了配置项 `config.handleSignals` (#158, #163) (=56909964a2e5961c8ac334c736f7dbaf4b61c32b)
- **status:** 支持了配置项 `config.title` (=57e5ebaf42299d5a9cc481932f031609f2e20ad7)
- **telegram:** 优化了消息段处理 (#167) (=19f253eab53e54795625cbeb75e9f2b3663d3edc)

### Bug Fixes

- **chess:** 修复了主动和被动跳过时可能手序错误的问题 (#169) (=e814fc9f5114d9f6b2396cf8bf3d3296a2c7c24b)
- **chess:** 修复了第一步悔棋时可能存在的问题 (=e7785ca1902a05fc6a1a79092e23a0ae9f4298de)
- **core:** 在指令执行前检查其上下文是否匹配 (#168) (=e7d597025c1701e33aadd5c481aa109ce20d44ed)
- **image-search:** 修复了错误的指令树结构 (#170) (=37aec5948c72a87adf9e9fa024f568d4bc5dbe7b)
- **mongo:** 修复了 `database.getAssignedChannels` 的错误实现 (#175, #176) (=cd23bc7afe21c686559e31e84ce6c0c051176deb)
- **onebot:** 修复了 notice/poke 事件没有 `channelId` 的问题 (#172) (=e157a5576d16a96077c26fea051abcd785a1f1cc)
- **status:** 移除了不必要的开发依赖 (=704db01bc6d67fcf36d68d47e9833223943be38b)
- **status:** 修复了生产模式下客户端报错的问题 (=939c3bcbf63c35d430dc4726f8c2c077b99a7fb3)
- **status:** 自动添加尾端 `/` 重定向以解决路径错误的问题 (=f2b6e67415aa29851806d7d683a57ea8b97022bc)
- **status:** 密码登录需要检测浏览器是否为安全环境 (#171) (=2738d34789653c969ec62e4246bfc03d650b7877)

## [Koishi 3.3.0](https://github.com/koishijs/koishi/releases/tag/3.3.0)

### Notable Changes

- 下一代 status 插件支持了生产模式
- 新增 command patch 功能：通过 patch 创建的指令如果不存在，将不会发生变化；如果已存在，将按照后续的链式调用进行修改

### Features

- **core:** 优化了指令创建时的报错信息 (=a4498ead0f7bb8aa4eb999e2a71e908f9fe0403e)
- **core:** 支持了配置项 `commandConfig.patch` (=8c2ce5ae1570572a1d714d59965aa5480c4ec8e9)
- **status:** 使用 Koishi 自己的端口而不是新建端口 (=06fb3ae0f9679acdb3bb8c31ef07b5241fd16da9)
- **status:** 支持了生产模式构建 (=7c4ba3b0051121929fd61dc0dd55984636975324)
- **status:** 优化了代码分割，同时修复了安全性问题 (#161) (=fe6f2c6c517315c2c33cf4d45d4682ffe379c390)
- **status:** 移除了 element-plus，降低了打包体积 (=cc0e6f6aacc38c76c2f6d9684700dacae8627c18)
- **status:** 使用单一机器人实例作为沙箱 (=5e989ebc83d2638bffbd6ce198c696a21dfa7645)
- **status:** 客户端自动保存沙箱聊天记录 (=475cd244364e3b7f606741befbad3a002e5332e3)
- **telegram:** 支持了消息中的 sticker (#164) (=099b5c2c06097100ff586f70a793d9caf08bd0fe)

### Bug Fixes

- **cli:** 修复了插件可能在卸载完成前重载的问题 (=2370acae398f1f206832f40ac7bd5bdc45b640ae)
- **core:** 修复了部分选择器生成的上下文可能不具有可卸载性的问题 (=a1f11d6afe256bad9cc355e123a16609d87b0cdc)
- **schedule:** 支持了无机器人运行的情况 (=2a778e446f8a03b597874662e98f7582d12c234f)
- **status:** 修复了用户数据加载错误的问题 (=36b3890b2f14207269362eb09292ebeb7445d76f)
- **status:** 修复了 MySql 建表报错的问题 (#166) (=b7ce209d7e4c7fdbbdb37294b2908f34a0192f7b)
- **utils:** 修复了 supports-color 相关类型标注错误的问题 (=dd86bc5ee7619ef666410196882965be2592ea58)

## [Koishi 3.2.1](https://github.com/koishijs/koishi/releases/tag/3.2.1)

### Notable Changes

- 下一代 status 插件支持了沙箱和登录功能，并提供了 mongo 数据库支持

### Features

- **database:** 支持了自定义表，允许不同数据库对统一功能提供不同实现 (=875f75b16e0205ae0492823c8cab61014e5f5e71)
- **status:** 加入了路由，导航栏和侧边栏，优化了页面样式 (=89583a357814ce286637da45e8d1f25d99d5fb23, =c8df0fa9f27e6373603d5fa0c5ed02ae3b4dbe72, =86043a4ac33e2ac2ccf7f53e6c4969f79ae9ef67, =1cf52be1b6c11136d16e44fb2917427efc40db39, =42381c5d5752d9af63525ec5b34945a4e587f973, =5ff956f8cc6f2e2ff22f471a4de34d0e02afc2dd, =bd33be6536a6a33f18e6f754f8186f9ddd49c775)
- **status:** 实现了沙箱和登录功能，增加了 token 机制 (=bf99513a04e7199e71ede2a22cc66ff7b8b17bb5, =c50ba31962e8ae53bf251ed858c1ef5e565439ed, =064810cf22b89131feb4b7ef86a9d52e79b07514, =bbfac8af45384f3e2f8f4b31857bf4e14fdb98a2, =2e03e5d3dc01627d62820f74d4b1248965d98a19)
- **status:** 优化了数据传输接口，并支持显示数据库大小 (=d17428e25b82248e0ff428554da25d3db30a4659, =dfdba08a6c913c97b8edf44db89274401e715998)
- **status:** 提供了 mongo 数据库支持 (#160) (=6956c815bfa2522b5e47619b425e4dd2c8e953ae)
- **utils:** 新增了 `remove()` 帮助函数 (=e50017899232a6772133fec94bc6c8e8438b4854)

### Bug Fixes

- **core:** 将 disable 设置为指令所需字段，修复了定时指令报错的问题 (#155) (=97d8732cf6f0be32057dde4ef14ae51d6aff151d)
- **status:** 修复了仪表盘中图表溢出界面问题，在沙箱中提供了自动滚动至底部的功能 (#157) (=a9760356c02698733b7ac05364462187bae03239)
- **discord:** 回退了上个版本更新的 embed segment，采用会话属性的方式重新实现 (=7da07841c18dd3c83e42f60e0e0750f7dd66bb78)
- **core:** 修复了快捷调用不会受到上下文限制的问题 (#159) (=49c2c398c956cd6365e3462a5c38168a8011ba97)

## [Koishi 3.2.0](https://github.com/koishijs/koishi/releases/tag/3.2.0)

### Notable Changes

- koishi-plugin-chess@3.0.0 正式发布
- 发布了下一代 status 插件的第一个 alpha 版本，新版本将包含一个网页 UI，整合了丰富的数据统计功能，包括消息数量统计、指令调用统计和问答文字云等等

### Features

- **core:** 优化了 `ctx.dispose()` 发生错误时的处理逻辑 (=bf1801146ba183f904e228aa8db50643436f732e)
- **core:** 支持了非 apply 形式的 Database 成员 (=e90bf73c54d0f367fafff9cf85585bd50c2ce68b)
- **adventure:** 支持了 disposable 协议 (=1e91ae599cb383c66c4472ba0bd8fdf7f6651d1d)
- **common:** 优化了 switch 指令的提示文本 (=389341f67175168aa9e510ae4ae73bfa98a7b6f4)
- **discord:** 在消息中添加了 embed segment (=22dc77439c7fec81b2c1bf545fb8f136112aeebd)
- **image-search:** 优化了错误处理 (=14a2aeeb4aacdc91af36b733e358487d2ac0cefd)
- **status:** 支持了网页端和数据统计功能 (=9dcdd694735a12ee767c379594446f29e867e41a, =10e9bf696fe861e1e96c86b960fac53dfdd09dc4, =964390b59953c75623baf185fd35e5c972f42f54, =1f8b1adbfda2f6b1d973f8d33c63fc736b45caaf, =2c91f87fba9ac2df58245622ac5f4fababe5c973, =fbd767a29a52b299595199c4a3227f732d4600ec, =66a46a64a1f990cb0db17462aacaf84e8da74727, =b3b4711240ebe5b1f574089e73f0bc7b61d5bfa2, =b3d8b70a66a7998cd92b5723ab0225d5096681ad, =00f9c469f9207ebcfc9a5cdf47050ebc4c7bc26c, =cbe38c34e2ed0e2b353aefc8b8b8bfcf369cd954, =5ddf07bf2e5d1aa2ab24ba356cb6dd1adaa6cfec, =c539454acd48ca0663b664bba06d87fab525ced6, =ee112cf0296e8a8a42d16033146dc6f2e37c5f80, =db6f80876cc48789f5e582117968c22ae37aad06, =593f3e94b6903f47c2032bbd486fed7f62dec65f, =0a83138bc041c33d038eca7d993f3b874e75671d)
- **tools:** 新增了百度百科支持 (#153) (=ae3f004e8ffc7ca6c1dfb02893e0bc83a47e308d)

### Bug Fixes

- **chess:** 修复了发起者首先落子时会导致 @全体成员 的问题 (=763e9750b9772bb1d17fd6258101d29c3f5b74c1)
- **common:** 绑定用户前将删除原账号，防止键冲突 (#152) (=de3baaac5ba8156ba771d7ae437f48e554da85ea)

## [Koishi 3.1.1](https://github.com/koishijs/koishi/releases/tag/3.1.1)

### Notable Changes

- koishi-plugin-mongo@2.0.0 正式发布
- koishi-plugin-mysql@3.0.0 正式发布
- koishi-plugin-teach@2.0.0 正式发布

### Features

- **core:** 优化了 Command API 的类型标注 (=2b783453d7c2c39ba8da26993c9398457b9f7590)
- **core:** 当注册了重复的插件时将显示 stack trace (=30ea75072e08d376b17f9a01ebadd4f8986c84ec)
- **teach:** 重新支持了 substitute 选项 (#147) (=b42773b7e890e89de2c7c67bc70d070d3270df32)

### Bug Fixes

- **core:** 修复了指令解析中的错误行为 (=2029ad5a35b1ff333b60dd03d906c88b320f8884, =feb75cbfb775da844337e59d9426ba34c1e87729)
- **core:** 为 `Adapter.WsClient` 提供了默认的重连机制 (=1654831314c703451e78e1dfbc911e750c842061)
- **common:** 修复了错误的 `repeatState.user` 类型标注 (=84fe7e42fa10121d56e08aa4dfde9561c5710b8c)

## [Koishi 3.1.0](https://github.com/koishijs/koishi/releases/tag/3.1.0)

### Notable Changes

- koishi-plugin-image-search@3.0.0 正式发布
- koishi-plugin-tools@2.0.0 正式发布
- 新增了 switch 功能，允许运行时在特定的频道禁用某指令

### Features

- **core:** 指令定义中的展开语法现在也有正确的代码提示了 (=c6893857ab49ea9fa212c919870e10f6be9aff5a)
- **core:** 优化了 Domain 的错误提示，新增了 date, posint 等内置类型 (=e2bc85608d8b57223ee4f36e11d49a9cdbb91b36, =c4d84b36539f374fdabcdd0081bb068aa5406ae9)
- **core:** 新增了 `bot.avatar`, `bot.discriminator` 属性 (=a6ec223810d36b995217a2c5bea0471b2c5c383a)
- **common:** 新增了 switch 功能，允许运行时在特定的频道禁用某指令 (=7b5948d45a582bf583b558c0c578d5093a6d1ba4, =16204823c83843f2ebe160a98d67265663a8b5d6)
- **common:** 加入了更多模板，进一步提高了可扩展性 (=f5e018f34dcc6afa7fde226a6be04c9b07a5f4db)
- **discord:** 消息处理优化和更好的 embed 支持 (=c517bf0cf1226f80c815b526ca4a83cc864e4cfe, =29ee7d196316956aa26d3ad5f7017c7aaad75233, =dfcb7dad62f97b532099ee105c99fbdb078417dd, =3aa2b9411b93179b03d2a4af0c1fbd0a27bec0da, =07dbd6692a92ef8a0dcf0ce54f615c443d9fb4a0, =7c9706f218396c4bba93c3de3ea48210886277fb, =963d4a6fa7623e54940abdb11f57284501e93491)
- **image-search:** 支持了 iqdb 搜索 (#143) (=9cd9abba68436517c7d67ff08bed601011bebcd6)
- **tools:** 新增了 bilibili 链接解析功能 (=9a37afef7b9f85a5f53b53935190cea94a075029)

### Bug Fixes

- **core:** 修复了 `ctx.setInterval()` 的内存泄漏问题 (=42f9fa4f6f7b6acb5783b9d199f15c4f57f31890)
- **core:** 修复了 help 指令描述文本错误的问题 (#148) (=a1b8b9820d8083a99ff373ba8c576f11ff7b509d)
- **core:** 修复了指令选项中的空格数量错误的问题 (#148) (=72eb3621131b1f4ed33dd7233e13accb113d8a53)

## [Koishi 3.0.1](https://github.com/koishijs/koishi/releases/tag/3.0.1)

### Notable Changes

- koishi-plugin-common@4.0.0 正式发布
- koishi-plugin-puppeteer@2.0.0 正式发布
- koishi-plugin-schedule@3.0.0 正式发布

### Features

- **core:** 检测插件副作用和允许显式声明依赖 (=63956992afd49156cd7da528133cab1c9cdf520b, =2ec250f14f48a1d58cbc835d09166607562c86b7)
- **core:** 优化了 `Database.extend` 的类型标注 (=04ac3393412e15202a015796ce15a1cd32b12f39)
- **core:** 群组会话中，无前缀无称呼的消息将不会触发建议 (=d5a6f4e5f61fb6716e9a1cc6b15f9aeefa3501d8)
- **adventure:** 优化了编码逻辑，不再直接访问 mysql 插件 (=d5cb6a33b7950549b5fb9565925f8e4bacfcd5b2)
- **common:** 新增了 `config.generateToken` 配置项 (=e25588622ef16cce84c91a1a09e74c6b6c8c0a57)
- **common:** 优化了复读机的配置，并撰写了相关单元测试 (=4280a42346ea908c7e646f92a8e874936cc4df4c)
- **discord:** 优化了 embed 相关特性 (#145) (=f49073282e8bfbc0796249978db1f42b4fb79bc1)
- **puppeteer:** 支持了对特定选择器截图 (=278f85de9da74ec97679017e62a680cffe62f679)
- **test-utils:** 优化了断言方法的错误提示 (=bc53e08cafe8d95b2404d2cd00a989e3c960fdb6)
- **utils:** 新增了 `random.digits()` 方法 (=0ba42f9f92e75843dd1ed3419e4d8f7a0a1b77bd)
- **webui:** 实现了多级插件列表的显示 (=b338c445a7e731d42c8379426e5ce47a02024763)

### Bug Fixes

- **schedule:** 修复了热重载时可能发生内存泄漏的问题 (=1483031793fe0f62adc80d88f1ac3c9caaa48aa0)
- **test-utils:** 修复了错误的 `MemoryDatabase` 实现 (=e71590d5d2cf23a48a9f121dddd379d0558564f5)
