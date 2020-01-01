import * as cp from 'child_process'
import * as path from 'path'
import globby from 'globby'

export const cwd = path.resolve(__dirname, '..')

export function getWorkspaces () {
  return globby(require('../package').workspaces, {
    cwd,
    deep: 0,
    onlyDirectories: true,
  })
}

export type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'

export interface PackageJson extends Record<DependencyType, Record<string, string>> {
  name: string
  private?: boolean
  version: string
}

interface ExecOptions extends cp.ExecOptions {
  silent?: boolean
}

export function exec (command: string, options: ExecOptions = {}): Promise<string> {
  const { silent } = options
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = ''
    if (!silent) console.log(`$ ${command}`)
    const child = cp.exec(command, options)

    child.stdout.on('data', (data) => {
      stdout += data
      if (!silent) process.stdout.write(data)
    })

    child.stderr.on('data', (data) => {
      stderr += data
      if (!silent) process.stderr.write(data)
    })

    child.on('close', (code) => {
      if (!silent) console.log()
      if (code) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}
