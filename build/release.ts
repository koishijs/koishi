import { maxSatisfying } from 'semver'
import { PackageJson, spawnSync } from './utils'

const headerMap = {
  feat: 'Features',
  fix: 'Bug Fixes',
  dep: 'Dependencies',
  '': 'Other Changes',
}

const prefixes = Object.keys(headerMap)
const prefixRegExp = new RegExp(`^(${prefixes.join('|')})(?:\\((\\S+)\\))?: (.+)$`)

export function draft(base: string, bumpMap: Record<string, PackageJson> = {}) {
  const updates = {}
  const commits = spawnSync(['git', 'log', `${base}..HEAD`, '--format=%H %s']).split(/\r?\n/).reverse()
  for (const commit of commits) {
    const hash = commit.slice(0, 40)
    const message = commit.slice(41)
    // skip merge commits
    if (message.startsWith('Merge')) continue

    const details = prefixRegExp.exec(message) || ['', '', '', message]
    let body = details[3]
    if (details[2]) body = `**${details[2]}:** ${body}`
    if (!updates[details[1]]) updates[details[1]] = ''
    updates[details[1]] += `- ${body} (${hash})\n`
  }

  let output = Object.values(bumpMap)
    .map(({ name, version }) => `- ${name}@${version}`)
    .sort().join('\n') + '\n'
  for (const type in headerMap) {
    if (!updates[type]) continue
    output += `\n## ${headerMap[type]}\n\n${updates[type]}`
  }
  return output
}

if (require.main === module) {
  let version = process.argv[2]
  if (!version) {
    const tags = spawnSync(['git', 'tag', '-l']).split(/\r?\n/)
    version = maxSatisfying(tags, '*')
  }
  console.log(draft(version))
}
