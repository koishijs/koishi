<template>
  <navbar/>
  <main class="playground" :style="{ backgroundColor }" @click="hideContextMenus" @contextmenu="hideContextMenus">
    <monaco-editor
      class="container editor"
      v-model="store.source"
      :style="{ width: scale }"
      :theme="theme"
      @menu="showContextMenu('editor', $event)"
    />
    <k-chat-panel
      class="container chat"
      :messages="messages"
      :style="{ left: scale }"
      @send="handleSend"
      @item:menu="handleItemMenu"
    />
    <div class="separator" @mousedown="startDrag" :class="{ active: isDragging }" :style="{ left: scale }"/>
  </main>
</template>

<script lang="ts" setup>

import { ref, computed, watch, onMounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import { KChatPanel, useStorage } from '@koishijs/ui-core'
import { Random } from '@koishijs/core'
import Navbar, { showContextMenu, hideContextMenus } from './menu'
import MonacoEditor, { transpile } from './editor'

const messages = ref<any[]>([])
const isDarkMode = useDarkMode()
const theme = computed(() => isDarkMode.value ? 'onedark' : 'onelight')
const backgroundColor = computed(() => isDarkMode.value ? '#282C34' : '#FAFAFA')

interface Storage {
  source: string
  editorWidth: number
}

const store = useStorage<Storage>('koishi.playground', {
  source: '',
  editorWidth: 0.5,
}).value

const scale = computed(() => (store.editorWidth * 100) + '%')

const result = ref('')

watch(() => store.source, async () => {
  if (!store.source) return
  result.value = (await transpile())?.text
})

function handleSend(content: string) {
  messages.value.push({
    messageId: Random.id(),
    timestamp: Date.now(),
    username: 'Alice',
    content,
  })
}

function handleItemMenu(item: any, event: MouseEvent) {
  showContextMenu('message', event)
}

const isDragging = ref(false)
const lastX = ref(0)

onMounted(() => {
  isDarkMode.value = true

  useEventListener(window, 'mouseup', (event) => {
    stopDrag()
  }, { passive: true })

  useEventListener(window, 'mousemove', (event) => {
    if (!isDragging.value) return
    const deltaX = event.clientX - lastX.value
    if (!deltaX) return
    const isValid = deltaX > 0
      ? window.innerWidth * (1 - store.editorWidth) >= 400
      : window.innerWidth * store.editorWidth >= 400
    if (isValid) {
      store.editorWidth += (event.clientX - lastX.value) / window.innerWidth
      lastX.value = event.clientX
    }
  })
})

function startDrag(event: MouseEvent) {
  // this.hideContextMenus()
  isDragging.value = true
  lastX.value = event.clientX
}

function stopDrag() {
  isDragging.value = false
}

</script>

<style lang="scss">

main.playground {
  position: fixed;
  top: 2rem;
  bottom: 0;
  left: 0;
  right: 0;

  .separator {
    position: absolute;
    height: 100%;
    width: 1px;
    z-index: 100;
    cursor: ew-resize;
    background-color: var(--c-border-darker);

    &:hover {
      width: 1.5px;
      background-color: var(--c-border-active);
      transition: background-color 0.3s ease;
    }

    &.active {
      width: 1.5px;
      background-color: var(--c-border-active);
      transition: background-color 0.3s ease;
    }
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
  }
}

</style>
