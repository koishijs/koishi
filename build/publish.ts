import { PackageJson, exec, cwd, getWorkspaces } from './utils'
import { lte } from 'semver'
import latest from 'latest-version'
import Octokit from '@octokit/rest'

const { CI, GITHUB_EVENT_NAME, GITHUB_REF } = process.env

if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
  console.log('publish skipped.')
  process.exit(0)
}

const github = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

;(async () => {
  for (const name of await getWorkspaces()) {
    try {
      const meta: PackageJson = require(`../${name}/package`)
      if (meta.private) continue
      const version = await latest(meta.name)
      if (lte(meta.version, version)) continue
      console.log(`publishing ${name}@${meta.version} ...`)
      await exec(`yarn publish ${name}`, { cwd }).catch(() => {})
    } catch {}
  }

  const { version } = require('../packages/koishi-cli/package') as PackageJson
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
