import { readFileSync } from 'fs'
import { resolve } from 'path'

const [simplified, traditional] = readFileSync(resolve(__dirname, '../chinese.txt'), 'utf-8').split(/\r?\n/)

export const CJK = '\u2e80-\u2eff\u2f00-\u2fdf\u3040-\u309f\u30a0-\u30fa\u30fc-\u30ff\u3100-\u312f\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff'
export const RE_CJK = new RegExp(`[${CJK}]`, 'g')

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
