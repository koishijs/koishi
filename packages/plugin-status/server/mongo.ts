import { Database } from 'koishi-core'
import {} from 'koishi-plugin-mongo'

Database.extend('koishi-plugin-mongo', {
  async getActiveData() {
    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [activeGroups, activeUsers] = await Promise.all([
      this.channel.find({ assignee: { $ne: null } }).count(),
      this.user.find({ lastCall: { $gt } }).count(),
    ])
    return { activeGroups, activeUsers }
  },
})
