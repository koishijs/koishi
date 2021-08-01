<template>
  <t-layout>
    <template #main>
      <main class="playground" :style="{ backgroundColor }">
        <client-only>
          <monaco-editor class="editor" :theme="theme" language="typescript" v-model="source"/>
        </client-only>
        <div class="chat">{{ result }}</div>
      </main>
    </template>
  </t-layout>
</template>

<script lang="ts" setup>

import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import TLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'
import coreLib from 'koishi/lib/koishi.d.ts?raw'
import utilsLib from 'koishi/lib/utils.d.ts?raw'

const MonacoEditor = defineAsyncComponent(() => import('../components/MonacoEditor.vue'))
const isDarkMode = useDarkMode()
const theme = computed(() => isDarkMode.value ? 'onedark' : 'onelight')
const backgroundColor = computed(() => isDarkMode.value ? '#282C34' : '#FAFAFA')

const workerPromise = (async () => {
  const [{ languages, Uri }] = await Promise.all([
    import('monaco-editor'),
    import('../components/MonacoEditor.vue'),
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

const source = ref('')
const result = ref('')

watch(source, async () => {
  if (!source.value) return
  try {
    const { outputFiles } = await (await workerPromise).getEmitOutput('file:///untitled.ts')
    result.value = outputFiles[0].text
  } catch {}
})

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
