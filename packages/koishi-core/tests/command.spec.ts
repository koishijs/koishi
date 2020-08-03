import { App } from 'koishi-core'

let app: App

describe('register commands', () => {
  beforeAll(() => app = new App())

  test('constructor checks', () => {
    expect(() => app.command('')).toThrowError()
  })

  test('context.command', () => {
    app.command('a')
    app.user(10000).command('b')
    app.group(10000).command('c')

    // a, b, c, help
    expect(app._commands).toHaveLength(4)
    expect(app._commandMap.a.context).toBe(app)
    expect(app._commandMap.b.context).toBe(app.user(10000))
    expect(app._commandMap.c.context).toBe(app.group(10000))
  })

  test('call chaining', () => {
    const ctx = app.user(123)
    expect(ctx.command('temp').end()).toBe(ctx)
  })

  test('modify commands', () => {
    const d1 = app.command('d', 'foo', { authority: 1 })
    expect(app._commandMap.d.config.description).toBe('foo')
    expect(app._commandMap.d.config.authority).toBe(1)

    const d2 = app.command('d', { description: 'bar', authority: 2 })
    expect(app._commandMap.d.config.description).toBe('bar')
    expect(app._commandMap.d.config.authority).toBe(2)

    expect(d1).toBe(d2)
  })

  test('name conflicts', () => {
    expect(() => {
      app.command('e')
      app.user(10000).command('e')
    }).not.toThrow()

    expect(() => {
      const x1 = app.command('e').alias('x')
      const x2 = app.user(10000).command('x')
      expect(x1).toBe(x2)
    }).not.toThrow()

    expect(() => {
      app.command('g').alias('y')
      app.command('h').alias('y')
    }).toThrowError()

    expect(() => {
      app.command('i').alias('z')
      app.command('i').alias('z')
    }).not.toThrow()
  })

  test('remove options', () => {
    const cmd = app.command('command-with-option').option('-a, --alpha')
    expect(cmd['_optionMap'].alpha).toBeTruthy()
    expect(cmd.removeOption('a')).toBe(true)
    expect(cmd['_optionMap'].alpha).toBeFalsy()
    expect(cmd.removeOption('a')).toBe(false)
  })
})

describe('register subcommands', () => {
  beforeEach(() => app = new App())

  test('command.subcommand', () => {
    const a = app.command('a')
    const b = a.subcommand('b')
    const c = b.subcommand('.c')
    expect(a.children).toMatchObject([b])
    expect(b.name).toBe('b')
    expect(b.parent).toBe(a)
    expect(b.children).toMatchObject([c])
    expect(c.name).toBe('b.c')
    expect(c.parent).toBe(b)
  })

  test('implicit subcommands', () => {
    const a = app.command('a')
    const d = app.command('a.d')
    expect(d.name).toBe('a.d')
    expect(d.parent).toBe(a)

    const b = app.command('b')
    const e = app.command('b/e')
    expect(e.name).toBe('e')
    expect(e.parent).toBe(b)

    const f = a.subcommand('.b/f')
    expect(f.name).toBe('f')
    expect(f.parent.name).toBe('a.b')
    expect(f.parent.parent).toBe(a)

    const g = b.subcommand('c.g')
    expect(g.name).toBe('c.g')
    expect(g.parent.name).toBe('c')
    expect(g.parent.parent).toBe(b)

    const h = app.command('h')
    b.subcommand('h')
    expect(h.name).toBe('h')
    expect(h.parent).toBe(b)
  })

  test('check subcommand', () => {
    const a = app.command('a')
    const b = a.subcommand('b')
    const c = b.subcommand('c')
    const d = app.command('d')

    // register explicit subcommand
    expect(() => a.subcommand('a')).toThrowError()
    expect(() => a.subcommand('b')).not.toThrow()
    expect(() => a.subcommand('c')).toThrowError()
    expect(() => a.subcommand('d')).not.toThrow()

    // register implicit subcommand
    expect(() => app.command('b/c')).not.toThrow()
    expect(() => app.command('a/c')).toThrowError()
    expect(() => app.command('c/b')).toThrowError()
    expect(() => app.command('a/d')).not.toThrow()
  })
})
