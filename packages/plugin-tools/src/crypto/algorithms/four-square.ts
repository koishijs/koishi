import { isKeyword, getOffset, Square, SquareType } from './utils'

export default class FourSquare {
  square1: Square
  square2: Square
  square3: Square
  square4: Square

  constructor(keyword1: string, keyword2: string, public type: SquareType) {
    if (!isKeyword(keyword1) || !isKeyword(keyword2)) {
      throw new Error('Invalid keyword.')
    }
    this.square1 = new Square(type)
    this.square2 = new Square(type, keyword1)
    this.square3 = new Square(type, keyword2)
    this.square4 = new Square(type)
  }

  crypt(text: string, s1: Square, s2: Square, s3: Square, s4: Square) {
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
        const [lastX, lastY] = s1.map[lastChar[0]]
        const [thisX, thisY] = s4.map[char]
        result += String.fromCharCode(s2.data[lastX][thisY] + lastOffset)
          + lastChar.slice(1)
          + String.fromCharCode(s3.data[thisX][lastY] + offset)
        lastOffset = 0
      } else {
        lastChar = char
        lastOffset = offset
      }
    }

    return result
  }

  encrypt(text: string) {
    return this.crypt(text, this.square1, this.square2, this.square3, this.square4)
  }

  decrypt(text: string) {
    return this.crypt(text, this.square2, this.square1, this.square4, this.square3)
  }
}
