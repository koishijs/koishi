# [koishi-plugin-image-search](https://koishi.js.org/plugins/other/image-search)
 
[![npm](https://img.shields.io/npm/v/koishi-plugin-image-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-image-search)

koishi-plugin-image-search 封装了一系列搜图相关的指令，目前支持以下平台：

- [saucenao](https://saucenao.com/)
- [ascii2d](https://ascii2d.net/)
- [danbooru](https://github.com/danbooru/danbooru)
- [konachan](http://konachan.net/)
- [nhentai](https://nhentai.net/)

参考了 [Tsuk1ko](https://github.com/Tsuk1ko/CQ-picfinder-robot) 的机器人实现。

## 指令：image-search

- **别名：搜图**

image-search 指令检测当前输入中的全部图片，并依次进行搜索。如果 image-search 所在消息内没有检测到图片，则该指令会给出提示，并对下一条信息中的图片进行处理。

在搜索过程中，image-search 指令会首先使用 saucenao 进行搜索，当相似度低于 60% 时，会在搜索完成后使用 ascii2d 再次搜索。当相似度低于 40% 时，将不会显示 saucenao 本身的搜索结果（但是 ascii2d 的结果会显示）。

## 指令：saucenao

saucenao 指令是 image-search 指令的子指令。它使用 saucenao 进行图片搜索，机制与上面完全相同，但当相似度较低时不会使用 ascii2d 再次搜索，也不会略去本身的搜索结果。

## 指令：ascii2d

ascii2d 指令也是 image-search 指令的子指令。它使用 ascii2d 进行图片搜索，机制与上面完全相同。

## 参数配置

```ts
export interface SaucenaoConfig extends CommandConfig {
  /** 相似度较低的认定标准（百分比），默认值为 40 */
  lowSimilarity?: number
  /** 相似度较高的认定标准（百分比），默认值为 60 */
  highSimilarity?: number
}

export interface ImageSearchConfig {
  /** 基本配置参数，将用于所有搜图相关指令 */
  baseConfig?: CommandConfig
  /** image-search 指令的额外配置 */
  mixedConfig?: CommandConfig
  /** saucenao 指令的额外配置 */
  saucenaoConfig?: SaucenaoConfig
  /** ascii2d 指令的额外配置 */
  ascii2dConfig?: CommandConfig
}
```
