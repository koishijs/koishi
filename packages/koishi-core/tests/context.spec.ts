import { App } from '../src'

const app = new App()

describe('Composition API', () => {
  test('directly generated context', () => {
    expect(app.user(123, 456)).toBe(app.user(456, 123))
    expect(app.groups.except(123, 456)).toBe(app.groups.except(456, 123))
    expect(app.groups).toBe(app.groups.except())
    expect(app.user()).toBe(app.group())

    expect(app.discuss(789)).not.toBe(app.discusses)
    expect(app.discuss(789)).not.toBe(app.group(789))
    expect(app.discuss(789)).not.toBe(app.discuss(123, 789))
  })

  test('context.prototype.plus', () => {
    expect(app.user(123, 456).plus(app.user(456, 789))).toBe(app.user(123, 456, 789))
    expect(app.user(123, 456).plus(app.users.except(456, 789))).toBe(app.users.except(789))
    expect(app.users.except(123, 456).plus(app.user(456, 789))).toBe(app.users.except(123))
    expect(app.users.except(123, 456).plus(app.users.except(456, 789))).toBe(app.users.except(456))

    expect(app.user(123).plus(app.group(456))).toBe(app.group(456).plus(app.user(123)))
    expect(app.user(123).plus(app.groups.except(123))).toBe(app.groups.except(123).plus(app.user(123)))
    expect(app.users.except(123).plus(app.group(456))).toBe(app.group(456).plus(app.users.except(123)))
    expect(app.users.except(123).plus(app.groups.except(123))).toBe(app.groups.except(123).plus(app.users.except(123)))
  })

  test('context.prototype.minus', () => {
    expect(app.user(123, 456).minus(app.user(456, 789))).toBe(app.user(123))
    expect(app.user(123, 456).minus(app.users.except(456, 789))).toBe(app.user(456))
    expect(app.users.except(123, 456).minus(app.user(456, 789))).toBe(app.users.except(123, 456, 789))
    expect(app.users.except(123, 456).minus(app.users.except(456, 789))).toBe(app.user(789))

    expect(app.user(123).minus(app.groups)).toBe(app.user(123))
    expect(app.users.minus(app.group(456))).toBe(app.users)
    expect(app.minus(app.users.except(123))).toBe(app.groups.plus(app.discusses).plus(app.user(123)))
    expect(app.minus(app.user(123))).toBe(app.groups.plus(app.discusses).plus(app.users.except(123)))
  })

  test('context.prototype.intersect', () => {
    expect(app.user(123, 456).intersect(app.user(456, 789))).toBe(app.user(456))
    expect(app.user(123, 456).intersect(app.users.except(456, 789))).toBe(app.user(123))
    expect(app.users.except(123, 456).intersect(app.user(456, 789))).toBe(app.user(789))
    expect(app.users.except(123, 456).intersect(app.users.except(456, 789))).toBe(app.users.except(123, 456, 789))

    expect(app.user(123).intersect(app.group(456))).toBe(app.group(456).intersect(app.user(123)))
    expect(app.user(123).intersect(app.groups.except(123))).toBe(app.groups.except(123).intersect(app.user(123)))
    expect(app.users.except(123).intersect(app.group(456))).toBe(app.group(456).intersect(app.users.except(123)))
    expect(app.users.except(123).intersect(app.groups.except(123))).toBe(app.groups.except(123).intersect(app.users.except(123)))
  })

  test('context.prototype.inverse', () => {
    expect(app.inverse()).toBe(app.user())
    expect(app.users.except(123).inverse()).toBe(app.groups.plus(app.discusses).plus(app.user(123)))
    expect(app.user(123).inverse()).toBe(app.groups.plus(app.discusses).plus(app.users.except(123)))
    expect(app.groups.plus(app.user(123)).inverse()).toBe(app.discusses.plus(app.users.except(123)))
    expect(app.discusses.plus(app.users.except(123)).inverse()).toBe(app.groups.plus(app.user(123)))
  })

  test('context.prototype.match', () => {
    const ctx = app.user(123, 456).plus(app.groups.except(123, 456))
    expect(ctx.match({ $ctxType: 'user', $ctxId: 123 })).toBe(true)
    expect(ctx.match({ $ctxType: 'user', $ctxId: 789 })).toBe(false)
    expect(ctx.match({ $ctxType: 'group', $ctxId: 123 })).toBe(false)
    expect(ctx.match({ $ctxType: 'group', $ctxId: 789 })).toBe(true)
    expect(ctx.match({ $ctxType: 'discuss', $ctxId: 123 })).toBe(false)
    expect(ctx.match({ $ctxType: 'discuss', $ctxId: 789 })).toBe(false)
  })

  test('context.prototype.contain', () => {
    const ctx = app.user(123, 456).plus(app.groups.except(123, 456))
    expect(ctx.contain(app.user(123))).toBe(true)
    expect(ctx.contain(app.user(123, 789))).toBe(false)
    expect(ctx.contain(app.group(123, 789))).toBe(false)
    expect(ctx.contain(app.group(789))).toBe(true)
    expect(ctx.contain(app.discuss(123))).toBe(false)
    expect(ctx.contain(app.discuss(789))).toBe(false)
  })
})

describe('Context API', () => {
  test('context.prototype.end', () => {
    expect(app.users.except(123).plus(app.discuss(456)).end()).toBe(app)
  })
})
