import { InlineKeyboardMarkup, Integer, Internal, Message, User } from '.'

export interface SendInvoicePayload {
  /** Unique identifier for the target chat or username of the target channel (in the format @channelusername) */
  chat_id?: Integer | string
  /** Product name, 1-32 characters */
  title?: string
  /** Product description, 1-255 characters */
  description?: string
  /** Bot-defined invoice payload, 1-128 bytes. This will not be displayed to the user, use for your internal processes. */
  payload?: string
  /** Payments provider token, obtained via Botfather */
  provider_token?: string
  /** Three-letter ISO 4217 currency code, see more on currencies */
  currency?: string
  /** Price breakdown, a JSON-serialized list of components (e.g. product price, tax, discount, delivery cost, delivery tax, bonus, etc.) */
  prices?: LabeledPrice[]
  /** The maximum accepted amount for tips in the smallest units of the currency (integer, not float/double). For example, for a maximum tip of US$ 1.45 pass max_tip_amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). Defaults to 0 */
  max_tip_amount?: Integer
  /** A JSON-serialized array of suggested amounts of tips in the smallest units of the currency (integer, not float/double). At most 4 suggested tip amounts can be specified. The suggested tip amounts must be positive, passed in a strictly increased order and must not exceed max_tip_amount. */
  suggested_tip_amounts?: Integer[]
  /** Unique deep-linking parameter. If left empty, forwarded copies of the sent message will have a Pay button, allowing multiple users to pay directly from the forwarded message, using the same invoice. If non-empty, forwarded copies of the sent message will have a URL button with a deep link to the bot (instead of a Pay button), with the value used as the start parameter */
  start_parameter?: string
  /** A JSON-serialized data about the invoice, which will be shared with the payment provider. A detailed description of required fields should be provided by the payment provider. */
  provider_data?: string
  /** URL of the product photo for the invoice. Can be a photo of the goods or a marketing image for a service. People like it better when they see what they are paying for. */
  photo_url?: string
  /** Photo size */
  photo_size?: Integer
  /** Photo width */
  photo_width?: Integer
  /** Photo height */
  photo_height?: Integer
  /** Pass True, if you require the user's full name to complete the order */
  need_name?: boolean
  /** Pass True, if you require the user's phone number to complete the order */
  need_phone_number?: boolean
  /** Pass True, if you require the user's email address to complete the order */
  need_email?: boolean
  /** Pass True, if you require the user's shipping address to complete the order */
  need_shipping_address?: boolean
  /** Pass True, if user's phone number should be sent to provider */
  send_phone_number_to_provider?: boolean
  /** Pass True, if user's email address should be sent to provider */
  send_email_to_provider?: boolean
  /** Pass True, if the final price depends on the shipping method */
  is_flexible?: boolean
  /** Sends the message silently. Users will receive a notification with no sound. */
  disable_notification?: boolean
  /** Protects the contents of the sent message from forwarding and saving */
  protect_content?: boolean
  /** If the message is a reply, ID of the original message */
  reply_to_message_id?: Integer
  /** Pass True, if the message should be sent even if the specified replied-to message is not found */
  allow_sending_without_reply?: boolean
  /** A JSON-serialized object for an inline keyboard. If empty, one 'Pay total price' button will be shown. If not empty, the first button must be a Pay button. */
  reply_markup?: InlineKeyboardMarkup
}

export interface AnswerShippingQueryPayload {
  /** Unique identifier for the query to be answered */
  shipping_query_id?: string
  /** Specify True if delivery to the specified address is possible and False if there are any problems (for example, if delivery to the specified address is not possible) */
  ok?: boolean
  /** Required if ok is True. A JSON-serialized array of available shipping options. */
  shipping_options?: ShippingOption[]
  /** Required if ok is False. Error message in human readable form that explains why it is impossible to complete the order (e.g. "Sorry, delivery to your desired address is unavailable'). Telegram will display this message to the user. */
  error_message?: string
}

export interface AnswerPreCheckoutQueryPayload {
  /** Unique identifier for the query to be answered */
  pre_checkout_query_id?: string
  /** Specify True if everything is alright (goods are available, etc.) and the bot is ready to proceed with the order. Use False if there are any problems. */
  ok?: boolean
  /** Required if ok is False. Error message in human readable form that explains the reason for failure to proceed with the checkout (e.g. "Sorry, somebody just bought the last of our amazing black T-shirts while you were busy filling out your payment details. Please choose a different color or garment!"). Telegram will display this message to the user. */
  error_message?: string
}

/**
 * This object represents a portion of the price for goods or services.
 * @see https://core.telegram.org/bots/api#labeledprice
 */
export interface LabeledPrice {
  /** Portion label */
  label?: string
  /** Price of the product in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  amount?: Integer
}

/**
 * This object contains basic information about an invoice.
 * @see https://core.telegram.org/bots/api#invoice
 */
export interface Invoice {
  /** Product name */
  title?: string
  /** Product description */
  description?: string
  /** Unique bot deep-linking parameter that can be used to generate this invoice */
  start_parameter?: string
  /** Three-letter ISO 4217 currency code */
  currency?: string
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
}

/**
 * This object represents a shipping address.
 * @see https://core.telegram.org/bots/api#shippingaddress
 */
export interface ShippingAddress {
  /** ISO 3166-1 alpha-2 country code */
  country_code?: string
  /** State, if applicable */
  state?: string
  /** City */
  city?: string
  /** First line for the address */
  street_line1?: string
  /** Second line for the address */
  street_line2?: string
  /** Address post code */
  post_code?: string
}

/**
 * This object represents information about an order.
 * @see https://core.telegram.org/bots/api#orderinfo
 */
export interface OrderInfo {
  /** Optional. User name */
  name?: string
  /** Optional. User's phone number */
  phone_number?: string
  /** Optional. User email */
  email?: string
  /** Optional. User shipping address */
  shipping_address?: ShippingAddress
}

/**
 * This object represents one shipping option.
 * @see https://core.telegram.org/bots/api#shippingoption
 */
export interface ShippingOption {
  /** Shipping option identifier */
  id?: string
  /** Option title */
  title?: string
  /** List of price portions */
  prices?: LabeledPrice[]
}

/**
 * This object contains basic information about a successful payment.
 * @see https://core.telegram.org/bots/api#successfulpayment
 */
export interface SuccessfulPayment {
  /** Three-letter ISO 4217 currency code */
  currency?: string
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
  /** Bot specified invoice payload */
  invoice_payload?: string
  /** Optional. Identifier of the shipping option chosen by the user */
  shipping_option_id?: string
  /** Optional. Order info provided by the user */
  order_info?: OrderInfo
  /** Telegram payment identifier */
  telegram_payment_charge_id?: string
  /** Provider payment identifier */
  provider_payment_charge_id?: string
}

/**
 * This object contains information about an incoming shipping query.
 * @see https://core.telegram.org/bots/api#shippingquery
 */
export interface ShippingQuery {
  /** Unique query identifier */
  id?: string
  /** User who sent the query */
  from?: User
  /** Bot specified invoice payload */
  invoice_payload?: string
  /** User specified shipping address */
  shipping_address?: ShippingAddress
}

/**
 * This object contains information about an incoming pre-checkout query.
 * @see https://core.telegram.org/bots/api#precheckoutquery
 */
export interface PreCheckoutQuery {
  /** Unique query identifier */
  id?: string
  /** User who sent the query */
  from?: User
  /** Three-letter ISO 4217 currency code */
  currency?: string
  /** Total price in the smallest units of the currency (integer, not float/double). For example, for a price of US$ 1.45 pass amount = 145. See the exp parameter in currencies.json, it shows the number of digits past the decimal point for each currency (2 for the majority of currencies). */
  total_amount?: Integer
  /** Bot specified invoice payload */
  invoice_payload?: string
  /** Optional. Identifier of the shipping option chosen by the user */
  shipping_option_id?: string
  /** Optional. Order info provided by the user */
  order_info?: OrderInfo
}

declare module '.' {
  interface Message {
    /** Optional. Message is an invoice for a payment, information about the invoice. More about payments » */
    invoice?: Invoice
    /** Optional. Message is a service message about a successful payment, information about the payment. More about payments » */
    successful_payment?: SuccessfulPayment
  }
}

declare module './update' {
  interface Update {
    /** Optional. New incoming shipping query. Only for invoices with flexible price */
    shipping_query?: ShippingQuery
    /** Optional. New incoming pre-checkout query. Contains full information about checkout */
    pre_checkout_query?: PreCheckoutQuery
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Use this method to send invoices. On success, the sent Message is returned.
     * @see https://core.telegram.org/bots/api#sendinvoice
     */
    sendInvoice(payload: SendInvoicePayload): Promise<Message>
    /**
     * If you sent an invoice requesting a shipping address and the parameter is_flexible was specified, the Bot API will send an Update with a shipping_query field to the bot. Use this method to reply to shipping queries. On success, True is returned.
     * @see https://core.telegram.org/bots/api#answershippingquery
     */
    answerShippingQuery(payload: AnswerShippingQueryPayload): Promise<boolean>
    /**
     * Once the user has confirmed their payment and shipping details, the Bot API sends the final confirmation in the form of an Update with the field pre_checkout_query. Use this method to respond to such pre-checkout queries. On success, True is returned.
     * Note: The Bot API must receive an answer within 10 seconds after the pre-checkout query was sent.
     * @see https://core.telegram.org/bots/api#answerprecheckoutquery
     */
    answerPreCheckoutQuery(payload: AnswerPreCheckoutQueryPayload): Promise<boolean>
  }
}

Internal.define('sendInvoice')
Internal.define('answerShippingQuery')
Internal.define('answerPreCheckoutQuery')
