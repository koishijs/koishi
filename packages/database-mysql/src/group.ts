import { getSelfIds, injectMethods, GroupData, createGroup, groupFields, GroupField } from 'koishi-core'

injectMethods('mysql', 'group', {
  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as any || groupFields
    if (fields && !fields.length) return {} as any
    const [data] = await this.select<GroupData[]>('group', fields, '`id` = ?', [groupId])
    let fallback: GroupData
    if (!data) {
      fallback = createGroup(groupId, selfId)
      if (selfId && groupId) {
        await this.query(
          'INSERT INTO `group` (' + this.joinKeys(groupFields) + ') VALUES (' + groupFields.map(() => '?').join(', ') + ')',
          this.formatValues('group', fallback, groupFields),
        )
      }
    } else {
      data.id = groupId
    }
    return data || fallback
  },

  async getAllGroups (...args) {
    let assignees: readonly number[], fields: readonly GroupField[]
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

  async setGroup (groupId, data) {
    await this.update('group', groupId, data)
  },
})
