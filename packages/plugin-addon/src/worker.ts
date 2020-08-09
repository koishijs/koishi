import Global from 'koishi-plugin-eval/dist/worker'

declare module 'koishi-plugin-eval/dist/worker' {
  export default interface Global {
    require (name: string): void
  }
}

Global.prototype.require = function require (this: Global, name: string) {
  return this.log('TODO')
}
