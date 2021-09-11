import { App, Tests } from '@koishijs/test-utils'
import * as mongo from '@koishijs/plugin-mongo'
import parse from 'yargs-parser'

const { mongoPorts } = parse(process.argv.slice(2), { string: ['mongo-ports'] })

for (const port of mongoPorts ? mongoPorts.split(',') : []) {
  describe(`Mongo Database (${port})`, () => {
    const app = new App()

    app.plugin(mongo, {
      host: 'localhost',
      port: port,
    })

    Tests.database(app, {
      query: {
        logical: {
          fieldLevel: false,
        },
      },
    })
  })
}
