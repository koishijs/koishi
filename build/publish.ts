import { PackageJSON, exec, execSync } from './utils'
import { resolve } from 'path'
import { lte } from 'semver'
import globby from 'globby'

if (!process.env.NPM_TOKEN) {
  console.log('publish skipped.')
  process.exit(0)
}

(async () => {
  const folders = await globby(require('../package').workspaces, {
    deep: 0,
    onlyDirectories: true,
    cwd: resolve(__dirname, '..'),
  })

  for (const name of folders) {
    const meta: PackageJSON = require(`../${name}/package`)
    if (meta.private) continue
    const version = execSync(`npm show ${meta.name} version`)
    if (lte(meta.version, version)) continue
    console.log(`publishing ${name}@${meta.version} ...`)
    await exec(`npm publish`, { cwd: resolve(__dirname, '..', name) })
  }
})()
