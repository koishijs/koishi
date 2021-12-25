export class KoishiError extends Error {
  name = 'KoishiError'

  constructor(message: string, public code: KoishiError.Code) {
    super(message)
  }

  static check(error: any, code?: KoishiError.Code) {
    if (!(error instanceof KoishiError)) return false
    return !code || error.code === code
  }
}

export namespace KoishiError {
  export type Code =
    | 'database.duplicate-entry'
    | 'model.invalid-field'
    | 'model.invalid-query'
}
