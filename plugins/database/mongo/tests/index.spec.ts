import { App } from 'koishi'
import tests from '@koishijs/database-tests'
import mock from '@koishijs/plugin-mock'
import mongo from '@koishijs/plugin-database-mongo'
import parse from 'yargs-parser'

const { mongoPorts = '27017' } = parse(process.argv.slice(2), { string: ['mongo-ports'] })

for (const port of mongoPorts ? mongoPorts.split(',') : []) {
  describe(`Mongo Database (${port})`, () => {
    const app = new App()

    app.plugin(mock)

    app.plugin(mongo, {
      host: 'localhost',
      database: 'test',
      port: +port,
    })

    tests.database(app)
  })
}
