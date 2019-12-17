import { getSelfIds, injectMethods, GroupData, createGroup } from 'koishi-core'
import { noop, observe } from 'koishi-utils'
import {} from './database'

injectMethods('level', 'group', {
  async getGroup (groupId, selfId): Promise<GroupData> {
    selfId = typeof selfId === 'number' ? selfId : 0
    const data = await this.tables.group.get(groupId).catch(noop) as GroupData | void
    let fallback: GroupData
    if (!data) {
      fallback = createGroup(groupId, selfId)
      if (selfId && groupId) {
        await this.tables.group.put(groupId, fallback)
      }
    }

    return data || fallback
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
    const originalData = await this.getGroup(groupId)
    const newData: GroupData = { ...originalData, ...data }
    await this.tables.group.put(groupId, newData)
  },

  async observeGroup (group, selfId) {
    if (typeof group === 'number') {
      selfId = typeof selfId === 'number' ? selfId : 0
      const data = await this.getGroup(group, selfId)
      return data && observe(data, diff => this.setGroup(group, diff), `group ${group}`)
    } else if ('_diff' in group) {
      return group
    } else {
      return observe(group, diff => this.setGroup(group.id, diff), `group ${group.id}`)
    }
  },

  getGroupCount () {
    return this.count('group')
  },
})
