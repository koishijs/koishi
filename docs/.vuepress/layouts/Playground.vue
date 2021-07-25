<template>
  <div class="theme-container no-sidebar" :class="{ 'sidebar-open': isSidebarOpen }">
    <t-navbar @toggle-sidebar="toggleSidebar">
      <template #before>
        <slot name="navbar-before" />
      </template>
      <template #after>
        <slot name="navbar-after" />
      </template>
    </t-navbar>

    <div class="sidebar-mask" @click="toggleSidebar(false)" />

    <t-sidebar>
      <template #top>
        <slot name="sidebar-top" />
      </template>
      <template #bottom>
        <slot name="sidebar-bottom" />
      </template>
    </t-sidebar>

    <main class="playground" :style="{ backgroundColor }">
      <client-only>
        <monaco-editor class="editor" :theme="theme" language="typescript"/>
      </client-only>
      <div class="chat"></div>
    </main>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'
import TNavbar from '@vuepress/theme-default/lib/client/components/Navbar.vue'
import TSidebar from '@vuepress/theme-default/lib/client/components/Sidebar.vue'
import MonacoEditor from '../components/MonacoEditor.vue'

const isSidebarOpen = ref(false)

function toggleSidebar(to?: boolean) {
  isSidebarOpen.value = typeof to === 'boolean' ? to : !isSidebarOpen.value
}

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
