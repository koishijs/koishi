import { getOffset, modInverse, modPositive } from './utils'

export default class Affine {
  private c: number

  constructor(public a: number, public b: number) {
    this.c = modInverse(a, 26)
  }

  encrypt(text: string) {
    let output = ''
    for (const char of text) {
      const offset = getOffset(char)
      if (offset) {
        output += String.fromCharCode(modPositive(this.a * (char.charCodeAt(0) - offset) + this.b, 26) + offset)
      } else {
        output += char
      }
    }
    return output
  }

  decrypt(text: string) {
    let output = ''
    for (const char of text) {
      const offset = getOffset(char)
      if (offset) {
        output += String.fromCharCode(modPositive(this.c * (char.charCodeAt(0) - offset - this.b), 26) + offset)
      } else {
        output += char
      }
    }
    return output
  }
}
