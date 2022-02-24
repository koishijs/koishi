import { CAC } from 'cac'
import { rm } from 'fs-extra'
import { cwd, getPackages } from './utils'

export default function (cli: CAC) {
  cli.command('clean [...name]', 'remove package output')
    .action(async (names: string[], options) => {
      const packages = await getPackages(names)
      await Promise.all(Object.keys(packages).flatMap((path) => [
        rm(cwd + path + '/dist', { recursive: true, force: true }),
        rm(cwd + path + '/lib', { recursive: true, force: true }),
      ]))
    })
}
