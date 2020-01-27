import kleur from 'kleur'

export namespace logger {
  export function info (message: string, logLevel?: number, scope?: string) {
    if (logLevel < 2) return
    console.log(`${kleur.blue(scope ? 'info:' + scope : 'info')}`, message)
  }

  export function error (message: string, logLevel?: number, scope?: string) {
    if (logLevel < 1) return
    console.log(`${kleur.red(scope ? 'error:' + scope : 'error')}`, message)
  }

  export function warn (message: string, logLevel?: number, scope?: string) {
    if (logLevel < 2) return
    console.log(`${kleur.yellow(scope ? 'warning:' + scope : 'warning')}`, message)
  }

  export function success (message: string, logLevel?: number, scope?: string) {
    if (logLevel < 1) return
    console.log(`${kleur.green(scope ? 'success:' + scope : 'success')}`, message)
  }

  export function debug (message: string, logLevel?: number, scope?: string) {
    if (logLevel < 3) return
    console.log(`${kleur.magenta(scope ? 'debug:' + scope : 'debug')}`, message)
  }
}
