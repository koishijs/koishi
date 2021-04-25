const commitRE = /^=[0-9a-f]{40}(?=\W)/
const issueRE = /^#\d+(?=\))/

function github(state, silent) {
  if (silent) return false

  const src = state.src.slice(state.pos)
  let cap
  if (cap = commitRE.exec(src)) {
    state.pos += cap[0].length
    const token = state.push('github_commit', '', 0)
    token.markup = '='
    token.content = src.slice(0, cap[0].length)
    return true
  } else if (cap = issueRE.exec(src)) {
    state.pos += cap[0].length
    const token = state.push('github_issue', '', 0)
    token.markup = '#'
    token.content = src.slice(0, cap[0].length)
    return true
  }

  return false
}

module.exports = {
  name: 'github-links',

  extendsMarkdown (md) {
    md.inline.ruler.after('emphasis', 'github', github)
    md.renderer.rules.github_commit = (tokens, index, options, env) => {
      const body = tokens[index].content.slice(1)
      return `<a href="https://github.com/koishijs/koishi/commit/${body}" target="_blank" rel="noopener noreferrer"><code>${body.slice(0, 7)}</code></a>`
    }
    md.renderer.rules.github_issue = (tokens, index, options, env) => {
      const body = tokens[index].content.slice(1)
      return `<a href="https://github.com/koishijs/koishi/issues/${body}" target="_blank" rel="noopener noreferrer">#${body}</a>`
    }
  },
}
