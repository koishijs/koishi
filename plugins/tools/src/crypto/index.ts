import Affine from './algorithms/affine'
import Vigenere from './algorithms/vigenere'
import TwoSquare from './algorithms/two-square'
import FourSquare from './algorithms/four-square'
import { Context } from 'koishi'

export const name = 'crypto'

export function apply(ctx: Context) {
  ctx.command('tools/crypto <algorithm> <text:rawtext>', '加密解密工具')
    .option('encrypt', '-e  加密模式（默认）')
    .option('decrypt', '-d  解密模式')
    .option('case', '-c <maintain|upper|lower>  控制输出字母的大小写，默认为 maintain')
    .option('preserve', '-p <all|word|alpha|nonspace>  控制要保留的字符，默认为 all')
    .option('square', '-s <25q|25ij|36>  设置方格填充规则，默认为 25ij', { fallback: '25ij' })
    .usage([
      '当前支持的算法有：',
      '    affine(a,b)',
      '    atbash',
      '    caesar(a)',
      '    rot13',
      '    vigenere(key)',
      '    two-square(key1,key2)',
      '    four-square(key1,key2)',
      '多个算法之间用分号隔开，将依次计算每个算法，加密顺序是从右向左，解密顺序是从左向右。',
    ].join('\n'))
    .example('crypto vigenere(keyword) "Hello World"  ->  Rijhc Nrbpb')
    .example('crypto vigenere(keyword) -d "Rijhc Nrbpb"  ->  Hello World')
    .action(({ options }, algorithms, text) => {
      if (!text) return '请输入文本。'
      if (!algorithms) return '请指定算法。'

      let cap: RegExpMatchArray
      const cryptos = []
      for (const algorithm of algorithms.split(/;\s*/g)) {
        // eslint-disable-next-line no-cond-assign
        if (cap = algorithm.match(/^affine\(([+-]?\d+), *([+-]?\d+)\)$/i)) {
          const a = parseInt(cap[1])
          const b = parseInt(cap[2])
          cryptos.push(new Affine(a, b))
        } else if (algorithm.match(/^atbash$/i)) {
          cryptos.push(new Affine(-1, 0))
        } else if (algorithm.match(/^rot13$/i)) {
          cryptos.push(new Affine(1, 13))
          // eslint-disable-next-line no-cond-assign
        } else if (cap = algorithm.match(/^caesar\(([+-]?\d+)\)/i)) {
          const b = parseInt(cap[1])
          cryptos.push(new Affine(1, b))
          // eslint-disable-next-line no-cond-assign
        } else if (cap = algorithm.match(/^vigenere\(([a-z]+)\)/i)) {
          cryptos.push(new Vigenere(cap[1]))
          // eslint-disable-next-line no-cond-assign
        } else if (cap = algorithm.match(/^two-?square\(([a-z]+), *([a-z]+)\)/i)) {
          cryptos.push(new TwoSquare(cap[1], cap[2], options.square as any))
          // eslint-disable-next-line no-cond-assign
        } else if (cap = algorithm.match(/^four-?square\(([a-z]+), *([a-z]+)\)/i)) {
          cryptos.push(new FourSquare(cap[1], cap[2], options.square as any))
        } else {
          return `无法识别算法 ${algorithm}，请使用“crypto -h”查看支持的算法列表。`
        }
      }

      if (options.case === 'lower') {
        text = text.toLowerCase()
      } else if (options.case === 'upper') {
        text = text.toUpperCase()
      }

      if (options.preserve === 'word') {
        text = text.replace(/[^a-zA-Z0-9-]/g, '')
      } else if (options.preserve === 'nonspace') {
        text = text.replace(/\s/g, '')
      } else if (options.preserve === 'alpha') {
        text = text.replace(/[^a-zA-Z]/g, '')
      }

      if (options.decrypt) {
        for (const crypto of cryptos) {
          text = crypto.decrypt(text)
        }
      } else {
        for (const crypto of cryptos.reverse()) {
          text = crypto.encrypt(text)
        }
      }

      return text
    })
}
