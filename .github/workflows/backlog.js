const github = require('@actions/github')
const octokit = github.getOctokit(process.env.PAT)
const context = github.context

async function run() {
  const issue = context.payload.issue
  if (issue.labels.find(v => v.name === 'plan'))
    return
  const { data } = await octokit.rest.issues.listForRepo({
    ...context.repo,
    creator: 'shigma',
    milestone: context.payload.milestone.number,
    labels: 'plan'
  })
  if (data.length !== 1) {
    console.log('no or more than one plan')
    return
  }
  const plan = data[0]
  const [, above, backlog, below = ''] = plan.body.match(/(.*## Backlog\s*)(\n(?:- [^-\r\n]+\r?\n)*)(.*)/s) // assume there is linebreak after list
  console.log('above: ', JSON.stringify(above), '\nbacklog: ', JSON.stringify(backlog), '\nbelow: ', JSON.stringify(below))
  let new_backlog = backlog.replace(/\r\n/g, '\n')
  const action = context.payload.action
  if (action === 'demilestoned') {
    const regex = new RegExp(`(?<=\\n)- \\[[ x]\\] #${issue.number} \\n`)
    if (new_backlog.match(regex)) {
      console.log('removed')
      new_backlog = new_backlog.replace(regex, '')
    } else {
      console.log('not removing modified')
    }
  } else {
    if (!new_backlog.includes(`#${issue.number}`)) {
      const backlogs = new_backlog.trim().split('\n')
      const newline = `- [${issue.state === 'open' ? ' ' : 'x'}] #${issue.number} `
      console.log('backlogs: ', backlogs, '\nnewline: ', newline)
      const id = backlogs.findIndex((v) => {
        const match = v.match(/#(\d+)/)
        if (match)
          if (parseInt(match[1]) > issue.number)
            return true
        return false
      })
      if (id === -1) {
        backlogs.push(newline)
        console.log('appended to the end')
      } else {
        console.log('insert before ', backlogs[id])
        backlogs[id] = newline + '\n' + backlogs[id] // splice have edging case
      }
      new_backlog = '\n' + backlogs.join('\n') + '\n'
    } else {
      console.log('already exists')
    }
  }
  console.log('new: ', new_backlog)
  const resp = await octokit.rest.issues.update({
    ...context.repo,
    issue_number: plan.number,
    body: above + new_backlog + below
  })
}

try {
  run()
} catch (error) {
  console.error(error)
}
