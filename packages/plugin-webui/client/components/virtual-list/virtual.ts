import { reactive } from 'vue'

enum CALC_TYPE { INIT, FIXED, DYNAMIC }

const LEADING_BUFFER = 2

export interface Range {
  start?: number
  end?: number
  padFront?: number
  padBehind?: number
}

interface VirtualConfig {
  count: number
  estimated: number
  buffer: number
  uids: string[]
}

export default class Virtual {
  sizes = new Map<string, number>([
    ['header', 0],
    ['footer', 0],
  ])

  firstRangeTotalSize = 0
  firstRangeAverageSize = 0
  lastCalcIndex = 0
  fixedSizeValue = 0
  calcType = CALC_TYPE.INIT
  offset = 0
  direction: 0 | 1 | -1 = 0
  range = reactive<Range>({})

  constructor(public param: VirtualConfig) {
    this.checkRange(0, param.count)
  }

  updateUids(uids: string[]) {
    this.param.uids = uids
    this.sizes.forEach((v, key) => {
      if (!uids.includes(key) && key !== 'header' && key !== 'footer') this.sizes.delete(key)
    })
  }

  // save each size map by id
  saveSize = (id: string, size: number) => {
    this.sizes.set(id, size)

    // we assume size type is fixed at the beginning and remember first size value
    // if there is no size value different from this at next comming saving
    // we think it's a fixed size list, otherwise is dynamic size list
    if (this.calcType === CALC_TYPE.INIT) {
      this.fixedSizeValue = size
      this.calcType = CALC_TYPE.FIXED
    } else if (this.calcType === CALC_TYPE.FIXED && this.fixedSizeValue !== size) {
      this.calcType = CALC_TYPE.DYNAMIC
      // it's no use at all
      delete this.fixedSizeValue
    }

    // calculate the average size only in the first range
    if (this.calcType !== CALC_TYPE.FIXED && typeof this.firstRangeTotalSize !== 'undefined') {
      if (this.sizes.size < Math.min(this.param.count, this.param.uids.length)) {
        this.firstRangeTotalSize = [...this.sizes.values()].reduce((acc, val) => acc + val, 0)
        this.firstRangeAverageSize = Math.round(this.firstRangeTotalSize / this.sizes.size)
      } else {
        // it's done using
        delete this.firstRangeTotalSize
      }
    }
  }

  // in some special situation (e.g. length change) we need to update in a row
  // try goiong to render next range by a leading buffer according to current direction
  handleDataChange() {
    let start = this.range.start

    if (this.direction < 0) {
      start = start - LEADING_BUFFER
    } else if (this.direction > 0) {
      start = start + LEADING_BUFFER
    }

    start = Math.max(start, 0)

    this.updateRange(this.range.start, this.getEndByStart(start))
  }

  // when slot size change, we also need force update
  handleSlotSizeChange() {
    this.handleDataChange()
  }

  // calculating range on scroll
  handleScroll(offset: number) {
    this.direction = Math.sign(offset - this.offset) as any
    this.offset = offset

    if (this.direction < 0) {
      this.handleFront()
    } else if (this.direction > 0) {
      this.handleBehind()
    }
  }

  handleFront() {
    const overs = this.getScrollOvers()
    // should not change range if start doesn't exceed overs
    if (overs > this.range.start) {
      return
    }

    // move up start by a buffer length, and make sure its safety
    const start = Math.max(overs - this.param.buffer, 0)
    this.checkRange(start, this.getEndByStart(start))
  }

  handleBehind() {
    const overs = this.getScrollOvers()
    // range should not change if scroll overs within buffer
    if (overs < this.range.start + this.param.buffer) {
      return
    }

    this.checkRange(overs, this.getEndByStart(overs))
  }

  // return the pass overs according to current scroll offset
  private getScrollOvers() {
    const offset = this.offset - this.sizes.get('header')
    if (offset <= 0) return 0

    // if is fixed type, that can be easily
    if (this.isFixedType()) {
      return Math.floor(offset / this.fixedSizeValue)
    }

    let low = 0
    let middle = 0
    let middleOffset = 0
    let high = this.param.uids.length

    while (low <= high) {
      middle = Math.floor((high + low) / 2)
      middleOffset = this.getOffset(middle)

      if (middleOffset === offset) {
        return middle
      } else if (middleOffset < offset) {
        low = middle + 1
      } else if (middleOffset > offset) {
        high = middle - 1
      }
    }

    return low > 0 ? --low : 0
  }

  getUidOffset(uid: string) {
    return this.getOffset(this.param.uids.indexOf(uid))
  }

  // return a scroll offset from given index, can efficiency be improved more here?
  // although the call frequency is very high, its only a superposition of numbers
  getOffset(givenIndex: number) {
    if (!givenIndex) {
      return 0
    }

    let offset = 0
    for (let index = 0; index < givenIndex; index++) {
      offset = offset + (this.sizes.get(this.param.uids[index]) ?? this.getEstimateSize())
    }

    // remember last calculate index
    this.lastCalcIndex = Math.max(this.lastCalcIndex, givenIndex)
    this.lastCalcIndex = Math.min(this.lastCalcIndex, this.getLastIndex())

    return offset
  }

  // is fixed size type
  isFixedType() {
    return this.calcType === CALC_TYPE.FIXED
  }

  // return the real last index
  getLastIndex() {
    return this.param.uids.length
  }

  // in some conditions range is broke, we need correct it
  // and then decide whether need update to next range
  checkRange(start: number, end: number) {
    const keeps = this.param.count
    const total = this.param.uids.length

    // datas less than keeps, render all
    if (total <= keeps) {
      start = 0
      end = total
    } else if (end - start < keeps - 1) {
      // if range length is less than keeps, corrent it base on end
      start = end - keeps
    }

    if (this.range.start !== start) {
      this.updateRange(start, end)
    }
  }

  // setting to a new range and rerender
  updateRange(start: number, end: number) {
    this.range.start = start
    this.range.end = end
    this.range.padFront = this.getPadFront()
    this.range.padBehind = this.getPadBehind()
  }

  // return end base on start
  getEndByStart(start: number) {
    return Math.min(start + this.param.count, this.param.uids.length)
  }

  // return total front offset
  getPadFront() {
    if (this.isFixedType()) {
      return this.fixedSizeValue * this.range.start
    } else {
      return this.getOffset(this.range.start)
    }
  }

  // return total behind offset
  getPadBehind() {
    const end = this.range.end
    const lastIndex = this.getLastIndex()

    if (this.isFixedType()) {
      return (lastIndex - end) * this.fixedSizeValue
    }

    // if it's all calculated, return the exactly offset
    if (this.lastCalcIndex === lastIndex) {
      return this.getOffset(lastIndex) - this.getOffset(end)
    } else {
      // if not, use a estimated value
      return (lastIndex - end) * this.getEstimateSize()
    }
  }

  // get the item estimate size
  getEstimateSize() {
    return this.isFixedType() ? this.fixedSizeValue : (this.firstRangeAverageSize || this.param.estimated)
  }
}
