import { injectMethods, getSelfIds } from 'koishi-core'
import {} from 'koishi-database-mysql'

declare module 'koishi-core/dist/database' {
  interface UserData {
    lastCall: Date
  }

  interface UserMethods {
    getActiveUserCount (): Promise<number>
  }

  interface GroupMethods {
    getActiveGroupCount (): Promise<number>
  }
}

injectMethods('mysql', 'user', {
  getActiveUserCount () {
    return this.count('user', 'CURRENT_TIMESTAMP() - `lastCall` < 1000 * 3600 * 24')
  },
})

injectMethods('mysql', 'group', {
  async getActiveGroupCount () {
    const assignees = await getSelfIds()
    return this.count('group', `\`assignee\` IN (${assignees.join(',')})`)
  },
})
