import kleur from 'kleur'

export namespace logger {
  export function info (message: string, logLevel?: number) {
    if (logLevel < 3) return
    console.log(`${kleur.blue('info')}`, message)
  }

  export function error (message: string, logLevel?: number) {
    if (logLevel < 1) return
    console.log(`${kleur.red('error')}`, message)
  }

  export function warn (message: string, logLevel?: number) {
    if (logLevel < 2) return
    console.log(`${kleur.yellow('warning')}`, message)
  }

  export function success (message: string, logLevel?: number) {
    if (logLevel < 1) return
    console.log(`${kleur.green('success')}`, message)
  }

  export function debug (message: string, logLevel?: number) {
    if (logLevel < 4) return
    console.log(`${kleur.magenta('debug')}`, message)
  }
}
