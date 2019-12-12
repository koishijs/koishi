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
