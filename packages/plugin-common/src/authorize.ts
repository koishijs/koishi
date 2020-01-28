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
  const logger = ctx.logger('authorize')

  /**
   * array of `AuthorizeInfo`
   */
  const authorizeInfoList: AuthorizeInfo[] = []

  /**
   * a map of users' new authority
   * to make sure every user gets maximum possible authority
   */
  const newAuthorityMap = new Map<number, number>()

  /**
   * a map of users' old authority
   * to prevent from duplicate data fetching
   */
  const oldAuthorityMap = new Map<number, number>()

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
    const idsToFetch = ids.filter(id => !oldAuthorityMap.has(id))
    const users = await database.getUsers(idsToFetch, ['id', 'authority'])
    users.forEach((user) => oldAuthorityMap.set(user.id, user.authority))

    const info = authorizeInfoList[authority] || (authorizeInfoList[authority] = {
      insert: new Set(),
      update: new Set(),
    })

    for (const id of ids) {
      const newAuthority = newAuthorityMap.get(id)
      if (newAuthority) {
        if (newAuthority >= authority) continue
        authorizeInfoList[newAuthority].insert.delete(id)
        authorizeInfoList[newAuthority].update.delete(id)
      }
      newAuthorityMap.set(id, authority)

      const oldAuthority = oldAuthorityMap.get(id)
      if (!oldAuthority) {
        info.insert.add(id)
      } else if (oldAuthority < authority) {
        info.update.add(id)
      }
    }
  }

  app.receiver.once('ready', async () => {
    const tasks: Promise<void>[] = []

    tasks.push(...Object.keys(inversedUserMap).map(async (key) => {
      const id = +key
      await updateAuthorizeInfo(id, inversedUserMap[id])
    }))

    tasks.push(...Object.entries(authorizeGroup).map(async ([key, value]) => {
      const id = +key
      const ctx = app.group(id)
      const config = typeof value === 'number' ? { member: value } : value

      if (!('member' in config)) config.member = 1
      if (!('admin' in config)) config.admin = config.member
      if (!('owner' in config)) config.owner = config.admin

      await database.getGroup(id, app.selfId)
      const memberList = await ctx.sender.getGroupMemberList(id)
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
    }))

    await Promise.all(tasks.map(task => task.catch(logger.warn)))

    let totalInsert = 0, totalUpdate = 0
    for (const key in authorizeInfoList) {
      const authority = +key
      const { insert, update } = authorizeInfoList[key]
      totalInsert += insert.size
      totalUpdate += update.size
      for (const id of insert) {
        await database.getUser(id, authority)
        logger.debug(`inserted ${id} with authority ${authority}`)
      }
      for (const id of update) {
        await database.setUser(id, { authority })
        logger.debug(`update ${id}'s authority: ${oldAuthorityMap.get(id)} -> ${authority}`)
      }
    }

    logger.info(`inserted ${totalInsert} user(s) and updated ${totalUpdate} user(s)`)
  })
}
