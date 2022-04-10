export class ModelError extends Error {
  name = 'ModelError'
}

export namespace DriverError {
  export type Code =
    | 'duplicate-entry'
}

export class DriverError<T extends DriverError.Code> extends Error {
  name = 'DriverError'

  constructor(public code: T, message?: string) {
    super(message || code.replace('-', ' '))
  }

  static check<T extends DriverError.Code>(error: any, code?: DriverError.Code): error is DriverError<T> {
    if (!(error instanceof DriverError)) return false
    return !code || error.message === code
  }
}
