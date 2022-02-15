// Type definitions for node-telegram-bot-api 0.50
// Project: https://github.com/yagop/node-telegram-bot-api
// Definitions by: Alex Muench <https://github.com/ammuench>
//                 Agadar <https://github.com/agadar>
//                 Giorgio Garasto <https://github.com/Dabolus>
//                 Kallu609 <https://github.com/Kallu609>
//                 XC-Zhang <https://github.com/XC-Zhang>
//                 AdityaThebe <https://github.com/adityathebe>
//                 Michael Orlov <https://github.com/MiklerGM>
//                 Alexander Ariutin <https://github.com/ariutin>
//                 XieJiSS <https://github.com/XieJiSS>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.3

export type ChatType = 'private' | 'group' | 'supergroup' | 'channel'

export type ChatAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_audio' | 'upload_audio'
    | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note'

export type ChatMemberStatus = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'

export type DocumentMimeType = 'application/pdf' | 'application/zip'

export type MessageType =
    'text' |
    'animation' |
    'audio' |
    'channel_chat_created' |
    'contact' |
    'delete_chat_photo' |
    'document' |
    'game' |
    'group_chat_created' |
    'invoice' |
    'left_chat_member' |
    'location' |
    'migrate_from_chat_id' |
    'migrate_to_chat_id' |
    'new_chat_members' |
    'new_chat_photo' |
    'new_chat_title' |
    'passport_data' |
    'photo' |
    'pinned_message' |
    'sticker' |
    'successful_payment' |
    'supergroup_chat_created' |
    'video' |
    'video_note' |
    'voice'

export type MessageEntityType = 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'bold' | 'italic' | 'code'
    | 'pre' | 'text_link' | 'text_mention'

export type ParseMode = 'Markdown' | 'MarkdownV2' | 'HTML'

/// TELEGRAM TYPES ///
export interface PassportFile {
    fileId: string
    fileSize: number
    fileDate: number
}

export interface EncryptedPassportElement {
    type: string
    data?: string
    phoneNumber?: string
    email?: string
    files?: PassportFile[]
    frontSide?: PassportFile
    reverseSide?: PassportFile
    selfie?: PassportFile
    translation?: PassportFile[]
    hash: string
}

export interface EncryptedCredentials {
    data: string
    hash: string
    secret: string
}

export interface PassportData {
    data: EncryptedPassportElement[]
    credentials: EncryptedCredentials
}

export interface Update {
    updateId: number
    message?: Message
    editedMessage?: Message
    channelPost?: Message
    editedChannelPost?: Message
    inlineQuery?: InlineQuery
    chosenInlineResult?: ChosenInlineResult
    callbackQuery?: CallbackQuery
    shippingQuery?: ShippingQuery
    preCheckoutQuery?: PreCheckoutQuery
    chatJoinRequest?: ChatJoinRequest
}

export interface WebhookInfo {
    url: string
    hasCustomCertificate: boolean
    pendingUpdateCount: number
    lastErrorDate?: number
    lastErrorMessage?: string
    maxConnections?: number
    allowedUpdates?: string[]
}

export interface User {
    id: number
    isBot: boolean
    firstName: string
    lastName?: string
    username?: string
    languageCode?: string
}

export interface Chat {
    id: number
    type: ChatType
    title?: string
    username?: string
    firstName?: string
    lastName?: string
    photo?: ChatPhoto
    description?: string
    inviteLink?: string
    pinnedMessage?: Message
    permissions?: ChatPermissions
    canSetStickerSet?: boolean
    stickerSetName?: string
    /**
     * @deprecated since version Telegram Bot API 4.4 - July 29, 2019
     */
    allMembersAreAdministrators?: boolean
}

export interface Message {
    messageId: number
    from?: User
    date: number
    chat: Chat
    forwardFrom?: User
    forwardFromChat?: Chat
    forwardFromMessageId?: number
    forwardSignature?: string
    forwardSenderName?: string
    forwardDate?: number
    replyToMessage?: Message
    editDate?: number
    mediaGroupId?: string
    authorSignature?: string
    text?: string
    entities?: MessageEntity[]
    captionEntities?: MessageEntity[]
    audio?: Audio
    document?: Document
    animation?: Animation
    game?: Game
    photo?: PhotoSize[]
    sticker?: Sticker
    video?: Video
    voice?: Voice
    videoNote?: VideoNote
    caption?: string
    contact?: Contact
    location?: Location
    venue?: Venue
    poll?: Poll
    newChatMembers?: User[]
    leftChatMember?: User
    newChatTitle?: string
    newChatPhoto?: PhotoSize[]
    deleteChatPhoto?: boolean
    groupChatCreated?: boolean
    supergroupChatCreated?: boolean
    channelChatCreated?: boolean
    migrateToChatId?: number
    migrateFromChatId?: number
    pinnedMessage?: Message
    invoice?: Invoice
    successfulPayment?: SuccessfulPayment
    connectedWebsite?: string
    passportData?: PassportData
    replyMarkup?: InlineKeyboardMarkup
}

export interface MessageEntity {
    type: MessageEntityType
    offset: number
    length: number
    url?: string
    user?: User
}

export interface FileBase {
    fileId: string
    fileSize?: number
}

export interface PhotoSize extends FileBase {
    width: number
    height: number
}

export interface Audio extends FileBase {
    duration: number
    performer?: string
    title?: string
    mimeType?: string
    thumb?: PhotoSize
}

export interface Document extends FileBase {
    thumb?: PhotoSize
    fileName?: string
    mimeType?: string
}

export interface Video extends FileBase {
    width: number
    height: number
    duration: number
    thumb?: PhotoSize
    mimeType?: string
}

export interface Voice extends FileBase {
    duration: number
    mimeType?: string
}

export interface InputMediaBase {
    media: string
    caption?: string
    parseMode?: ParseMode
}

export interface InputMediaPhoto extends InputMediaBase {
    type: 'photo'
}

export interface InputMediaVideo extends InputMediaBase {
    type: 'video'
    width?: number
    height?: number
    duration?: number
    supportsStreaming?: boolean
}

export type InputMedia = InputMediaPhoto | InputMediaVideo

export interface VideoNote extends FileBase {
    length: number
    duration: number
    thumb?: PhotoSize
}

export interface Contact {
    phoneNumber: string
    firstName: string
    lastName?: string
    userId?: number
    vcard?: string
}

export interface Location {
    longitude: number
    latitude: number
}

export interface Venue {
    location: Location
    title: string
    address: string
    foursquareId?: string
    foursquareType?: string
}

export type PollType = 'regular' | 'quiz'

export interface PollAnswer {
    pollId: string
    user: User
    optionIds: number[]
}

export interface PollOption {
    text: string
    voterCount: number
}

export interface Poll {
    id: string
    question: string
    options: PollOption[]
    isClosed: boolean
    isAnonymous: boolean
    allowsMultipleAnswers: boolean
    type: PollType
    totalVoterCount: number
}

export interface UserProfilePhotos {
    totalCount: number
    photos: PhotoSize[][]
}

export interface File extends FileBase {
    filePath?: string
}

export interface ReplyKeyboardMarkup {
    keyboard: KeyboardButton[][]
    resizeKeyboard?: boolean
    oneTimeKeyboard?: boolean
    selective?: boolean
}

export interface KeyboardButton {
    text: string
    requestContact?: boolean
    requestLocation?: boolean
}

export interface ReplyKeyboardRemove {
    removeKeyboard: boolean
    selective?: boolean
}

export interface InlineKeyboardMarkup {
    inlineKeyboard: InlineKeyboardButton[][]
}

export interface InlineKeyboardButton {
    text: string
    url?: string
    loginUrl?: LoginUrl
    callbackData?: string
    switchInlineQuery?: string
    switchInlineQueryCurrentChat?: string
    callbackGame?: CallbackGame
    pay?: boolean
}

export interface LoginUrl {
    url: string
    forwardText?: string
    botUsername?: string
    requestWriteAcces?: boolean
}

export interface CallbackQuery {
    id: string
    from: User
    message?: Message
    inlineMessageId?: string
    chatInstance: string
    data?: string
    gameShortName?: string
}

export interface ForceReply {
    forceReply: boolean
    selective?: boolean
}

export interface ChatPhoto {
    smallFileId: string
    bigFileId: string
}

export interface ChatMember {
    user: User
    status: ChatMemberStatus
    untilDate?: number
    canBeEdited?: boolean
    canPostMessages?: boolean
    canEditMessages?: boolean
    canDeleteMessages?: boolean
    canRestrictMembers?: boolean
    canPromoteMembers?: boolean
    canChangeInfo?: boolean
    canInviteUsers?: boolean
    canPinMessages?: boolean
    isMember?: boolean
    canSendMessages?: boolean
    canSendMediaMessages?: boolean
    canSendPolls: boolean
    canSendOtherMessages?: boolean
    canAddWebPagePreviews?: boolean
}

export interface ChatPermissions {
    canSendMessages?: boolean
    canSendMediaMessages?: boolean
    canSendPolls?: boolean
    canSendOtherMessages?: boolean
    canAddWebPagePreviews?: boolean
    canChangeInfo?: boolean
    canInviteUsers?: boolean
    canPinMessages?: boolean
}

export interface Sticker {
    fileId: string
    fileUniqueId: string
    isAnimated: boolean
    width: number
    height: number
    thumb?: PhotoSize
    emoji?: string
    setName?: string
    maskPosition?: MaskPosition
    fileSize?: number
}

export interface StickerSet {
    name: string
    title: string
    containsMasks: boolean
    stickers: Sticker[]
}

export interface MaskPosition {
    point: string
    xShift: number
    yShift: number
    scale: number
}

export interface InlineQuery {
    id: string
    from: User
    location?: Location
    query: string
    offset: string
}

export interface InlineQueryResultBase {
    id: string
    replyMarkup?: InlineKeyboardMarkup
}

export interface InlineQueryResultArticle extends InlineQueryResultBase {
    type: 'article'
    title: string
    inputMessageContent: InputMessageContent
    url?: string
    hideUrl?: boolean
    description?: string
    thumbUrl?: string
    thumbWidth?: number
    thumbHeight?: number
}

export interface InlineQueryResultPhoto extends InlineQueryResultBase {
    type: 'photo'
    photoUrl: string
    thumbUrl: string
    photoWidth?: number
    photoHeight?: number
    title?: string
    description?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultGif extends InlineQueryResultBase {
    type: 'gif'
    gifUrl: string
    gifWidth?: number
    gifHeight?: number
    gifDuration?: number
    thumbUrl?: string
    title?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultMpeg4Gif extends InlineQueryResultBase {
    type: 'mpeg4_gif'
    mpeg4Url: string
    mpeg4Width?: number
    mpeg4Height?: number
    mpeg4Duration?: number
    thumbUrl?: string
    title?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultVideo extends InlineQueryResultBase {
    type: 'video'
    videoUrl: string
    mimeType: string
    thumbUrl: string
    title: string
    caption?: string
    videoWidth?: number
    videoHeight?: number
    videoDuration?: number
    description?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultAudio extends InlineQueryResultBase {
    type: 'audio'
    audioUrl: string
    title: string
    caption?: string
    performer?: string
    audioDuration?: number
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultVoice extends InlineQueryResultBase {
    type: 'voice'
    voiceUrl: string
    title: string
    caption?: string
    voiceDuration?: number
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultDocument extends InlineQueryResultBase {
    type: 'document'
    title: string
    caption?: string
    documentUrl: string
    mimeType: string
    description?: string
    inputMessageContent?: InputMessageContent
    thumbUrl?: string
    thumbWidth?: number
    thumbHeight?: number
}

export interface InlineQueryResultLocationBase extends InlineQueryResultBase {
    latitude: number
    longitude: number
    title: string
    inputMessageContent?: InputMessageContent
    thumbUrl?: string
    thumbWidth?: number
    thumbHeight?: number
}

export interface InlineQueryResultLocation extends InlineQueryResultLocationBase {
    type: 'location'
}

export interface InlineQueryResultVenue extends InlineQueryResultLocationBase {
    type: 'venue'
    address: string
    foursquareId?: string
}

export interface InlineQueryResultContact extends InlineQueryResultBase {
    type: 'contact'
    phoneNumber: string
    firstName: string
    lastName?: string
    inputMessageContent?: InputMessageContent
    thumbUrl?: string
    thumbWidth?: number
    thumbHeight?: number
}

export interface InlineQueryResultGame extends InlineQueryResultBase {
    type: 'game'
    gameShortName: string
}

export interface InlineQueryResultCachedPhoto extends InlineQueryResultBase {
    type: 'photo'
    photoFileId: string
    title?: string
    description?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedGif extends InlineQueryResultBase {
    type: 'gif'
    gifFileId: string
    title?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedMpeg4Gif extends InlineQueryResultBase {
    type: 'mpeg4_gif'
    mpeg4FileId: string
    title?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedSticker extends InlineQueryResultBase {
    type: 'sticker'
    stickerFileId: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedDocument extends InlineQueryResultBase {
    type: 'document'
    title: string
    documentFileId: string
    description?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedVideo extends InlineQueryResultBase {
    type: 'video'
    videoFileId: string
    title: string
    description?: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedVoice extends InlineQueryResultBase {
    type: 'voice'
    voiceFileId: string
    title: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export interface InlineQueryResultCachedAudio extends InlineQueryResultBase {
    type: 'audio'
    audioFileId: string
    caption?: string
    inputMessageContent?: InputMessageContent
}

export type InlineQueryResult =
    InlineQueryResultCachedAudio |
    InlineQueryResultCachedDocument |
    InlineQueryResultCachedGif |
    InlineQueryResultCachedMpeg4Gif |
    InlineQueryResultCachedPhoto |
    InlineQueryResultCachedSticker |
    InlineQueryResultCachedVideo |
    InlineQueryResultCachedVoice |
    InlineQueryResultArticle |
    InlineQueryResultAudio |
    InlineQueryResultContact |
    InlineQueryResultGame |
    InlineQueryResultDocument |
    InlineQueryResultGif |
    InlineQueryResultLocation |
    InlineQueryResultMpeg4Gif |
    InlineQueryResultPhoto |
    InlineQueryResultVenue |
    InlineQueryResultVideo |
    InlineQueryResultVoice

export type InputMessageContent = object

export interface InputTextMessageContent extends InputMessageContent {
    messageText: string
    parseMode?: ParseMode
    disableWebPagePreview?: boolean
}

export interface InputLocationMessageContent extends InputMessageContent {
    latitude: number
    longitude: number
}

export interface InputVenueMessageContent extends InputLocationMessageContent {
    title: string
    address: string
    foursquareId?: string
}

export interface InputContactMessageContent extends InputMessageContent {
    phoneNumber: string
    firstName: string
    lastName?: string
}

export interface ChosenInlineResult {
    resultId: string
    from: User
    location?: Location
    inlineMessageId?: string
    query: string
}

export interface ResponseParameters {
    migrateToChatId?: number
    retryAfter?: number
}

export interface LabeledPrice {
    label: string
    amount: number
}

export interface Invoice {
    title: string
    description: string
    startParameter: string
    currency: string
    totalAmount: number
}

export interface ShippingAddress {
    countryCode: string
    state: string
    city: string
    streetLine1: string
    streetLine2: string
    postCode: string
}

export interface OrderInfo {
    name?: string
    phoneNumber?: string
    email?: string
    shippingAddress?: ShippingAddress
}

export interface ShippingOption {
    id: string
    title: string
    prices: LabeledPrice[]
}

export interface SuccessfulPayment {
    currency: string
    totalAmount: number
    invoicePayload: string
    shippingOptionId?: string
    orderInfo?: OrderInfo
    telegramPaymentChargeId: string
    providerPaymentChargeId: string
}

export interface ShippingQuery {
    id: string
    from: User
    invoicePayload: string
    shippingAddress: ShippingAddress
}

export interface PreCheckoutQuery {
    id: string
    from: User
    currency: string
    totalAmount: number
    invoicePayload: string
    shippingOptionId?: string
    orderInfo?: OrderInfo
}

export interface Game {
    title: string
    description: string
    photo: PhotoSize[]
    text?: string
    textEntities?: MessageEntity[]
    animation?: Animation
}

export interface Animation extends FileBase {
    width: number
    height: number
    duration: number
    thumb?: PhotoSize
    fileName?: string
    mimeType?: string
}

export type CallbackGame = object

export interface GameHighScore {
    position: number
    user: User
    score: number
}

export interface Metadata {
    type?: MessageType
}

export interface BotCommand {
    command: string
    description: string
}

/** Represents a join request sent to a chat. */
export interface ChatJoinRequest {
    /** Chat to which the request was sent */
    chat: Chat
    /** User that sent the join request */
    from: User
    /** Date the request was sent in Unix time */
    date: number
    /** Optional. Bio of the user. */
    bio?: string
    /** Optional. Chat invite link that was used by the user to send the join request */
    inviteLink?: ChatInviteLink
}

/** Represents an invite link for a chat. */
export interface ChatInviteLink {
    /**
     * The invite link. If the link was created by another chat administrator,
     * then the second part of the link will be replaced with “…”.
     */
    inviteLink: string
    /** Creator of the link */
    creator: User
    /** True, if users joining the chat via the link need to be approved by chat administrators */
    createsJoinRequest: boolean
    /** True, if the link is primary */
    isPrimary: boolean
    /** True, if the link is revoked */
    isRevoked: boolean
    /** Optional. Invite link name */
    name: string
    /** Optional. Point in time (Unix timestamp) when the link will expire or has been expired */
    expireDate: number
    /** Optional. Maximum number of users that can be members of the chat simultaneously after joining the chat via this invite link; 1-99999 */
    memberLimit: number
    /** Optional. Number of pending join requests created using this link */
    pendingJoinRequestCount: number
}
