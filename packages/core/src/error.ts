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
    | 'runtime.max-depth-exceeded'
    | 'database.duplicate-entry'
    | 'model.missing-field-definition'
    | 'model.invalid-field-definition'
    | 'model.invalid-query'
}
