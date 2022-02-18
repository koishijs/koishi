import { cwd, getPackages, PackageJson, spawnAsync, spawnSync } from './utils'
import { gt, maxSatisfying, prerelease } from 'semver'
import { Octokit } from '@octokit/rest'
import { draft } from './release'
import { copyFile } from 'fs-extra'
import latest from 'latest-version'
import ora from 'ora'
import cac from 'cac'

const { args } = cac().help().parse()

const { CI, GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_TOKEN } = process.env

if (CI && (GITHUB_REF !== 'refs/heads/master' || GITHUB_EVENT_NAME !== 'push')) {
  console.log('publish skipped.')
  process.exit(0)
}

function getVersion(name: string, isNext = false) {
  if (isNext) {
    return latest(name, { version: 'next' }).catch(() => getVersion(name))
  } else {
    return latest(name).catch(() => '0.0.1')
  }
}

;(async () => {
  const folders = await getPackages(args)
  const spinner = ora()
  const bumpMap: Record<string, PackageJson> = {}

  let progress = 0
  spinner.start(`Loading workspaces (0/${folders.length})`)
  await Promise.all(folders.map(async (name) => {
    let meta: PackageJson
    try {
      meta = require(`../${name}/package.json`)
      if (!meta.private) {
        const version = await getVersion(meta.name, isNext(meta.version))
        if (gt(meta.version, version)) {
          bumpMap[name] = meta
        }
      }
    } catch { /* pass */ }
    spinner.text = `Loading workspaces (${++progress}/${folders.length})`
  }))
  spinner.succeed()

  function isNext(version: string) {
    const parts = prerelease(version)
    if (!parts) return false
    return parts[0] !== 'rc'
  }

  function publish(folder: string, name: string, version: string, tag: string) {
    console.log(`publishing ${name}@${version} ...`)
    return spawnAsync([
      'yarn', 'publish', folder,
      '--new-version', version,
      '--tag', tag,
      '--access', 'public',
    ])
  }

  if (Object.keys(bumpMap).length) {
    for (const folder in bumpMap) {
      const { name, version } = bumpMap[folder]
      if (name === 'koishi') {
        await copyFile(`${cwd}/README.md`, `${cwd}/${folder}/README.md`)
      }
      await publish(folder, name, version, isNext(version) ? 'next' : 'latest')
    }
  }

  const { version } = require('../packages/koishi/package') as PackageJson
  if (!CI || isNext(version)) return

  const tags = spawnSync(['git', 'tag', '-l']).split(/\r?\n/)
  if (tags.includes(version)) {
    return console.log(`Tag ${version} already exists.`)
  }

  const body = draft(maxSatisfying(tags, '*'), bumpMap)
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
    prerelease: isNext(version),
    body,
  })
  console.log('Release created successfully.')
})()
