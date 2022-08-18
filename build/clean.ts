import { cwd, getPackages } from '@koishijs/scripts'
import { rm } from 'fs/promises'
import cac from 'cac'

const { args } = cac().help().parse()

;(async () => {
  const packages = await getPackages(args)
  await Promise.all(Object.keys(packages).flatMap((path) => [
    rm(cwd + path + '/dist', { recursive: true, force: true }),
    rm(cwd + path + '/lib', { recursive: true, force: true }),
    rm(cwd + path + '/temp', { recursive: true, force: true }),
    rm(cwd + path + '/tsconfig.tsbuildinfo', { recursive: true, force: true }),
  ]))
})()
