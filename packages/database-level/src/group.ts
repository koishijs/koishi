import { getSelfIds, injectMethods, GroupData, createGroup } from 'koishi-core'
import { noop, observe } from 'koishi-utils'

import { sublevels } from './database'

sublevels.groupDB = { keyEncoding: 'json', valueEncoding: 'json' }

injectMethods('level', 'group', {
  async getGroup (groupId, selfId = 0): Promise<GroupData> {
    const data = await this.subs.groupDB.get(groupId).catch(noop) as GroupData | void
    let fallback: GroupData
    if (!data) {
      fallback = createGroup(groupId, selfId)
      if (selfId && groupId) {
        await this.subs.groupDB.put(groupId, fallback)
      }
    }

    return data || fallback
  },

  async getAllGroups (_, assignees) {
    if (!assignees) assignees = await getSelfIds()
    return new Promise(resolve => {
      const groups: GroupData[] = []
      this.subs.groupDB.createValueStream()
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
    await this.subs.groupDB.put(groupId, newData)
  },

  async observeGroup (group, selfId = 0) {
    if (typeof group === 'number') {
      const data = await this.getGroup(group, selfId)
      return data && observe(data, diff => this.setGroup(group, diff), `group ${group}`)
    } else if ('_diff' in group) {
      return group
    } else {
      return observe(group, diff => this.setGroup(group.id, diff), `group ${group.id}`)
    }
  },

  getGroupCount () {
    return this.count('groupDB')
  },
})
