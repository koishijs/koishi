import { App, Component } from 'vue'
import { ElLoading, ElMessage } from 'element-plus'
import Schema from 'schemastery'

export { Schema }

export declare const loading: typeof ElLoading['service']
export declare const message: typeof ElMessage

export namespace Icons {
  export function register(name: string, component: Component): void
}

export default function install(app: App): void
