/// <reference types="chai" />

declare namespace Chai {
  interface Assertion {
    shape(expected: any): void
  }

  interface Eventually {
    shape(expected: any, message?: string): any
  }
}
