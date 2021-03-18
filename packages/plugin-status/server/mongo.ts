import { Database } from 'koishi-core'
import {} from 'koishi-plugin-mongo'

Database.extend('koishi-plugin-mongo', {
  async getProfile() {
    const $gt = new Date(new Date().getTime() - 1000 * 3600 * 24)
    const [allGroups, activeGroups, allUsers, activeUsers, { storageSize }] = await Promise.all([
      this.channel.countDocuments(),
      this.channel.find({ assignee: { $ne: null } }).count(),
      this.user.countDocuments(),
      this.user.find({ lastCall: { $gt } }).count(),
      this.mongo.db.stats(),
    ])
    return { allGroups, activeGroups, allUsers, activeUsers, storageSize }
  },
})
