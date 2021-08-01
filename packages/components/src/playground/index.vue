<template>
  <t-layout>
    <template #page>
      <main class="playground" :style="{ backgroundColor }">
        <monaco-editor class="editor" :theme="theme" language="typescript" v-model="source"/>
        <k-chat-panel class="chat" :messages="messages" @send="handleSend"/>
      </main>
    </template>
  </t-layout>
</template>

<script lang="ts" setup>

/// <reference types="../global" />

import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useStorage } from '@vueuse/core'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import { KChatPanel } from '@koishijs/components'
import TLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'
import coreLib from 'koishi/lib/koishi.d.ts?raw'
import utilsLib from 'koishi/lib/utils.d.ts?raw'
import { Random } from '@koishijs/core'

const messages = ref<any[]>([])

const MonacoEditor = defineAsyncComponent(() => import('./MonacoEditor.vue'))
const isDarkMode = useDarkMode()
const theme = computed(() => isDarkMode.value ? 'onedark' : 'onelight')
const backgroundColor = computed(() => isDarkMode.value ? '#282C34' : '#FAFAFA')

const workerPromise = (async () => {
  const [{ languages, Uri }] = await Promise.all([
    import('monaco-editor'),
    import('./MonacoEditor.vue'),
  ])

  const { ModuleKind, ScriptTarget, typescriptDefaults, getTypeScriptWorker } = languages.typescript
  typescriptDefaults.setCompilerOptions({
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ESNext,
  })

  typescriptDefaults.addExtraLib(coreLib, 'koishi-core.d.ts')
  typescriptDefaults.addExtraLib(utilsLib, 'koishi-utils.d.ts')

  const getter = await getTypeScriptWorker()
  return getter(Uri.parse('file:///untitled.ts'))
})()

const source = useStorage('koishi.playground.source', '')
const result = ref('')

watch(source, async () => {
  if (!source.value) return
  try {
    const { outputFiles } = await (await workerPromise).getEmitOutput('file:///untitled.ts')
    result.value = outputFiles[0].text
  } catch {}
})

function handleSend(content: string) {
  messages.value.push({
    messageId: Random.id(),
    timestamp: Date.now(),
    content,
  })
}

</script>

<style lang="scss">

main.playground {
  position: fixed;
  top: 3.5rem;
  bottom: 0;
  left: 0;
  right: 0;

  .editor {
    position: absolute;
    height: 100%;
    top: 1px;
    left: 0;
    right: 50%;
  }

  .chat {
    position: absolute;
    height: 100%;
    left: 50%;
    right: 0;
  }
}

</style>
