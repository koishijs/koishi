import { PackageJSON, exec } from './utils'
import { resolve } from 'path'
import { lte } from 'semver'
import globby from 'globby'

const { CI, GITHUB_EVENT_NAME, GITHUB_REF } = process.env

// NOTE: Only For Test
// if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
//   console.log('publish skipped.')
//   process.exit(0)
// }

console.log(Object.keys(process.env).join('\n'))

const cwd = resolve(__dirname, '..')

;(async () => {
  const folders = await globby(require('../package').workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
  })

  for (const name of folders) {
    const meta: PackageJSON = require(`../${name}/package`)
    if (meta.private) continue
    // try {
    //   const version = await exec(`npm show ${meta.name} version`)
    //   if (lte(meta.version, version)) continue
    // } catch {}
    console.log(`publishing ${name}@${meta.version} ...`)
    await exec(`yarn publish ${name}`, { cwd })
  }
})()
