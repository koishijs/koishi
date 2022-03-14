import { Integer, Internal } from '.'

/**
 * Contains information about Telegram Passport data shared with the bot by the user.
 * @see https://core.telegram.org/bots/api#passportdata
 */
export interface PassportData {
  /** Array with information about documents and other Telegram Passport elements that was shared with the bot */
  data?: EncryptedPassportElement[]
  /** Encrypted credentials required to decrypt the data */
  credentials?: EncryptedCredentials
}

/**
 * This object represents a file uploaded to Telegram Passport. Currently all Telegram Passport files are in JPEG format when decrypted and don't exceed 10MB.
 * @see https://core.telegram.org/bots/api#passportfile
 */
export interface PassportFile {
  /** Identifier for this file, which can be used to download or reuse the file */
  file_id?: string
  /** Unique identifier for this file, which is supposed to be the same over time and for different bots. Can't be used to download or reuse the file. */
  file_unique_id?: string
  /** File size in bytes */
  file_size?: Integer
  /** Unix time when the file was uploaded */
  file_date?: Integer
}

/**
 * Contains information about documents or other Telegram Passport elements shared with the bot by the user.
 * @see https://core.telegram.org/bots/api#encryptedpassportelement
 */
export interface EncryptedPassportElement {
  /** Element type. One of "personal_details", "passport", "driver_license", "identity_card", "internal_passport", "address", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration", "phone_number", "email". */
  type?: string
  /** Optional. Base64-encoded encrypted Telegram Passport element data provided by the user, available for "personal_details", "passport", "driver_license", "identity_card", "internal_passport" and "address" types. Can be decrypted and verified using the accompanying EncryptedCredentials. */
  data?: string
  /** Optional. User's verified phone number, available only for "phone_number" type */
  phone_number?: string
  /** Optional. User's verified email address, available only for "email" type */
  email?: string
  /** Optional. encrypted files with documents provided by the user, available for "utility_bill", "bank_statement", "rental_agreement", "passport_registration" and "temporary_registration" types. Files can be decrypted and verified using the accompanying EncryptedCredentials. */
  files?: PassportFile[]
  /** Optional. Encrypted file with the front side of the document, provided by the user. Available for "passport", "driver_license", "identity_card" and "internal_passport". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  front_side?: PassportFile
  /** Optional. Encrypted file with the reverse side of the document, provided by the user. Available for "driver_license" and "identity_card". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  reverse_side?: PassportFile
  /** Optional. Encrypted file with the selfie of the user holding a document, provided by the user; available for "passport", "driver_license", "identity_card" and "internal_passport". The file can be decrypted and verified using the accompanying EncryptedCredentials. */
  selfie?: PassportFile
  /** Optional. encrypted files with translated versions of documents provided by the user. Available if requested for "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration" and "temporary_registration" types. Files can be decrypted and verified using the accompanying EncryptedCredentials. */
  translation?: PassportFile[]
  /** Base64-encoded element hash for using in PassportElementErrorUnspecified */
  hash?: string
}

/**
 * Contains data required for decrypting and authenticating EncryptedPassportElement. See the Telegram Passport Documentation for a complete description of the data decryption and authentication processes.
 * @see https://core.telegram.org/bots/api#encryptedcredentials
 */
export interface EncryptedCredentials {
  /** Base64-encoded encrypted JSON-serialized data with unique user's payload, data hashes and secrets required for EncryptedPassportElement decryption and authentication */
  data?: string
  /** Base64-encoded data hash for data authentication */
  hash?: string
  /** Base64-encoded secret, encrypted with the bot's public RSA key, required for data decryption */
  secret?: string
}

export interface SetPassportDataErrorsPayload {
  /** User identifier */
  user_id?: Integer
  /** A JSON-serialized array describing the errors */
  errors?: PassportElementError[]
}

/**
 * This object represents an error in the Telegram Passport element which was submitted that should be resolved by the user. It should be one of:
 * - PassportElementErrorDataField
 * - PassportElementErrorFrontSide
 * - PassportElementErrorReverseSide
 * - PassportElementErrorSelfie
 * - PassportElementErrorFile
 * - PassportElementErrorFiles
 * - PassportElementErrorTranslationFile
 * - PassportElementErrorTranslationFiles
 * - PassportElementErrorUnspecified
 * @see https://core.telegram.org/bots/api#passportelementerror
 */
export type PassportElementError =
  | PassportElementErrorDataField
  | PassportElementErrorFrontSide
  | PassportElementErrorReverseSide
  | PassportElementErrorSelfie
  | PassportElementErrorFile
  | PassportElementErrorFiles
  | PassportElementErrorTranslationFile
  | PassportElementErrorTranslationFiles
  | PassportElementErrorUnspecified

/**
 * Represents an issue in one of the data fields that was provided by the user. The error is considered resolved when the field's value changes.
 * @see https://core.telegram.org/bots/api#passportelementerrordatafield
 */
export interface PassportElementErrorDataField {
  /** Error source, must be data */
  source?: string
  /** The section of the user's Telegram Passport which has the error, one of "personal_details", "passport", "driver_license", "identity_card", "internal_passport", "address" */
  type?: string
  /** Name of the data field which has the error */
  field_name?: string
  /** Base64-encoded data hash */
  data_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with the front side of a document. The error is considered resolved when the file with the front side of the document changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfrontside
 */
export interface PassportElementErrorFrontSide {
  /** Error source, must be front_side */
  source?: string
  /** The section of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport" */
  type?: string
  /** Base64-encoded hash of the file with the front side of the document */
  file_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with the reverse side of a document. The error is considered resolved when the file with reverse side of the document changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorreverseside
 */
export interface PassportElementErrorReverseSide {
  /** Error source, must be reverse_side */
  source?: string
  /** The section of the user's Telegram Passport which has the issue, one of "driver_license", "identity_card" */
  type?: string
  /** Base64-encoded hash of the file with the reverse side of the document */
  file_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with the selfie with a document. The error is considered resolved when the file with the selfie changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorselfie
 */
export interface PassportElementErrorSelfie {
  /** Error source, must be selfie */
  source?: string
  /** The section of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport" */
  type?: string
  /** Base64-encoded hash of the file with the selfie */
  file_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with a document scan. The error is considered resolved when the file with the document scan changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfile
 */
export interface PassportElementErrorFile {
  /** Error source, must be file */
  source?: string
  /** The section of the user's Telegram Passport which has the issue, one of "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: string
  /** Base64-encoded file hash */
  file_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with a list of scans. The error is considered resolved when the list of files containing the scans changes.
 * @see https://core.telegram.org/bots/api#passportelementerrorfiles
 */
export interface PassportElementErrorFiles {
  /** Error source, must be files */
  source?: string
  /** The section of the user's Telegram Passport which has the issue, one of "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: string
  /** List of base64-encoded file hashes */
  file_hashes?: string[]
  /** Error message */
  message?: string
}

/**
 * Represents an issue with one of the files that constitute the translation of a document. The error is considered resolved when the file changes.
 * @see https://core.telegram.org/bots/api#passportelementerrortranslationfile
 */
export interface PassportElementErrorTranslationFile {
  /** Error source, must be translation_file */
  source?: string
  /** Type of element of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: string
  /** Base64-encoded file hash */
  file_hash?: string
  /** Error message */
  message?: string
}

/**
 * Represents an issue with the translated version of a document. The error is considered resolved when a file with the document translation change.
 * @see https://core.telegram.org/bots/api#passportelementerrortranslationfiles
 */
export interface PassportElementErrorTranslationFiles {
  /** Error source, must be translation_files */
  source?: string
  /** Type of element of the user's Telegram Passport which has the issue, one of "passport", "driver_license", "identity_card", "internal_passport", "utility_bill", "bank_statement", "rental_agreement", "passport_registration", "temporary_registration" */
  type?: string
  /** List of base64-encoded file hashes */
  file_hashes?: string[]
  /** Error message */
  message?: string
}

/**
 * Represents an issue in an unspecified place. The error is considered resolved when new data is added.
 * @see https://core.telegram.org/bots/api#passportelementerrorunspecified
 */
export interface PassportElementErrorUnspecified {
  /** Error source, must be unspecified */
  source?: string
  /** Type of element of the user's Telegram Passport which has the issue */
  type?: string
  /** Base64-encoded element hash */
  element_hash?: string
  /** Error message */
  message?: string
}

declare module '.' {
  interface Message {
    /** Optional. Telegram Passport data */
    passport_data?: PassportData
  }
}

declare module './internal' {
  interface Internal {
    /**
     * Informs a user that some of the Telegram Passport elements they provided contains errors. The user will not be able to re-submit their Passport to you until the errors are fixed (the contents of the field for which you returned the error must change). Returns True on success.
     *
     * Use this if the data submitted by the user doesn't satisfy the standards your service requires for any reason. For example, if a birthday date seems invalid, a submitted document is blurry, a scan shows evidence of tampering, etc. Supply some details in the error message to make sure the user knows how to correct the issues.
     * @see https://core.telegram.org/bots/api#setpassportdataerrors
     */
    setPassportDataErrors(payload: SetPassportDataErrorsPayload): Promise<boolean>
  }
}

Internal.define('setPassportDataErrors')
