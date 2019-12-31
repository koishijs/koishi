import { PackageJSON, exec } from './utils'
import { resolve } from 'path'
import { lte } from 'semver'
import Octokit from '@octokit/rest'
import globby from 'globby'

const { CI, GITHUB_EVENT_NAME, GITHUB_REF } = process.env

if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
  console.log('publish skipped.')
  process.exit(0)
}

const github = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

const cwd = resolve(__dirname, '..')

;(async () => {
  const folders = await globby(require('../package').workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
  })

  for (const name of folders) {
    try {
      const meta: PackageJSON = require(`../${name}/package`)
      if (meta.private) continue
      const version = await exec(`npm show ${meta.name} version`)
      if (lte(meta.version, version)) continue
      console.log(`publishing ${name}@${meta.version} ...`)
      await exec(`yarn publish ${name}`, { cwd }).catch(() => {})
    } catch {}
  }

  const { version } = require('../packages/koishi-cli/package') as PackageJSON
  const tags = await exec('git tag -l')
  if (tags.split(/\r?\n/).includes(version)) return console.log(`Tag ${version} already exists.`)

  console.log(`Start to release a new version with tag ${version} ...`)
  await github.repos.createRelease({
    repo: 'koishi',
    owner: 'koishijs',
    tag_name: version,
    name: `Koishi ${version}`,
  })
  console.log('Release created successfully.')
})()
