import { isKeyword, getOffset, Square, SquareType } from './utils'

export default class TwoSquare {
  square1: Square
  square2: Square

  constructor(keyword1: string, keyword2: string, public type: SquareType) {
    if (!isKeyword(keyword1) || !isKeyword(keyword2)) {
      throw new Error('Invalid keyword.')
    }
    this.square1 = new Square(type, keyword1)
    this.square2 = new Square(type, keyword2)
  }

  crypt(text: string) {
    if (this.type === '25ij') {
      text = text.replace(/j/ig, 'i')
    } else if (this.type === '25q') {
      text = text.replace(/q/ig, '')
    }

    let result = ''
    let lastChar = ''
    let lastOffset = 0
    for (const char of text) {
      const offset = getOffset(char)
      if (!offset) {
        if (lastOffset) {
          lastChar += char
        } else {
          result += char
        }
      } else if (lastOffset) {
        const [lastX, lastY] = this.square1.map[lastChar[0]]
        const [thisX, thisY] = this.square2.map[char]
        result += String.fromCharCode(this.square1.data[lastX][thisY] + lastOffset)
          + lastChar.slice(1)
          + String.fromCharCode(this.square2.data[thisX][lastY] + offset)
        lastOffset = 0
      } else {
        lastChar = char
        lastOffset = offset
      }
    }

    return result
  }

  encrypt(text: string) {
    return this.crypt(text)
  }

  decrypt(text: string) {
    return this.crypt(text)
  }
}
