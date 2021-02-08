/* eslint-disable camelcase */
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

/// <reference types="node" />

declare namespace Telegram {
    type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

    type ChatAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_audio' | 'upload_audio'
        | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';

    type ChatMemberStatus = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';

    type DocumentMimeType = 'application/pdf' | 'application/zip';

    type MessageType =
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
        'voice';

    type MessageEntityType = 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'bold' | 'italic' | 'code'
        | 'pre' | 'text_link' | 'text_mention';

    type ParseMode = 'Markdown' | 'MarkdownV2' | 'HTML';

    /// TELEGRAM TYPES ///
    interface PassportFile {
        fileId: string;
        fileSize: number;
        fileDate: number;
    }

    interface EncryptedPassportElement {
        type: string;
        data?: string;
        phoneNumber?: string;
        email?: string;
        files?: PassportFile[];
        frontSide?: PassportFile;
        reverseSide?: PassportFile;
        selfie?: PassportFile;
        translation?: PassportFile[];
        hash: string;
    }

    interface EncryptedCredentials {
        data: string;
        hash: string;
        secret: string;
    }

    interface PassportData {
        data: EncryptedPassportElement[];
        credentials: EncryptedCredentials;
    }

    interface Update {
        updateId: number;
        message?: Message;
        editedMessage?: Message;
        channelPost?: Message;
        editedChannelPost?: Message;
        inlineQuery?: InlineQuery;
        chosenInlineResult?: ChosenInlineResult;
        callbackQuery?: CallbackQuery;
        shippingQuery?: ShippingQuery;
        preCheckoutQuery?: PreCheckoutQuery;
    }

    interface WebhookInfo {
        url: string;
        hasCustomCertificate: boolean;
        pendingUpdateCount: number;
        lastErrorDate?: number;
        lastErrorMessage?: string;
        maxConnections?: number;
        allowedUpdates?: string[];
    }

    interface User {
        id: number;
        isBot: boolean;
        firstName: string;
        lastName?: string;
        username?: string;
        languageCode?: string;
    }

    interface Chat {
        id: number;
        type: ChatType;
        title?: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        photo?: ChatPhoto;
        description?: string;
        inviteLink?: string;
        pinnedMessage?: Message;
        permissions?: ChatPermissions;
        canSetStickerSet?: boolean;
        stickerSetName?: string;
        /**
         * @deprecated since version Telegram Bot API 4.4 - July 29, 2019
         */
        allMembersAreAdministrators?: boolean;
    }

    interface Message {
        messageId: number;
        from?: User;
        date: number;
        chat: Chat;
        forwardFrom?: User;
        forwardFromChat?: Chat;
        forwardFromMessageId?: number;
        forwardSignature?: string;
        forwardSenderName?: string;
        forwardDate?: number;
        replyToMessage?: Message;
        editDate?: number;
        mediaGroupId?: string;
        authorSignature?: string;
        text?: string;
        entities?: MessageEntity[];
        captionEntities?: MessageEntity[];
        audio?: Audio;
        document?: Document;
        animation?: Animation;
        game?: Game;
        photo?: PhotoSize[];
        sticker?: Sticker;
        video?: Video;
        voice?: Voice;
        videoNote?: VideoNote;
        caption?: string;
        contact?: Contact;
        location?: Location;
        venue?: Venue;
        poll?: Poll;
        newChatMembers?: User[];
        leftChatMember?: User;
        newChatTitle?: string;
        newChatPhoto?: PhotoSize[];
        deleteChatPhoto?: boolean;
        groupChatCreated?: boolean;
        supergroupChatCreated?: boolean;
        channelChatCreated?: boolean;
        migrateToChatId?: number;
        migrateFromChatId?: number;
        pinnedMessage?: Message;
        invoice?: Invoice;
        successfulPayment?: SuccessfulPayment;
        connectedWebsite?: string;
        passportData?: PassportData;
        replyMarkup?: InlineKeyboardMarkup;
    }

    interface MessageEntity {
        type: MessageEntityType;
        offset: number;
        length: number;
        url?: string;
        user?: User;
    }

    interface FileBase {
        fileId: string;
        fileSize?: number;
    }

    interface PhotoSize extends FileBase {
        width: number;
        height: number;
    }

    interface Audio extends FileBase {
        duration: number;
        performer?: string;
        title?: string;
        mimeType?: string;
        thumb?: PhotoSize;
    }

    interface Document extends FileBase {
        thumb?: PhotoSize;
        fileName?: string;
        mimeType?: string;
    }

    interface Video extends FileBase {
        width: number;
        height: number;
        duration: number;
        thumb?: PhotoSize;
        mimeType?: string;
    }

    interface Voice extends FileBase {
        duration: number;
        mimeType?: string;
    }

    interface InputMediaBase {
        media: string;
        caption?: string;
        parseMode?: ParseMode;
    }

    interface InputMediaPhoto extends InputMediaBase {
        type: 'photo';
    }

    interface InputMediaVideo extends InputMediaBase {
        type: 'video';
        width?: number;
        height?: number;
        duration?: number;
        supportsStreaming?: boolean;
    }

    type InputMedia = InputMediaPhoto | InputMediaVideo;

    interface VideoNote extends FileBase {
        length: number;
        duration: number;
        thumb?: PhotoSize;
    }

    interface Contact {
        phoneNumber: string;
        firstName: string;
        lastName?: string;
        userId?: number;
        vcard?: string;
    }

    interface Location {
        longitude: number;
        latitude: number;
    }

    interface Venue {
        location: Location;
        title: string;
        address: string;
        foursquareId?: string;
        foursquareType?: string;
    }

    type PollType = 'regular' | 'quiz';

    interface PollAnswer {
        pollId: string;
        user: User;
        optionIds: number[];
    }

    interface PollOption {
        text: string;
        voterCount: number;
    }

    interface Poll {
        id: string;
        question: string;
        options: PollOption[];
        isClosed: boolean;
        isAnonymous: boolean;
        allowsMultipleAnswers: boolean;
        type: PollType;
        totalVoterCount: number;
    }

    interface UserProfilePhotos {
        totalCount: number;
        photos: PhotoSize[][];
    }

    interface File extends FileBase {
        filePath?: string;
    }

    interface ReplyKeyboardMarkup {
        keyboard: KeyboardButton[][];
        resizeKeyboard?: boolean;
        oneTimeKeyboard?: boolean;
        selective?: boolean;
    }

    interface KeyboardButton {
        text: string;
        requestContact?: boolean;
        requestLocation?: boolean;
    }

    interface ReplyKeyboardRemove {
        removeKeyboard: boolean;
        selective?: boolean;
    }

    interface InlineKeyboardMarkup {
        inlineKeyboard: InlineKeyboardButton[][];
    }

    interface InlineKeyboardButton {
        text: string;
        url?: string;
        loginUrl?: LoginUrl;
        callbackData?: string;
        switchInlineQuery?: string;
        switchInlineQueryCurrentChat?: string;
        callbackGame?: CallbackGame;
        pay?: boolean;
    }

    interface LoginUrl {
        url: string;
        forwardText?: string;
        botUsername?: string;
        requestWriteAcces?: boolean;
    }

    interface CallbackQuery {
        id: string;
        from: User;
        message?: Message;
        inlineMessageId?: string;
        chatInstance: string;
        data?: string;
        gameShortName?: string;
    }

    interface ForceReply {
        forceReply: boolean;
        selective?: boolean;
    }

    interface ChatPhoto {
        smallFileId: string;
        bigFileId: string;
    }

    interface ChatMember {
        user: User;
        status: ChatMemberStatus;
        untilDate?: number;
        canBeEdited?: boolean;
        canPostMessages?: boolean;
        canEditMessages?: boolean;
        canDeleteMessages?: boolean;
        canRestrictMembers?: boolean;
        canPromoteMembers?: boolean;
        canChangeInfo?: boolean;
        canInviteUsers?: boolean;
        canPinMessages?: boolean;
        isMember?: boolean;
        canSendMessages?: boolean;
        canSendMediaMessages?: boolean;
        canSendPolls: boolean;
        canSendOtherMessages?: boolean;
        canAddWebPagePreviews?: boolean;
    }

    interface ChatPermissions {
        canSendMessages?: boolean;
        canSendMediaMessages?: boolean;
        canSendPolls?: boolean;
        canSendOtherMessages?: boolean;
        canAddWebPagePreviews?: boolean;
        canChangeInfo?: boolean;
        canInviteUsers?: boolean;
        canPinMessages?: boolean;
    }

    interface Sticker {
        fileId: string;
        fileUniqueId: string;
        isAnimated: boolean;
        width: number;
        height: number;
        thumb?: PhotoSize;
        emoji?: string;
        setName?: string;
        maskPosition?: MaskPosition;
        fileSize?: number;
    }

    interface StickerSet {
        name: string;
        title: string;
        containsMasks: boolean;
        stickers: Sticker[];
    }

    interface MaskPosition {
        point: string;
        xShift: number;
        yShift: number;
        scale: number;
    }

    interface InlineQuery {
        id: string;
        from: User;
        location?: Location;
        query: string;
        offset: string;
    }

    interface InlineQueryResultBase {
        id: string;
        replyMarkup?: InlineKeyboardMarkup;
    }

    interface InlineQueryResultArticle extends InlineQueryResultBase {
        type: 'article';
        title: string;
        inputMessageContent: InputMessageContent;
        url?: string;
        hideUrl?: boolean;
        description?: string;
        thumbUrl?: string;
        thumbWidth?: number;
        thumbHeight?: number;
    }

    interface InlineQueryResultPhoto extends InlineQueryResultBase {
        type: 'photo';
        photoUrl: string;
        thumbUrl: string;
        photoWidth?: number;
        photoHeight?: number;
        title?: string;
        description?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultGif extends InlineQueryResultBase {
        type: 'gif';
        gifUrl: string;
        gifWidth?: number;
        gifHeight?: number;
        gifDuration?: number;
        thumbUrl?: string;
        title?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultMpeg4Gif extends InlineQueryResultBase {
        type: 'mpeg4_gif';
        mpeg4Url: string;
        mpeg4Width?: number;
        mpeg4Height?: number;
        mpeg4Duration?: number;
        thumbUrl?: string;
        title?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultVideo extends InlineQueryResultBase {
        type: 'video';
        videoUrl: string;
        mimeType: string;
        thumbUrl: string;
        title: string;
        caption?: string;
        videoWidth?: number;
        videoHeight?: number;
        videoDuration?: number;
        description?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultAudio extends InlineQueryResultBase {
        type: 'audio';
        audioUrl: string;
        title: string;
        caption?: string;
        performer?: string;
        audioDuration?: number;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultVoice extends InlineQueryResultBase {
        type: 'voice';
        voiceUrl: string;
        title: string;
        caption?: string;
        voiceDuration?: number;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultDocument extends InlineQueryResultBase {
        type: 'document';
        title: string;
        caption?: string;
        documentUrl: string;
        mimeType: string;
        description?: string;
        inputMessageContent?: InputMessageContent;
        thumbUrl?: string;
        thumbWidth?: number;
        thumbHeight?: number;
    }

    interface InlineQueryResultLocationBase extends InlineQueryResultBase {
        latitude: number;
        longitude: number;
        title: string;
        inputMessageContent?: InputMessageContent;
        thumbUrl?: string;
        thumbWidth?: number;
        thumbHeight?: number;
    }

    interface InlineQueryResultLocation extends InlineQueryResultLocationBase {
        type: 'location';
    }

    interface InlineQueryResultVenue extends InlineQueryResultLocationBase {
        type: 'venue';
        address: string;
        foursquareId?: string;
    }

    interface InlineQueryResultContact extends InlineQueryResultBase {
        type: 'contact';
        phoneNumber: string;
        firstName: string;
        lastName?: string;
        inputMessageContent?: InputMessageContent;
        thumbUrl?: string;
        thumbWidth?: number;
        thumbHeight?: number;
    }

    interface InlineQueryResultGame extends InlineQueryResultBase {
        type: 'game';
        gameShortName: string;
    }

    interface InlineQueryResultCachedPhoto extends InlineQueryResultBase {
        type: 'photo';
        photoFileId: string;
        title?: string;
        description?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedGif extends InlineQueryResultBase {
        type: 'gif';
        gifFileId: string;
        title?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedMpeg4Gif extends InlineQueryResultBase {
        type: 'mpeg4_gif';
        mpeg4FileId: string;
        title?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedSticker extends InlineQueryResultBase {
        type: 'sticker';
        stickerFileId: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedDocument extends InlineQueryResultBase {
        type: 'document';
        title: string;
        documentFileId: string;
        description?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedVideo extends InlineQueryResultBase {
        type: 'video';
        videoFileId: string;
        title: string;
        description?: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedVoice extends InlineQueryResultBase {
        type: 'voice';
        voiceFileId: string;
        title: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    interface InlineQueryResultCachedAudio extends InlineQueryResultBase {
        type: 'audio';
        audioFileId: string;
        caption?: string;
        inputMessageContent?: InputMessageContent;
    }

    type InlineQueryResult =
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
        InlineQueryResultVoice;

    type InputMessageContent = object;

    interface InputTextMessageContent extends InputMessageContent {
        messageText: string;
        parseMode?: ParseMode;
        disableWebPagePreview?: boolean;
    }

    interface InputLocationMessageContent extends InputMessageContent {
        latitude: number;
        longitude: number;
    }

    interface InputVenueMessageContent extends InputLocationMessageContent {
        title: string;
        address: string;
        foursquareId?: string;
    }

    interface InputContactMessageContent extends InputMessageContent {
        phoneNumber: string;
        firstName: string;
        lastName?: string;
    }

    interface ChosenInlineResult {
        resultId: string;
        from: User;
        location?: Location;
        inlineMessageId?: string;
        query: string;
    }

    interface ResponseParameters {
        migrateToChatId?: number;
        retryAfter?: number;
    }

    interface LabeledPrice {
        label: string;
        amount: number;
    }

    interface Invoice {
        title: string;
        description: string;
        startParameter: string;
        currency: string;
        totalAmount: number;
    }

    interface ShippingAddress {
        countryCode: string;
        state: string;
        city: string;
        streetLine1: string;
        streetLine2: string;
        postCode: string;
    }

    interface OrderInfo {
        name?: string;
        phoneNumber?: string;
        email?: string;
        shippingAddress?: ShippingAddress;
    }

    interface ShippingOption {
        id: string;
        title: string;
        prices: LabeledPrice[];
    }

    interface SuccessfulPayment {
        currency: string;
        totalAmount: number;
        invoicePayload: string;
        shippingOptionId?: string;
        orderInfo?: OrderInfo;
        telegramPaymentChargeId: string;
        providerPaymentChargeId: string;
    }

    interface ShippingQuery {
        id: string;
        from: User;
        invoicePayload: string;
        shippingAddress: ShippingAddress;
    }

    interface PreCheckoutQuery {
        id: string;
        from: User;
        currency: string;
        totalAmount: number;
        invoicePayload: string;
        shippingOptionId?: string;
        orderInfo?: OrderInfo;
    }

    interface Game {
        title: string;
        description: string;
        photo: PhotoSize[];
        text?: string;
        textEntities?: MessageEntity[];
        animation?: Animation;
    }

    interface Animation extends FileBase {
        width: number;
        height: number;
        duration: number;
        thumb?: PhotoSize;
        fileName?: string;
        mimeType?: string;
    }

    type CallbackGame = object;

    interface GameHighScore {
        position: number;
        user: User;
        score: number;
    }

    interface Metadata {
        type?: MessageType;
    }

    interface BotCommand {
        command: string;
        description: string;
    }
}

export = Telegram;
