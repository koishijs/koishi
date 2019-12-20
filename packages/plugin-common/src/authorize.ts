import { injectMethods, UserData, Database } from 'koishi-core'
import { difference } from 'koishi-utils'
import {} from 'koishi-database-mysql'

// optimize for mysql
declare module 'koishi-core/dist/database' {
  interface UserMethods {
    getUsersWithAuthorityBelow <K extends UserField> (ids: number[], authority: number): Promise<Pick<UserData, 'id' | 'authority'>[]>
    getUsersWithAuthorityNotEqual <K extends UserField> (ids: number[], authority: number): Promise<Pick<UserData, 'id' | 'authority'>[]>
  }
}

injectMethods('mysql', 'user', {
  async getUsersWithAuthorityBelow (ids, authority) {
    if (!ids.length) return []
    return this.query(`SELECT 'id', 'authority' FROM users WHERE 'id' IN (${ids.join(', ')}) AND 'authority' < ?`, [authority])
  },

  async getUsersWithAuthorityNotEqual (ids, authority) {
    if (!ids.length) return []
    return this.query(`SELECT 'id', 'authority' FROM users WHERE 'id' IN (${ids.join(', ')}) AND 'authority' != ?`, [authority])
  },
})

export async function updateAuthority (database: Database, users: Pick<UserData, 'id' | 'authority'>[], ids: number[], authority: number) {
  const userIds = users.map(u => u.id)
  const insertIds = difference(ids, userIds)
  const updateIds = ids.filter((id) => {
    const user = users.find(u => u.id === id)
    return user && user.authority < authority
  })
  for (const id of insertIds) {
    await database.getUser(id, authority)
  }
  for (const id of updateIds) {
    await database.setUser(id, { authority })
  }
}
