import { readFileSync } from 'fs'
import { resolve } from 'path'

const [simplified, traditional] = readFileSync(resolve(__dirname, '../chinese.txt'), 'utf-8').split(/\r?\n/)

const stMap = new Map<string, string>()
const tsMap = new Map<string, string>()

simplified.split('').forEach((char, index) => {
  stMap.set(char, traditional[index])
  tsMap.set(traditional[index], char)
})

export function traditionalize (source: string) {
  let result = ''
  for (const char of source) {
    result += stMap.get(char) || char
  }
  return result
}

export function simplify (source: string) {
  let result = ''
  for (const char of source) {
    result += tsMap.get(char) || char
  }
  return result
}
