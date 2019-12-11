import chalk from 'chalk'

export namespace logger {
  export function info (...args: any[]) {
    console.log(`${chalk.blueBright('info')}`, ...args)
  }

  export function error (...args: any[]) {
    console.log(`${chalk.redBright('error')}`, ...args)
  }

  export function warning (...args: any[]) {
    console.log(`${chalk.yellowBright('warning')}`, ...args)
  }

  export function success (...args: any[]) {
    console.log(`${chalk.greenBright('success')}`, ...args)
  }
}
