import { ref } from 'vue'
import type { Payload } from '~/server'

export const status = ref<Payload>(null)
export const socket = ref<WebSocket>(null)

export function start() {
  // eslint-disable-next-line no-undef
  socket.value = new WebSocket(KOISHI_ENDPOINT)
  receive('update', body => status.value = body)
}

export function send(data: any) {
  socket.value.send(JSON.stringify(data))
}

export function receive<T = any>(event: string, listener: (data: T) => void) {
  socket.value.onmessage = (ev) => {
    const data = JSON.parse(ev.data)
    if (data.type === event) {
      console.log(event, data.body)
      listener(data.body)
    }
  }
}
