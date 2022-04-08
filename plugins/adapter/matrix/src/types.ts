export interface Transactions {
    txnId: string
    events: ClientEvent
}

export interface ClientEvent {
    content: EventContent
    event_id: string
    origin_server_ts: number
    room_id: string
    sender: string
    state_key?: string
    type: string
    unsigned?: UnsignedData
}

export interface UnsignedData {
    age?: number
    prev_content?: EventContent
    redacted_because?: ClientEvent
    transaction_id?: string
}

export interface PreviousRoom {
    event_id: string
    room_id: string
}

export interface AllowCondition {
    room_id?: string
    type: 'm.room_membership'
}

export interface Invite {
    display_name: string
    signed: Signed
}

export interface Signed {
    mxid: string
    // signatures: Signatures
    signatures: any
    token: string
}

export interface Notifications {
    room?: number
}

export interface ThumbnailInfo {
    h?: number
    mimetype?: string
    size?: number
    w?: number
}

export interface ImageInfo {
    h?: number
    mimetype?: string
    size?: number
    // thumbnail_file?: EncryptedFile // end to end only
    thumbnail_file?: any
    thumbnail_info?: ThumbnailInfo
    thumbnail_url?: string
    w?: string
}

export interface FileInfo {
    mimetype?: string
    size?: number
    // thumbnail_file?: EncryptedFile // end to end only
    thumbnail_file?: any
    thumbnail_info?: ThumbnailInfo
    thumbnail_url?: string
}

export interface AudioInfo {
    duration?: number
    mimetype?: string
    size?: number
}

export interface LocationInfo {
    // thumbnail_file?: EncryptedFile // end to end only
    thumbnail_file?: any
    thumbnail_info?: ThumbnailInfo
    thumbnail_url?: string
}

export interface VideoInfo {
    duration?: number
    h?: number
    mimetype?: string
    size?: number
    // thumbnail_file?: EncryptedFile // end to end only
    thumbnail_file?: any
    thumbnail_info?: ThumbnailInfo
    thumbnail_url?: string
    w?: number
}

export interface PublicKeys {
    key_validity_url?: string
    public_key: string
}

export interface EventContent {}

export interface M_ROOM_CANONICAL_ALIAS extends EventContent {
    alias?: string
    alt_aliases?: string[]
}

export interface M_ROOM_CREATE extends EventContent {
    creator: string
    'm.federate'?: boolean
    predecessor?: PreviousRoom
    room_version?: string
    type?: string
}

export interface M_ROOM_JOIN_RULES extends EventContent {
    allow?: AllowCondition[]
    join_rule?: 'public' | 'knock' | 'invite' | 'private' | 'restricted'
}

export interface M_ROOM_MEMBER extends EventContent {
    avatar_url?: string
    displayname?: string[]
    is_direct?: boolean
    join_authorised_via_users_server?: string
    membership?: 'invite' | 'join' | 'knock' | 'leave' | 'ban'
    reason?: string
    third_party_invite?: Invite
}

export interface M_ROOM_POWER_LEVELS extends EventContent {
    ban?: number
    events?: Record<string, number>
    events_default?: number
    invite?: number
    kick?: number
    notifications?: Notifications
    redact?: number
    state_default?: number
    users?: Record<string, number>
    users_default?: number
}

export interface M_ROOM_MESSAGE extends EventContent {
    body: string
    msgtype: string
}

export interface M_ROOM_MESSAGE_FEEDBACK extends EventContent {
    target_event_id: string
    type: 'delivered' | 'read'
}

export interface M_ROOM_NAME extends EventContent {
    name: string
}

export interface M_ROOM_TOPIC extends EventContent {
    topic: string
}

export interface M_ROOM_AVATAR extends EventContent {
    info?: ImageInfo
    url: string
}

export interface M_ROOM_PINNED_EVENTS extends EventContent {
    pinned: string[]
}

export interface M_TEXT extends M_ROOM_MESSAGE {
    body: string
    format?: 'org.matrix.custom.html'
    formatted_body?: string
    msgtype: 'm.text'
}

export interface M_EMOTE extends M_ROOM_MESSAGE {
    body: string
    format?: 'org.matrix.custom.html'
    formatted_body?: string
    msgtype: 'm.text'
}

export interface M_NOTICE extends M_ROOM_MESSAGE {
    body: string
    format?: 'org.matrix.custom.html'
    formatted_body?: string
    msgtype: 'm.text'
}

export interface M_IMAGE extends M_ROOM_MESSAGE {
    body: string
    // file?: EncryptedFile // end to end only
    file?: any
    info?: ImageInfo
    msgtype: 'm.image'
    url?: string
}

export interface M_FILE extends M_ROOM_MESSAGE {
    body: string
    // file?: EncryptedFile // end to end only
    file?: any
    filename?: string
    info?: FileInfo
    msgtype: 'm.file'
    url?: string
}

export interface M_AUDIO extends M_ROOM_MESSAGE {
    body: string
    // file?: EncryptedFile // end to end only
    file?: any
    filename?: string
    info?: AudioInfo
    msgtype: 'm.audio'
    url?: string
}

export interface M_LOCATION extends M_ROOM_MESSAGE {
    body: string
    geo_uri: string
    info?: LocationInfo
    msgtype: 'm.location'
}

export interface M_VIDEO extends M_ROOM_MESSAGE {
    body: string
    // file?: EncryptedFile // end to end only
    file?: any
    info?: VideoInfo
    msgtype: 'm.video'
    url?: string
}

export interface M_TYPING extends EventContent {
    user_ids: string[]
}

export interface M_RECEIPT extends EventContent { }

export interface M_FULLY_READ extends EventContent {
    event_id: string
}

export interface M_PRESENCE extends EventContent {
    avatar_url?: string
    currently_actice?: boolean
    displayname?: string
    last_active_ago?: number
    presence?: 'online' | 'offline' | 'unavailable'
    status_msg?: string
}

export interface M_ROOM_HISTORY_VISIBILITY extends EventContent {
    history_visibility: 'invited' | 'joined' | 'shared' | 'world_readable'
}

export interface M_ROOM_THIRD_PATRY_INVITE extends EventContent {
    display_name: string
    key_validity_url: string
    public_key: string
    public_keys: PublicKeys[]
}

export interface M_ROOM_GUEST_ACCESS extends EventContent {
    guest_access: 'can_join' | 'forbidden'
}

export interface M_IGNORED_USER_LIST extends EventContent {
    ignored_users: Record<string, any>
}

export interface M_STICKER extends EventContent {
    body: string
    info: ImageInfo
    url: string
}

export interface M_ROOM_SERVER_ACL extends EventContent {
    allow?: string[]
    allow_ip_literals?: boolean
    deny?: string[]
}

export interface M_ROOM_TOMBSTONE extends EventContent {
    body: string
    replacement_room: string
}

export interface M_POLICY_RULE_USER extends EventContent {
    entity: string
    reason: string
    recommendation: string
}

export interface M_POLICY_RULE_ROOM extends EventContent {
    entity: string
    reason: string
    recommendation: string
}

export interface M_POLICY_RULE_SERVER extends EventContent {
    entity: string
    reason: string
    recommendation: string
}

export interface M_SPACE_CHILD extends EventContent {
    order?: string
    suggested?: boolean
    via?: string[]
}

export interface M_SPACE_PARENT extends EventContent {
    canonical?: boolean
    via?: string[]
}

export interface Internal {}