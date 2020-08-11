import { isKeyword, getOffset } from './utils'

export default class Vigenere {
  codes: number[]

  constructor(keyword: string) {
    if (!isKeyword(keyword)) throw new Error('Invalid keyword.')
    this.codes = keyword.toLowerCase().split('').map(c => c.charCodeAt(0) - 97)
  }

  encrypt(text: string) {
    let result = ''
    let index = -1
    for (const char of text) {
      const offset = getOffset(char)
      if (offset) {
        result += String.fromCharCode((char.charCodeAt(0) - offset - 1 + this.codes[++index % this.codes.length]) % 26 + offset + 1)
      } else {
        result += char
      }
    }
    return result
  }

  decrypt(text: string) {
    let result = ''
    let index = -1
    for (const char of text) {
      const offset = getOffset(char)
      if (offset) {
        result += String.fromCharCode((char.charCodeAt(0) - offset + 25 - this.codes[++index % this.codes.length]) % 26 + offset + 1)
      } else {
        result += char
      }
    }
    return result
  }
}
