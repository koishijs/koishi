import { PackageJSON, exec, execSync } from './utils'
import { resolve } from 'path'
import { lte } from 'semver'
import globby from 'globby'

if (process.env.GITHUB_REF !== 'refs/heads/master' || process.env.GITHUB_EVENT_NAME !== 'push') {
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
    await exec(`yarn publish`, { cwd: resolve(__dirname, '..', name) })
  }
})()
