import { UserData, Database, Context, GroupRole } from 'koishi-core'
import { difference } from 'koishi-utils'

type AuthorizedUsers = Pick<UserData, 'id' | 'authority'>[]

export async function updateAuthority (database: Database, users: AuthorizedUsers, ids: number[], authority: number) {
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

export interface AuthorizeConfig {
  authorizeUser?: Record<number, number>
  authorizeGroup?: Record<number, number | Partial<Record<GroupRole, number>>>
}

interface AuthorizeInfo {
  insert: Set<number>
  update: Set<number>
}

export default function apply (ctx: Context, config: AuthorizeConfig) {
  const { app, database } = ctx
  const { authorizeUser = {}, authorizeGroup = {} } = config
  const authorityMap: Record<number, AuthorizeInfo> = []

  /**
   * an inversed map of `config.authorizeUser`
   * - key: authority
   * - value: list of ids
   */
  const authorizeUserInverseMap: Record<number, number[]> = []
  for (const id in authorizeUser) {
    const authority = authorizeUser[id]
    if (authorizeUserInverseMap[authority]) {
      authorizeUserInverseMap[authority].push(+id)
    } else {
      authorizeUserInverseMap[authority] = [+id]
    }
  }

  async function updateAuthorizeInfo (authority: number, ids: number[]) {
    const users = await database.getUsers(ids, ['id', 'authority'])
    const info = authorityMap[authority] || (authorityMap[authority] = {
      insert: new Set(),
      update: new Set(),
    })
    for (const id of ids) {
      const user = users.find(u => u.id === id)
      if (!user) {
        info.insert.add(id)
      } else if (user.authority !== authority) {
        info.update.add(id)
      }
    }
  }

  app.receiver.once('ready', async () => {
    await Promise.all([
      ...Object.keys(authorizeUserInverseMap).map(key => updateAuthorizeInfo(+key, authorizeUserInverseMap[+key])),
      ...Object.entries(authorizeGroup).map(async ([key, value]) => {
        const groupId = +key
        const config = typeof value === 'number' ? { member: value } : value
        const ctx = app.group(groupId)

        if (!('memberAuthority' in config)) config.member = 1
        if (!('adminAuthority' in config)) config.admin = config.member
        if (!('ownerAuthority' in config)) config.owner = config.admin

        await database.getGroup(groupId, app.selfId)
        const memberList = await ctx.sender.getGroupMemberList(groupId)
        for (const role of ['member', 'admin', 'owner'] as GroupRole[]) {
          const authority = config[role]
          const memberIds = memberList.filter(m => m.role === role).map(m => m.userId)
          await updateAuthorizeInfo(authority, memberIds)
        }

        ctx.receiver.on('group-increase', async ({ userId }) => {
          const authority = config.member
          const user = await database.getUser(userId, authority)
          if (user.authority < authority) {
            return database.setUser(userId, { authority })
          }
        })
      }),
    ])

    for (const key in authorityMap) {
      const authority = +key
      const { insert, update } = authorityMap[key]
      for (const id of insert) {
        await database.getUser(id, authority)
      }
      for (const id of update) {
        await database.setUser(id, { authority })
      }
    }
  })
}
