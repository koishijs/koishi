import { SERVER_URL, SERVER_PORT } from './utils'
import { App, startAll, stopAll, Meta, registerDatabase, injectMethods } from '../src'
import { Server } from 'ws'

// declare module '../src/database' {
//   interface Subdatabases {
//     foo?: FooDatabase
//   }

//   interface DatabaseConfig {
//     foo?: FooOptions
//   }

//   interface UserTable {
//     myUserFunc (): number
//   }
// }

// interface FooOptions {
//   value?: number
// }

// class FooDatabase {
//   constructor (public options: FooOptions) {}

//   myFunc () {
//     return 1
//   }
// }

// registerDatabase('foo', FooDatabase);

// injectMethods('foo', 'user', {
//   myUserFunc () {
//     return 2
//   },
// })

// ;(async () => {
//   const app = new App({ database: { foo: { value: 1 } } })

//   console.log(app.database.foo.myFunc())
//   console.log(app.database.myUserFunc())
// })()
