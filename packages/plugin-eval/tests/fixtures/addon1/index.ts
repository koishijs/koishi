import { registerCommand } from 'koishi/addons'
import { foo } from './foo'

export * from './foo'

registerCommand('test', () => {
  return foo()
})
