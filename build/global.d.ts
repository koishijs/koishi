declare namespace Chai {
  interface Assertion {
    shallowDeepEqual(value: any, message?: string): Assertion
  }
}
