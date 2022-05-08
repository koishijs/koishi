---
sidebarDepth: 2
---

# 发送网络请求

`ctx.http` 是 Koishi 的内置服务，其上封装了一套基于 [axios](https://github.com/axios/axios) 的网络请求 API。

你可能会有这样的疑问：为什么不直接使用 axios，而是使用 `ctx.http`？这是因为许多插件都需要发起网络请求，而诸如代理、超时等配置又通常是插件无关的。因此我们为这些通用需求提供了 [全局的配置项](../../api/core/app.html#options-request-proxyagent)，各个插件则只需要调用 `ctx.http` 即可。

## 实例方法

### http(method, url, config)

- **method:** `string` 请求方法
- **url:** `string` 请求地址
- **config:** `AxiosRequestConfig` 配置项
- 返回值: `Promise<any>`

### http.axios(url, config)

- **url:** `string` 请求地址
- **config:** `AxiosRequestConfig` 配置项
- 返回值: `Promise<AxiosResponse<any>>`

### http.head(url, config)
### http.get(url, config)
### http.delete(url, config)

- **url:** `string` 请求地址
- **config:** `AxiosRequestConfig` 配置项
- 返回值: `Promise<any>`

### http.post(url, data, config)
### http.put(url, data, config)
### http.patch(url, data, config)

- **url:** `string` 请求地址
- **data:** `any` 请求数据
- **config:** `AxiosRequestConfig` 配置项
- 返回值: `Promise<any>`
