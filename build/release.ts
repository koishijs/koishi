import { spawnSync } from './utils'

const headerMap = {
  feat: 'Features',
  fix: 'Bug Fixes',
  dep: 'Dependencies',
}

const prefixes = Object.keys(headerMap)
const prefixRegExp = new RegExp(`^(${prefixes.join('|')})(?:\\((\\S+)\\))?: (.+)$`)

export function draft(base: string) {
  const updates = {}
  const commits = spawnSync(`git log ${base}..HEAD --format="%H %s"`).split(/\r?\n/).reverse()
  for (const commit of commits) {
    const hash = commit.slice(0, 40)
    const details = prefixRegExp.exec(commit.slice(41))
    if (!details) continue
    let message = details[3]
    if (details[2]) message = `**${details[2]}:** ${message}`
    if (!updates[details[1]]) updates[details[1]] = ''
    updates[details[1]] += `- ${message} (${hash})\n`
  }

  let body = ''
  for (const type in headerMap) {
    if (!updates[type]) continue
    body += `## ${headerMap[type]}\n\n${updates[type]}\n`
  }
  return body
}

if (require.main === module) {
  const tags = spawnSync('git tag -l').split(/\r?\n/)
  console.log(draft(tags[tags.length - 1]))
}
