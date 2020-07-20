import { getPage, freePage } from './puppeteer'

interface Attributes {
  [key: string]: string | number | boolean
}

function hyphenate (source: Attributes) {
  const result = {}
  for (const key in source) {
    result[key.replace(/[A-Z]/g, str => '-' + str.toLowerCase())] = source[key]
  }
  return result
}

function escapeHtml (source: string) {
  return source
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export class Tag {
  public parent: Tag
  private children: Tag[] = []
  private attributes: Attributes = {}
  private innerText: string = ''

  constructor (public tag: string) {}

  child (tag: string) {
    const child = new Tag(tag)
    child.parent = this
    this.children.push(child)
    return child
  }

  attr (attributes: Attributes) {
    this.attributes = {
      ...this.attributes,
      ...attributes,
    }
    return this
  }

  data (innerText: string) {
    this.innerText = innerText
    return this
  }

  line (x1: number, y1: number, x2: number, y2: number, attr: Attributes = {}) {
    this.child('line').attr({ ...hyphenate(attr), x1, y1, x2, y2 })
    return this
  }

  circle (cx: number, cy: number, r: number, attr: Attributes = {}) {
    this.child('circle').attr({ ...hyphenate(attr), cx, cy, r })
    return this
  }

  rect (x1: number, y1: number, x2: number, y2: number, attr: Attributes = {}) {
    this.child('rect').attr({ ...hyphenate(attr), x: x1, y: y1, width: y2 - y1, height: x2 - x1 })
    return this
  }

  text (text: string, x: number, y: number, attr: Attributes = {}) {
    this.child('text').attr({ ...hyphenate(attr), x, y }).data(text)
    return this
  }

  g (attr: Attributes = {}) {
    return this.child('g').attr(hyphenate(attr))
  }

  get outer (): string {
    const attrText = Object.keys(this.attributes)
      .map(key => ` ${key}="${escapeHtml(String(this.attributes[key]))}"`)
      .join('')
    return `<${this.tag}${attrText}>${this.inner}</${this.tag}>`
  }

  get inner (): string {
    return this.children.length
      ? this.children.map(child => child.outer).join('')
      : this.innerText
  }
}

export interface ViewBox {
  left?: number
  right?: number
  top?: number
  bottom: number
}

export interface SVGOptions {
  size?: number
  width?: number
  height?: number
  magnif?: number
  viewBox?: ViewBox
  viewSize?: number
}

export class SVG extends Tag {
  view: ViewBox
  width: number
  height: number

  constructor (options: SVGOptions = {}) {
    super('svg')
    const { size = 200, viewSize = size, width = size, height = size } = options
    this.width = width
    this.height = height
    const ratio = viewSize / size
    const { left = 0, top = 0, bottom = height * ratio, right = width * ratio } = options.viewBox || {}
    this.view = { left, bottom, top, right }
    this.attr({
      width: width,
      height: height,
      viewBox: `${left} ${top} ${right} ${bottom}`,
      xmlns: 'http://www.w3.org/2000/svg',
      version: '1.1',
    })
  }

  fill (color: string) {
    this.rect(this.view.top, this.view.left, this.view.bottom, this.view.right, { style: `fill: ${color}` })
    return this
  }

  async toCQCode () {
    const page = await getPage()
    await page.setContent(this.outer)
    const base64 = await page.screenshot({
      encoding: 'base64',
      clip: {
        x: 0,
        y: 0,
        width: this.width,
        height: this.height,
      },
    })
    freePage(page)
    return `[CQ:image,file=base64://${base64}]`
  }
}
