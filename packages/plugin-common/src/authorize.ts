import { Context, GroupRole } from 'koishi-core'

export interface AuthorizeOptions {
  authorizeUser?: Record<number, number>
  authorizeGroup?: Record<number, number | Partial<Record<GroupRole, number>>>
}

interface AuthorizeInfo {
  insert: Set<number>
  update: Set<number>
}

export default function apply (ctx: Context, config: AuthorizeOptions = {}) {
  const { app, database } = ctx
  const { authorizeUser = {}, authorizeGroup = {} } = config

  /**
   * array of `AuthorizeInfo`
   */
  const authorizeInfoList: AuthorizeInfo[] = []

  /**
   * a map of users' authority (buffered)
   * to make sure every user gets maximum possible authority
   */
  const userAuthorityMap: Record<number, number> = {}

  /**
   * inversion of `config.authorizeUser`
   */
  const inversedUserMap: number[][] = []

  for (const id in authorizeUser) {
    const authority = authorizeUser[id]
    if (inversedUserMap[authority]) {
      inversedUserMap[authority].push(+id)
    } else {
      inversedUserMap[authority] = [+id]
    }
  }

  async function updateAuthorizeInfo (authority: number, ids: number[]) {
    const users = await database.getUsers(ids, ['id', 'authority'])
    const info = authorizeInfoList[authority] || (authorizeInfoList[authority] = {
      insert: new Set(),
      update: new Set(),
    })
    for (const id of ids) {
      const oldAuthority = userAuthorityMap[id]
      if (oldAuthority) {
        if (oldAuthority >= authority) continue
        authorizeInfoList[oldAuthority].insert.delete(id)
        authorizeInfoList[oldAuthority].update.delete(id)
      }
      userAuthorityMap[id] = authority
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
      ...Object.keys(inversedUserMap).map(key => updateAuthorizeInfo(+key, inversedUserMap[+key])),
      ...Object.entries(authorizeGroup).map(async ([key, value]) => {
        const groupId = +key
        const config = typeof value === 'number' ? { member: value } : value
        const ctx = app.group(groupId)

        if (!('member' in config)) config.member = 1
        if (!('admin' in config)) config.admin = config.member
        if (!('owner' in config)) config.owner = config.admin

        await database.getGroup(groupId, app.selfId)
        const memberList = await ctx.sender.getGroupMemberList(groupId)
        for (const role of ['member', 'admin', 'owner'] as GroupRole[]) {
          const authority = config[role]
          const memberIds = memberList.filter(m => m.role === role).map(m => m.userId)
          await updateAuthorizeInfo(authority, memberIds)
        }

        async function handleUpdate (userId: number, authority: number) {
          const user = await database.getUser(userId, authority)
          if (user.authority < authority) {
            return database.setUser(userId, { authority })
          }
        }

        ctx.receiver.on('group-increase', ({ userId }) => {
          return handleUpdate(userId, config.member)
        })

        ctx.receiver.on('group-admin/set', ({ userId }) => {
          return handleUpdate(userId, config.admin)
        })
      }),
    ])

    for (const key in authorizeInfoList) {
      const authority = +key
      const { insert, update } = authorizeInfoList[key]
      for (const id of insert) {
        await database.getUser(id, authority)
      }
      for (const id of update) {
        await database.setUser(id, { authority })
      }
    }
  })
}
