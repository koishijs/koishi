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
        file_id: string;
        file_size: number;
        file_date: number;
    }

    interface EncryptedPassportElement {
        type: string;
        data?: string;
        phone_number?: string;
        email?: string;
        files?: PassportFile[];
        front_side?: PassportFile;
        reverse_side?: PassportFile;
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
        update_id: number;
        message?: Message;
        edited_message?: Message;
        channel_post?: Message;
        edited_channel_post?: Message;
        inline_query?: InlineQuery;
        chosen_inline_result?: ChosenInlineResult;
        callback_query?: CallbackQuery;
        shipping_query?: ShippingQuery;
        pre_checkout_query?: PreCheckoutQuery;
    }

    interface WebhookInfo {
        url: string;
        has_custom_certificate: boolean;
        pending_update_count: number;
        last_error_date?: number;
        last_error_message?: string;
        max_connections?: number;
        allowed_updates?: string[];
    }

    interface User {
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
    }

    interface Chat {
        id: number;
        type: ChatType;
        title?: string;
        username?: string;
        first_name?: string;
        last_name?: string;
        photo?: ChatPhoto;
        description?: string;
        invite_link?: string;
        pinned_message?: Message;
        permissions?: ChatPermissions;
        can_set_sticker_set?: boolean;
        sticker_set_name?: string;
        /**
         * @deprecated since version Telegram Bot API 4.4 - July 29, 2019
         */
        all_members_are_administrators?: boolean;
    }

    interface Message {
        message_id: number;
        from?: User;
        date: number;
        chat: Chat;
        forward_from?: User;
        forward_from_chat?: Chat;
        forward_from_message_id?: number;
        forward_signature?: string;
        forward_sender_name?: string;
        forward_date?: number;
        reply_to_message?: Message;
        edit_date?: number;
        media_group_id?: string;
        author_signature?: string;
        text?: string;
        entities?: MessageEntity[];
        caption_entities?: MessageEntity[];
        audio?: Audio;
        document?: Document;
        animation?: Animation;
        game?: Game;
        photo?: PhotoSize[];
        sticker?: Sticker;
        video?: Video;
        voice?: Voice;
        video_note?: VideoNote;
        caption?: string;
        contact?: Contact;
        location?: Location;
        venue?: Venue;
        poll?: Poll;
        new_chat_members?: User[];
        left_chat_member?: User;
        new_chat_title?: string;
        new_chat_photo?: PhotoSize[];
        delete_chat_photo?: boolean;
        group_chat_created?: boolean;
        supergroup_chat_created?: boolean;
        channel_chat_created?: boolean;
        migrate_to_chat_id?: number;
        migrate_from_chat_id?: number;
        pinned_message?: Message;
        invoice?: Invoice;
        successful_payment?: SuccessfulPayment;
        connected_website?: string;
        passport_data?: PassportData;
        reply_markup?: InlineKeyboardMarkup;
    }

    interface MessageEntity {
        type: MessageEntityType;
        offset: number;
        length: number;
        url?: string;
        user?: User;
    }

    interface FileBase {
        file_id: string;
        file_size?: number;
    }

    interface PhotoSize extends FileBase {
        width: number;
        height: number;
    }

    interface Audio extends FileBase {
        duration: number;
        performer?: string;
        title?: string;
        mime_type?: string;
        thumb?: PhotoSize;
    }

    interface Document extends FileBase {
        thumb?: PhotoSize;
        file_name?: string;
        mime_type?: string;
    }

    interface Video extends FileBase {
        width: number;
        height: number;
        duration: number;
        thumb?: PhotoSize;
        mime_type?: string;
    }

    interface Voice extends FileBase {
        duration: number;
        mime_type?: string;
    }

    interface InputMediaBase {
        media: string;
        caption?: string;
        parse_mode?: ParseMode;
    }

    interface InputMediaPhoto extends InputMediaBase {
        type: 'photo';
    }

    interface InputMediaVideo extends InputMediaBase {
        type: 'video';
        width?: number;
        height?: number;
        duration?: number;
        supports_streaming?: boolean;
    }

    type InputMedia = InputMediaPhoto | InputMediaVideo;

    interface VideoNote extends FileBase {
        length: number;
        duration: number;
        thumb?: PhotoSize;
    }

    interface Contact {
        phone_number: string;
        first_name: string;
        last_name?: string;
        user_id?: number;
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
        foursquare_id?: string;
        foursquare_type?: string;
    }

    type PollType = 'regular' | 'quiz';

    interface PollAnswer {
        poll_id: string;
        user: User;
        option_ids: number[];
    }

    interface PollOption {
        text: string;
        voter_count: number;
    }

    interface Poll {
        id: string;
        question: string;
        options: PollOption[];
        is_closed: boolean;
        is_anonymous: boolean;
        allows_multiple_answers: boolean;
        type: PollType;
        total_voter_count: number;
    }

    interface UserProfilePhotos {
        total_count: number;
        photos: PhotoSize[][];
    }

    interface File extends FileBase {
        file_path?: string;
    }

    interface ReplyKeyboardMarkup {
        keyboard: KeyboardButton[][];
        resize_keyboard?: boolean;
        one_time_keyboard?: boolean;
        selective?: boolean;
    }

    interface KeyboardButton {
        text: string;
        request_contact?: boolean;
        request_location?: boolean;
    }

    interface ReplyKeyboardRemove {
        remove_keyboard: boolean;
        selective?: boolean;
    }

    interface InlineKeyboardMarkup {
        inline_keyboard: InlineKeyboardButton[][];
    }

    interface InlineKeyboardButton {
        text: string;
        url?: string;
        login_url?: LoginUrl;
        callback_data?: string;
        switch_inline_query?: string;
        switch_inline_query_current_chat?: string;
        callback_game?: CallbackGame;
        pay?: boolean;
    }

    interface LoginUrl {
        url: string;
        forward_text?: string;
        bot_username?: string;
        request_write_acces?: boolean;
    }

    interface CallbackQuery {
        id: string;
        from: User;
        message?: Message;
        inline_message_id?: string;
        chat_instance: string;
        data?: string;
        game_short_name?: string;
    }

    interface ForceReply {
        force_reply: boolean;
        selective?: boolean;
    }

    interface ChatPhoto {
        small_file_id: string;
        big_file_id: string;
    }

    interface ChatMember {
        user: User;
        status: ChatMemberStatus;
        until_date?: number;
        can_be_edited?: boolean;
        can_post_messages?: boolean;
        can_edit_messages?: boolean;
        can_delete_messages?: boolean;
        can_restrict_members?: boolean;
        can_promote_members?: boolean;
        can_change_info?: boolean;
        can_invite_users?: boolean;
        can_pin_messages?: boolean;
        is_member?: boolean;
        can_send_messages?: boolean;
        can_send_media_messages?: boolean;
        can_send_polls: boolean;
        can_send_other_messages?: boolean;
        can_add_web_page_previews?: boolean;
    }

    interface ChatPermissions {
        can_send_messages?: boolean;
        can_send_media_messages?: boolean;
        can_send_polls?: boolean;
        can_send_other_messages?: boolean;
        can_add_web_page_previews?: boolean;
        can_change_info?: boolean;
        can_invite_users?: boolean;
        can_pin_messages?: boolean;
    }

    interface Sticker {
        file_id: string;
        file_unique_id: string;
        is_animated: boolean;
        width: number;
        height: number;
        thumb?: PhotoSize;
        emoji?: string;
        set_name?: string;
        mask_position?: MaskPosition;
        file_size?: number;
    }

    interface StickerSet {
        name: string;
        title: string;
        contains_masks: boolean;
        stickers: Sticker[];
    }

    interface MaskPosition {
        point: string;
        x_shift: number;
        y_shift: number;
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
        reply_markup?: InlineKeyboardMarkup;
    }

    interface InlineQueryResultArticle extends InlineQueryResultBase {
        type: 'article';
        title: string;
        input_message_content: InputMessageContent;
        url?: string;
        hide_url?: boolean;
        description?: string;
        thumb_url?: string;
        thumb_width?: number;
        thumb_height?: number;
    }

    interface InlineQueryResultPhoto extends InlineQueryResultBase {
        type: 'photo';
        photo_url: string;
        thumb_url: string;
        photo_width?: number;
        photo_height?: number;
        title?: string;
        description?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultGif extends InlineQueryResultBase {
        type: 'gif';
        gif_url: string;
        gif_width?: number;
        gif_height?: number;
        gif_duration?: number;
        thumb_url?: string;
        title?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultMpeg4Gif extends InlineQueryResultBase {
        type: 'mpeg4_gif';
        mpeg4_url: string;
        mpeg4_width?: number;
        mpeg4_height?: number;
        mpeg4_duration?: number;
        thumb_url?: string;
        title?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultVideo extends InlineQueryResultBase {
        type: 'video';
        video_url: string;
        mime_type: string;
        thumb_url: string;
        title: string;
        caption?: string;
        video_width?: number;
        video_height?: number;
        video_duration?: number;
        description?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultAudio extends InlineQueryResultBase {
        type: 'audio';
        audio_url: string;
        title: string;
        caption?: string;
        performer?: string;
        audio_duration?: number;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultVoice extends InlineQueryResultBase {
        type: 'voice';
        voice_url: string;
        title: string;
        caption?: string;
        voice_duration?: number;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultDocument extends InlineQueryResultBase {
        type: 'document';
        title: string;
        caption?: string;
        document_url: string;
        mime_type: string;
        description?: string;
        input_message_content?: InputMessageContent;
        thumb_url?: string;
        thumb_width?: number;
        thumb_height?: number;
    }

    interface InlineQueryResultLocationBase extends InlineQueryResultBase {
        latitude: number;
        longitude: number;
        title: string;
        input_message_content?: InputMessageContent;
        thumb_url?: string;
        thumb_width?: number;
        thumb_height?: number;
    }

    interface InlineQueryResultLocation extends InlineQueryResultLocationBase {
        type: 'location';
    }

    interface InlineQueryResultVenue extends InlineQueryResultLocationBase {
        type: 'venue';
        address: string;
        foursquare_id?: string;
    }

    interface InlineQueryResultContact extends InlineQueryResultBase {
        type: 'contact';
        phone_number: string;
        first_name: string;
        last_name?: string;
        input_message_content?: InputMessageContent;
        thumb_url?: string;
        thumb_width?: number;
        thumb_height?: number;
    }

    interface InlineQueryResultGame extends InlineQueryResultBase {
        type: 'game';
        game_short_name: string;
    }

    interface InlineQueryResultCachedPhoto extends InlineQueryResultBase {
        type: 'photo';
        photo_file_id: string;
        title?: string;
        description?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedGif extends InlineQueryResultBase {
        type: 'gif';
        gif_file_id: string;
        title?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedMpeg4Gif extends InlineQueryResultBase {
        type: 'mpeg4_gif';
        mpeg4_file_id: string;
        title?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedSticker extends InlineQueryResultBase {
        type: 'sticker';
        sticker_file_id: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedDocument extends InlineQueryResultBase {
        type: 'document';
        title: string;
        document_file_id: string;
        description?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedVideo extends InlineQueryResultBase {
        type: 'video';
        video_file_id: string;
        title: string;
        description?: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedVoice extends InlineQueryResultBase {
        type: 'voice';
        voice_file_id: string;
        title: string;
        caption?: string;
        input_message_content?: InputMessageContent;
    }

    interface InlineQueryResultCachedAudio extends InlineQueryResultBase {
        type: 'audio';
        audio_file_id: string;
        caption?: string;
        input_message_content?: InputMessageContent;
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
        message_text: string;
        parse_mode?: ParseMode;
        disable_web_page_preview?: boolean;
    }

    interface InputLocationMessageContent extends InputMessageContent {
        latitude: number;
        longitude: number;
    }

    interface InputVenueMessageContent extends InputLocationMessageContent {
        title: string;
        address: string;
        foursquare_id?: string;
    }

    interface InputContactMessageContent extends InputMessageContent {
        phone_number: string;
        first_name: string;
        last_name?: string;
    }

    interface ChosenInlineResult {
        result_id: string;
        from: User;
        location?: Location;
        inline_message_id?: string;
        query: string;
    }

    interface ResponseParameters {
        migrate_to_chat_id?: number;
        retry_after?: number;
    }

    interface LabeledPrice {
        label: string;
        amount: number;
    }

    interface Invoice {
        title: string;
        description: string;
        start_parameter: string;
        currency: string;
        total_amount: number;
    }

    interface ShippingAddress {
        country_code: string;
        state: string;
        city: string;
        street_line1: string;
        street_line2: string;
        post_code: string;
    }

    interface OrderInfo {
        name?: string;
        phone_number?: string;
        email?: string;
        shipping_address?: ShippingAddress;
    }

    interface ShippingOption {
        id: string;
        title: string;
        prices: LabeledPrice[];
    }

    interface SuccessfulPayment {
        currency: string;
        total_amount: number;
        invoice_payload: string;
        shipping_option_id?: string;
        order_info?: OrderInfo;
        telegram_payment_charge_id: string;
        provider_payment_charge_id: string;
    }

    interface ShippingQuery {
        id: string;
        from: User;
        invoice_payload: string;
        shipping_address: ShippingAddress;
    }

    interface PreCheckoutQuery {
        id: string;
        from: User;
        currency: string;
        total_amount: number;
        invoice_payload: string;
        shipping_option_id?: string;
        order_info?: OrderInfo;
    }

    interface Game {
        title: string;
        description: string;
        photo: PhotoSize[];
        text?: string;
        text_entities?: MessageEntity[];
        animation?: Animation;
    }

    interface Animation extends FileBase {
        width: number;
        height: number;
        duration: number;
        thumb?: PhotoSize;
        file_name?: string;
        mime_type?: string;
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
