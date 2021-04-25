import { State } from 'koishi-plugin-chess'
import { mkdirSync, writeFile } from 'fs-extra'
import { resolve } from 'path'

const outFolder = resolve(__dirname, '../public/chess')
mkdirSync(outFolder, { recursive: true })

class ImageState extends State {
  index = 0

  constructor(size: number, placement: 'cross' | 'grid', public file: string) {
    super(null, size, placement)
  }

  dump(x?: number, y?: number) {
    return writeFile(`${outFolder}/${this.file}-${++this.index}.svg`, this.drawSvg(x, y).outer)
  }
}

const othello = new ImageState(8, 'grid', 'othello')

othello.set(3, 3, -1)
othello.set(4, 4, -1)
othello.set(3, 4, 1)
othello.set(4, 3, 1)
othello.dump()

othello.set(4, 4, 1)
othello.set(4, 5, 1)
othello.dump(4, 5)

othello.set(4, 4, -1)
othello.set(5, 5, -1)
othello.dump(5, 5)

// const gomoku = new ImageState(15, 'cross', 'gomoku')

// gomoku.dump()

// gomoku.set(7, 7, 1)
// gomoku.dump(7, 7)

// gomoku.set(7, 8, -1)
// gomoku.dump(7, 8)
