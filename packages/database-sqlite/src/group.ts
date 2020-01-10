import { observe, difference, Observed } from 'koishi-utils'
import { getSelfIds, injectMethods, GroupData, createGroup, groupFields, GroupField } from 'koishi-core'
import {} from './database'

injectMethods('sqlite', 'group', {
  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as never || groupFields
    const [data] = await this.select<GroupData>('group', fields, '`id` = ' + groupId)
    let fallback: GroupData
    if (!data) {
      fallback = createGroup(groupId, selfId)
      if (selfId && groupId) {
        await this.get(
          'INSERT INTO "group" (' + this.joinKeys(groupFields) + ') VALUES (' + groupFields.map(() => '?').join(', ') + ')',
          this.formatValues('group', fallback, groupFields),
        )
      }
    } else {
      data.id = groupId
    }

    return (data || fallback) as GroupData
  },

  async getAllGroups (...args) {
    let assignees: number[], fields: GroupField[]
    if (args.length > 1) {
      fields = args[0]
      assignees = args[1]
    } else if (args.length && typeof args[0][0] === 'number') {
      fields = groupFields
      assignees = args[0] as any
    } else {
      fields = args[0] || groupFields
      assignees = await getSelfIds()
    }
    if (!assignees.length) return []
    return this.select('group', fields, `\`assignee\` IN (${assignees.join(',')})`)
  },

  setGroup (groupId, data) {
    return this.update('group', groupId, data)
  },

  async observeGroup (group, ...args) {
    if (typeof group === 'number') {
      const data = await this.getGroup(group, ...args)
      return data && observe(data, diff => this.setGroup(group, diff), `group ${group}`)
    }

    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as never || groupFields
    const additionalData = fields.length
      ? await this.getGroup(group.id, selfId, fields)
      : {} as Partial<GroupData>
    if ('_diff' in group) return (group as Observed<GroupData>)._merge(additionalData)
    return observe(Object.assign(group, additionalData), diff => this.setGroup(group.id, diff), `group ${group.id}`)
  },

  async getGroupCount () {
    return this.count('group')
  },
})
