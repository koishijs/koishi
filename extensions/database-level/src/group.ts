import { getSelfIds, injectMethods, GroupData, createGroup, Group } from 'koishi-core'
import { noop, observe } from 'koishi-utils'
import {} from './database'

injectMethods('level', 'group', {
  async getGroup (groupId, selfId): Promise<GroupData> {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = await this.tables.group.get(groupId).catch(noop) as GroupData | void
    if (data) return data
    const fallback = createGroup(groupId, selfId)
    if (selfId && groupId) {
      await this.tables.group.put(groupId, fallback)
    }
    return fallback
  },

  async getAllGroups (...args) {
    const assignees = args.length > 1 ? args[1]
      : args.length && typeof args[0][0] === 'number' ? args[0] as never
        : await getSelfIds()
    if (!assignees.length) return []
    return new Promise((resolve) => {
      const groups: GroupData[] = []
      this.tables.group.createValueStream()
        .on('data', (group: GroupData) => {
          if (assignees.includes(group.assignee)) {
            groups.push(group)
          }
        })
        .on('end', () => resolve(groups))
    })
  },

  async setGroup (groupId, data) {
    await this.update('group', groupId, data)
  },
})
