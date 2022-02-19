import spawn from 'cross-spawn'
import { existsSync } from 'fs'
import { resolve } from 'path'

export type { Loader, Watcher } from './worker'

function supports(command: string, args: string[] = []) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' })
    child.on('exit', (code) => {
      resolve(!code)
    })
    child.on('error', () => {
      resolve(false)
    })
  })
}

export type Agent = 'yarn' | 'npm' | 'pnpm'

let agentTask: Promise<Agent>

async function $getAgent(cwd: string) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { npm_execpath } = process.env
  const isYarn = npm_execpath.includes('yarn')
  if (isYarn) return 'yarn'

  if (existsSync(resolve(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(cwd, 'package-lock.json'))) return 'npm'

  const hasPnpm = await supports('pnpm', ['--version'])
  return hasPnpm ? 'pnpm' : 'npm'
}

export function getAgent(cwd = process.cwd()) {
  return agentTask ||= $getAgent(cwd)
}
