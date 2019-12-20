import { GroupRole, Context, getSelfIds } from 'koishi-core'
import { updateAuthority } from './authorize'

interface AuthorizeOptions {
  memberAuthority?: number
  adminAuthority?: number
  ownerAuthority?: number
}

export type AuthorizeGroupOptions = Record<number, number | AuthorizeOptions>

export default function apply (ctx: Context, authorityMap: AuthorizeGroupOptions = {}) {
  const { app, database } = ctx

  for (const id in authorityMap) {
    let config = authorityMap[id]
    if (typeof config === 'number') {
      config = { memberAuthority: config }
    }
    const ctx = app.group(+id)

    if (!('memberAuthority' in config)) config.memberAuthority = 1
    if (!('adminAuthority' in config)) config.adminAuthority = config.memberAuthority
    if (!('ownerAuthority' in config)) config.ownerAuthority = config.adminAuthority

    app.receiver.once('connected', async () => {
      await getSelfIds()
      await database.getGroup(+id, app.options.selfId)
      const memberList = await ctx.sender.getGroupMemberList(+id)
      for (const role of ['member', 'admin', 'owner'] as GroupRole[]) {
        const authority = config[role + 'Authority']
        const memberIds = memberList.filter(m => m.role === role).map(m => m.userId)
        const users = database.getUsersWithAuthorityBelow
          ? await database.getUsersWithAuthorityBelow(memberIds, authority)
          : await database.getUsers(memberIds, ['id', 'authority'])
        await updateAuthority(database, users, memberIds, authority)
      }
    })

    ctx.receiver.on('group_increase', async ({ userId, role }) => {
      const authority = config[role + 'Authority']
      const user = await database.getUser(userId, authority)
      if (user.authority < authority) {
        return database.setUser(userId, { authority })
      }
    })
  }
}
