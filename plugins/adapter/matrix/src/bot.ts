import { Adapter, Bot, Schema, Quester, omit } from 'koishi'
import { Internal } from './types'

export interface BotConfig extends Bot.BaseConfig, Quester.Config {
    selfId?: string
    senderLocalpart?: string
    hsToken?: string
    asToken?: string
}

export const BotConfig = Schema.object({
    selfId: Schema.string().description('机器人的 ID。').required(),
    endpoint: Schema.string().description('Matrix homeserver 地址。').required(),
    hsToken: Schema.string().description('hs_token').required(),
    asToken: Schema.string().description('as_token').required(),
    ...omit(Quester.Config.dict, ['endpoint'])
})

export class MatrixBot extends Bot<BotConfig> {
    http: Quester
    hsToken: string
    internal: Internal
    constructor(adapter: Adapter, config: BotConfig) {
        super(adapter, config)
        this.selfId = config.selfId
        this.hsToken = config.hsToken
        this.http = this.app.http.extend({
            ...config,
            endpoint: config.endpoint + '/_matrix/client/v3',
            headers: {
                'Authorization': `Bearer ${config.asToken}}`
            }
        })
        this.internal = new Internal(this.http)
    }
    
    // message
    async sendMessage(channelId: string, content: string, guildId?: string) {
        console.log(content)
        return []
    }
    async getMessage(channelId: string, messageId: string) {
        return null
    }
    async editMessage(channelId: string, messageId: string, content: string) {}
    async deleteMessage(channelId: string, messageId: string) {}

    // user
    async getSelf() {
        return null
    }
    async getUser(userId: string) {
        return null
    }
    getFriendList() {
        return null
    }
    async deleteFriend(userId: string) {}

    // // guild
    // getGuild(guildId: string): Promise<Guild>
    // getGuildList(): Promise<Guild[]>

    // // guild member
    // getGuildMember(guildId: string, userId: string): Promise<GuildMember>
    // getGuildMemberList(guildId: string): Promise<GuildMember[]>

    // channel
    async getChannel(channelId: string, guildId?: string) {
        return null
    }
    async getChannelList(guildId: string) {
        return null
    }
}