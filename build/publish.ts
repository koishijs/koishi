import { PackageJson, getWorkspaces, spawnAsync, spawnSync } from './utils'
import { gt, prerelease } from 'semver'
import { Octokit } from '@octokit/rest'
import { draft } from './release'
import latest from 'latest-version'
import ora from 'ora'

const { CI, GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_TOKEN } = process.env

if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
  console.log('publish skipped.')
  process.exit(0)
}

;(async () => {
  let folders = await getWorkspaces()
  if (process.argv[2]) {
    folders = folders.filter(path => path.startsWith(process.argv[2]))
  }

  const spinner = ora()
  const bumpMap: Record<string, string> = {}

  let progress = 0
  spinner.start(`Loading workspaces (0/${folders.length})`)
  await Promise.all(folders.map(async (name) => {
    let meta: PackageJson
    try {
      meta = require(`../${name}/package`)
      if (!meta.private) {
        const version = prerelease(meta.version)
          ? await latest(meta.name, { version: 'next' }).catch(() => latest(meta.name))
          : await latest(meta.name)
        if (gt(meta.version, version)) {
          bumpMap[name] = meta.version
        }
      }
    } catch { /* pass */ }
    spinner.text = `Loading workspaces (${++progress}/${folders.length})`
  }))
  spinner.succeed()

  if (Object.keys(bumpMap).length) {
    for (const name in bumpMap) {
      console.log(`publishing ${name}@${bumpMap[name]} ...`)
      await spawnAsync(`yarn publish ${name} --new-version ${bumpMap[name]} --tag ${prerelease(bumpMap[name]) ? 'next' : 'latest'}`)
    }
  }

  const { version } = require('../packages/koishi-core/package') as PackageJson
  const tags = spawnSync(['git', 'tag', '-l']).split(/\r?\n/)
  if (tags.includes(version)) {
    return console.log(`Tag ${version} already exists.`)
  }

  const body = draft(tags[tags.length - 1])
  console.log(body)

  if (!GITHUB_TOKEN) return
  const github = new Octokit({
    auth: GITHUB_TOKEN,
  })

  console.log(`Start to release a new version with tag ${version} ...`)
  await github.repos.createRelease({
    repo: 'koishi',
    owner: 'koishijs',
    tag_name: version,
    name: `Koishi ${version}`,
    prerelease: !!prerelease(version),
    body,
  })
  console.log('Release created successfully.')
})()
