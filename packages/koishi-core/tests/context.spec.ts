import { App, Meta } from 'koishi-core'

const app = new App()

describe('Composition API', () => {
  test('directly generated context', () => {
    expect(app.user(123, 456)).to.equal(app.user(456, 123))
    expect(app.groups.except(123, 456)).to.equal(app.groups.except(456, 123))
    expect(app.groups).to.equal(app.groups.except())
    expect(app.user()).to.equal(app.group())

    expect(app.discuss(789)).not.to.equal(app.discusses)
    expect(app.discuss(789)).not.to.equal(app.group(789))
    expect(app.discuss(789)).not.to.equal(app.discuss(123, 789))
  })

  test('context.prototype.plus', () => {
    expect(app.user(123, 456).plus(app.user(456, 789))).to.equal(app.user(123, 456, 789))
    expect(app.user(123, 456).plus(app.users.except(456, 789))).to.equal(app.users.except(789))
    expect(app.users.except(123, 456).plus(app.user(456, 789))).to.equal(app.users.except(123))
    expect(app.users.except(123, 456).plus(app.users.except(456, 789))).to.equal(app.users.except(456))

    expect(app.user(123).plus(app.group(456))).to.equal(app.group(456).plus(app.user(123)))
    expect(app.user(123).plus(app.groups.except(123))).to.equal(app.groups.except(123).plus(app.user(123)))
    expect(app.users.except(123).plus(app.group(456))).to.equal(app.group(456).plus(app.users.except(123)))
    expect(app.users.except(123).plus(app.groups.except(123))).to.equal(app.groups.except(123).plus(app.users.except(123)))
  })

  test('context.prototype.minus', () => {
    expect(app.user(123, 456).minus(app.user(456, 789))).to.equal(app.user(123))
    expect(app.user(123, 456).minus(app.users.except(456, 789))).to.equal(app.user(456))
    expect(app.users.except(123, 456).minus(app.user(456, 789))).to.equal(app.users.except(123, 456, 789))
    expect(app.users.except(123, 456).minus(app.users.except(456, 789))).to.equal(app.user(789))

    expect(app.user(123).minus(app.groups)).to.equal(app.user(123))
    expect(app.users.minus(app.group(456))).to.equal(app.users)
    expect(app.minus(app.users.except(123))).to.equal(app.groups.plus(app.discusses).plus(app.user(123)))
    expect(app.minus(app.user(123))).to.equal(app.groups.plus(app.discusses).plus(app.users.except(123)))
  })

  test('context.prototype.intersect', () => {
    expect(app.user(123, 456).intersect(app.user(456, 789))).to.equal(app.user(456))
    expect(app.user(123, 456).intersect(app.users.except(456, 789))).to.equal(app.user(123))
    expect(app.users.except(123, 456).intersect(app.user(456, 789))).to.equal(app.user(789))
    expect(app.users.except(123, 456).intersect(app.users.except(456, 789))).to.equal(app.users.except(123, 456, 789))

    expect(app.user(123).intersect(app.group(456))).to.equal(app.group(456).intersect(app.user(123)))
    expect(app.user(123).intersect(app.groups.except(123))).to.equal(app.groups.except(123).intersect(app.user(123)))
    expect(app.users.except(123).intersect(app.group(456))).to.equal(app.group(456).intersect(app.users.except(123)))
    expect(app.users.except(123).intersect(app.groups.except(123))).to.equal(app.groups.except(123).intersect(app.users.except(123)))
  })

  test('context.prototype.inverse', () => {
    expect(app.inverse()).to.equal(app.user())
    expect(app.users.except(123).inverse()).to.equal(app.groups.plus(app.discusses).plus(app.user(123)))
    expect(app.user(123).inverse()).to.equal(app.groups.plus(app.discusses).plus(app.users.except(123)))
    expect(app.groups.plus(app.user(123)).inverse()).to.equal(app.discusses.plus(app.users.except(123)))
    expect(app.discusses.plus(app.users.except(123)).inverse()).to.equal(app.groups.plus(app.user(123)))
  })

  test('context.prototype.match', () => {
    const ctx = app.user(123, 456).plus(app.groups.except(123, 456))
    expect(ctx.match(new Meta({ $ctxType: 'user', $ctxId: 123 }))).to.equal(true)
    expect(ctx.match(new Meta({ $ctxType: 'user', $ctxId: 789 }))).to.equal(false)
    expect(ctx.match(new Meta({ $ctxType: 'group', $ctxId: 123 }))).to.equal(false)
    expect(ctx.match(new Meta({ $ctxType: 'group', $ctxId: 789 }))).to.equal(true)
    expect(ctx.match(new Meta({ $ctxType: 'discuss', $ctxId: 123 }))).to.equal(false)
    expect(ctx.match(new Meta({ $ctxType: 'discuss', $ctxId: 789 }))).to.equal(false)
  })

  test('context.prototype.contain', () => {
    const ctx = app.user(123, 456).plus(app.groups.except(123, 456))
    expect(ctx.contain(app.user(123))).to.equal(true)
    expect(ctx.contain(app.user(123, 789))).to.equal(false)
    expect(ctx.contain(app.group(123, 789))).to.equal(false)
    expect(ctx.contain(app.group(789))).to.equal(true)
    expect(ctx.contain(app.discuss(123))).to.equal(false)
    expect(ctx.contain(app.discuss(789))).to.equal(false)
  })
})
