import { Database } from 'koishi-core'
import {} from 'koishi-plugin-mongo'

Database.extend('koishi-plugin-mongo', {
  async getActiveData() {
    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [allGroups, activeGroups, allUsers, activeUsers] = await Promise.all([
      this.channel.countDocuments(),
      this.channel.find({ assignee: { $ne: null } }).count(),
      this.user.countDocuments(),
      this.user.find({ lastCall: { $gt } }).count(),
    ])
    return { allGroups, activeGroups, allUsers, activeUsers }
  },
})
