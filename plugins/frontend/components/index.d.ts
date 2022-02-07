import { App, Component } from 'vue'
import Schema from 'schemastery'

export { Schema }

export function registerIcon(name: string, component: Component): void

export default function install(app: App): void
