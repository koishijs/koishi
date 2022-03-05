import { resolve } from 'path'
import { App, Session, Context, Service, Schema, Argv, Awaitable } from 'koishi'
import { Dict, segment } from '@koishijs/utils'

const app = new App()
const ctx = app
const cmd = ctx.command('koishi-docs-preserve')

// ---cut---
