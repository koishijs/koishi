import * as cp from 'child_process'

export interface PackageJSON {
  name: string
  private?: boolean
  version: string
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

interface ExecOptions extends cp.ExecOptions {
  silent?: boolean
}

export function exec (command: string, options: ExecOptions = {}): Promise<number> {
  const { silent } = options
  return new Promise((resolve) => {
    if (!silent) console.log(`$ ${command}\n`)
    const child = cp.exec(command, options)
    if (!silent) {
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    }
    child.on('close', (code) => {
      if (!silent) console.log()
      resolve(code)
    })
  })
}

export function execSync (command: string, options: ExecOptions = {}) {
  const { silent } = options
  if (!silent) console.log(`$ ${command}\n`)
  const result = cp.execSync(command, options).toString('utf8')
  if (!silent) console.log(result)
  return result
}
