import kleur from 'kleur'

export namespace logger {
  export function info (...args: any[]) {
    console.log(`${kleur.blue('info')}`, ...args)
  }

  export function error (...args: any[]) {
    console.log(`${kleur.red('error')}`, ...args)
  }

  export function warning (...args: any[]) {
    console.log(`${kleur.yellow('warning')}`, ...args)
  }

  export function success (...args: any[]) {
    console.log(`${kleur.green('success')}`, ...args)
  }
}
