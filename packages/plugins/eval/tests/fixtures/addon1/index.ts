import { registerCommand } from 'koishi/addons'
import { foo } from './foo'
import foobar from './foobar'

export * from './foo'

registerCommand('test', () => {
  return foo() + foobar()
})
