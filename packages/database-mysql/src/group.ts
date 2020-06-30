import { contain, observe } from 'koishi-utils'
import { getSelfIds, injectMethods, GroupData, createGroup, groupFields, GroupField, Group } from 'koishi-core'

declare module './database' {
  interface MysqlDatabaseConfig {
    groupRefreshInterval?: number
  }
}

type CachedGroupData = GroupData & { _timestamp: number }

const defaultRefreshInterval = 60 * 1000
const groupCache: Record<number, CachedGroupData> = {}

injectMethods('mysql', 'group', {
  async getGroup (groupId, ...args) {
    const selfId = typeof args[0] === 'number' ? args.shift() as number : 0
    const fields = args[0] as never || groupFields
    const timestamp = Date.now()
    const cache = groupCache[groupId]
    if (cache && contain(Object.keys(cache), fields)
      && timestamp - cache._timestamp < (this.config.groupRefreshInterval ?? defaultRefreshInterval)) return cache

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

    const group = groupCache[groupId] = (data || fallback) as CachedGroupData
    Object.defineProperty(group, '_timestamp', { value: timestamp })
    return group
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
    if (!groupCache[groupId]) {
      groupCache[groupId] = {} as CachedGroupData
      Object.defineProperty(groupCache[groupId], '_timestamp', { value: Date.now() })
    }
    Object.assign(groupCache[groupId], data)
  },
})
