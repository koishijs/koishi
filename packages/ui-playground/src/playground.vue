<template>
  <main ref="root" class="playground" :style="{ backgroundColor }">
    <monaco-editor
      class="container editor"
      v-model="store.source"
      :style="{ width: scale }"
      :theme="theme"
    />
    <k-chat-panel
      class="container chat"
      :messages="messages"
      :style="{ left: scale }"
      @send="handleSend"
    />
    <div class="separator" @mousedown="startDrag" :style="{ left: scale }"/>
  </main>
</template>

<script lang="ts" setup>

import { ref, computed, watch, defineAsyncComponent, onMounted, reactive } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import { KChatPanel } from '@koishijs/ui-core'
import { Random } from '@koishijs/core'
import { transpile } from './monaco'

const messages = ref<any[]>([])
const root = ref<HTMLElement>()

const MonacoEditor = defineAsyncComponent(() => import('./editor.vue'))
const isDarkMode = useDarkMode()
const theme = computed(() => isDarkMode.value ? 'onedark' : 'onelight')
const backgroundColor = computed(() => isDarkMode.value ? '#282C34' : '#FAFAFA')

interface Storage {
  source: string
  editorWidth: number
}

const defaultValue: Storage = {
  source: '',
  editorWidth: 0.5,
}

const store = reactive(defaultValue)

// Object.assign(store, {
//   ...defaultValue,
//   ...store,
// })

store.editorWidth = 0.5

const scale = computed(() => (store.editorWidth * 100) + '%')

const result = ref('')

watch(() => store.source, async () => {
  if (!store.source) return
  result.value = (await transpile()).text
})

function handleSend(content: string) {
  messages.value.push({
    messageId: Random.id(),
    timestamp: Date.now(),
    content,
  })
}

const draggingExtension = ref(false)
const draggingLastX = ref(0)

onMounted(() => {
  useEventListener(window, 'mouseup', (event) => {
    console.log(3333)
    stopDrag()
  }, { passive: true })

  useEventListener(window, 'mousemove', (event) => {
    if (!draggingExtension.value) return
    event.stopPropagation()
    // const toMax = extensionHeight.value <= this.remainHeight || draggingLastX.value < event.clientX
    // const toMin = extensionHeight.value >= 36 || draggingLastX.value > event.clientX
    // if (toMax && toMin) {
      store.editorWidth += (event.clientX - draggingLastX.value) / window.innerWidth
      console.log(store.editorWidth, scale.value)
      draggingLastX.value = event.clientX
    // }
  })
})

function startDrag(event: MouseEvent) {
  console.log(1111)
  // this.hideContextMenus()
  draggingExtension.value = true
  draggingLastX.value = event.clientX
}

function stopDrag() {
  draggingExtension.value = false
}

</script>

<style lang="scss">

main.playground {
  position: fixed;
  top: 3.5rem;
  bottom: 0;
  left: 0;
  right: 0;

  .separator {
    position: absolute;
    height: 100%;
    width: 2px;
    z-index: 100;
    cursor: ew-resize;
    background-color: var(--c-border);
  }

  .editor {
    position: absolute;
    height: 100%;
    left: 0;
  }

  .chat {
    position: absolute;
    height: 100%;
    right: 0;

    $avatarSize: 2.5rem;
    $padding: $avatarSize + 1rem;

    .successive {
      margin-top: -0.5rem;

      .timestamp {
        position: absolute;
        visibility: hidden;
        left: 0;
        width: $padding + 1rem;
        text-align: center;
        user-select: none;
      }

      &:hover {
        .timestamp {
          visibility: initial;
        }
      }
    }

    .avatar {
      position: absolute;
      margin-top: 4px;
      width: $avatarSize;
      height: $avatarSize;
      border-radius: $avatarSize;
      user-select: none;
    }

    .quote {
      position: relative;
      font-size: 0.875rem;
      margin-left: $padding;
      cursor: pointer;
      * + span {
        margin-left: 0.5rem;
      }

      &::before {
        content: '';
        display: block;
        position: absolute;
        box-sizing: border-box;
        top: 50%;
        right: 100%;
        bottom: 0;
        left: -36px;
        margin-right: 4px;
        margin-top: -1px;
        margin-left: -1px;
        margin-bottom: calc(.125rem - 4px);
        border-left: 1px solid #4f545c;
        border-top: 1px solid #4f545c;
        border-top-left-radius: 6px;
      }

      .quote-avatar {
        width: 1rem;
        height: 1rem;
        border-radius: 1rem;
        vertical-align: text-top;
      }

      .abstract {
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .header {
      margin-left: $padding;
      color: #72767d;
      * + span {
        margin-left: 0.5rem;
      }
    }

    .username {
      color: rgba(244, 244, 245, 0.8);
      font-weight: bold;
      line-height: 1.375rem;
    }

    .timestamp {
      color: #72767d;
      font-size: 0.75rem;
    }

    .k-message {
      margin-left: $padding;
    }

    p.hint {
      color: #72767d;
      margin: 0.5rem 0 -0.5rem;
    }
  }
}

</style>
