import Affine from './algorithms/affine'
import Vigenere from './algorithms/vigenere'
import TwoSquare from './algorithms/two-square'
import FourSquare from './algorithms/four-square'
import { Context } from 'koishi-core'
import { CQCode } from 'koishi-utils'

export default function apply (ctx: Context) {
  ctx.command('tools/crypto <algorithm> <text>', '加密解密工具')
    .option('-e, --encrypt', '加密模式（默认）')
    .option('-d, --decrypt', '解密模式')
    .option('-c, --case <maintain|upper|lower>', '控制输出字母的大小写，默认为 maintain')
    .option('-p, --preserve <all|word|alpha|nonspace>', '控制要保留的字符，默认为 all')
    .option('-s, --square <25q|25ij|36>', '设置方格填充规则，默认为 25ij', { default: '25ij' })
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
    .action(({ options, meta }, algorithms, text) => {
      if (!text) return meta.$send('请输入文本。')
      if (!algorithms) return meta.$send('请指定算法。')
      text = CQCode.unescape(text)
      algorithms = CQCode.unescape(algorithms)

      let cap, cryptos = []
      for (const algorithm of algorithms.split(/;\s*/g)) {
        if (cap = algorithm.match(/^affine\(([+-]?\d+), *([+-]?\d+)\)$/i)) {
          const a = parseInt(cap[1])
          const b = parseInt(cap[2])
          cryptos.push(new Affine(a, b))
        } else if (cap = algorithm.match(/^atbash$/i)) {
          cryptos.push(new Affine(-1, 0))
        } else if (cap = algorithm.match(/^rot13$/i)) {
          cryptos.push(new Affine(1, 13))
        } else if (cap = algorithm.match(/^caesar\(([+-]?\d+)\)/i)) {
          const b = parseInt(cap[1])
          cryptos.push(new Affine(1, b))
        } else if (cap = algorithm.match(/^vigenere\(([a-z]+)\)/i)) {
          cryptos.push(new Vigenere(cap[1]))
        } else if (cap = algorithm.match(/^two-?square\(([a-z]+), *([a-z]+)\)/i)) {
          cryptos.push(new TwoSquare(cap[1], cap[2], options.square))
        } else if (cap = algorithm.match(/^four-?square\(([a-z]+), *([a-z]+)\)/i)) {
          cryptos.push(new FourSquare(cap[1], cap[2], options.square))
        } else {
          return meta.$send(`无法识别算法 ${algorithm}，请使用“crypto -h”查看支持的算法列表。`)
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

      return meta.$send(text, true)
    })
}
