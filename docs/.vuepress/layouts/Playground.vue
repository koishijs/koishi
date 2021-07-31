<template>
  <t-layout>
    <template #main>
      <main class="playground" :style="{ backgroundColor }">
        <client-only>
          <monaco-editor class="editor" :theme="theme" language="typescript"/>
        </client-only>
        <div class="chat"></div>
      </main>
    </template>
  </t-layout>
</template>

<script lang="ts" setup>

import { ref, computed, defineAsyncComponent } from 'vue'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import TLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'

const MonacoEditor = defineAsyncComponent(() => import('../components/MonacoEditor.vue'))

const isDarkMode = useDarkMode()
const theme = computed(() => isDarkMode.value ? 'onedark' : 'onelight')
const backgroundColor = computed(() => isDarkMode.value ? '#282C34' : '#FAFAFA')

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
