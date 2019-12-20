import { Context } from 'koishi-core'
import { updateAuthority } from './authorize'

export type AuthorizeUserOptions = Record<number, number>

export default function apply (ctx: Context, options: AuthorizeUserOptions = {}) {
  const { app, database } = ctx

  const authorityMap: Record<number, number[]> = []
  for (const id in options) {
    if (!authorityMap[options[id]]) authorityMap[options[id]] = []
    authorityMap[options[id]].push(+id)
  }

  Object.entries(authorityMap).forEach((entry) => {
    const authority = +entry[0], ids = entry[1]
    app.receiver.once('connected', async () => {
      const users = database.getUsersWithAuthorityNotEqual
        ? await database.getUsersWithAuthorityNotEqual(ids, authority)
        : await database.getUsers(ids, ['id', 'authority'])
      await updateAuthority(database, users, ids, authority)
    })
  })
}
