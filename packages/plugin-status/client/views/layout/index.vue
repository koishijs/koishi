<template>
  <template v-if="!standalone">
    <navbar/>
    <sidebar/>
  </template>
  <main :class="{ standalone }">
    <router-view v-if="status"/>
  </main>
</template>

<script lang="ts" setup>

import { status } from '~/client'
import Navbar from './navbar.vue'
import Sidebar from './sidebar.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const standalone = computed(() => route.meta.standalone)

</script>

<style lang="scss">

@import '../../index.scss';

body {
  margin: 0;
  font-size: 14px;
  min-height: 100vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: rgba(244, 244, 245, .6);
  overflow-x: hidden;
  background: radial-gradient(farthest-side ellipse at 10% 0, #333867, #17193b);
  background-attachment: fixed;
  position: relative;
}

main {
  margin: $navbarHeight 0;
  padding: 0 $mainPadding;
  position: absolute;
  bottom: 0;
  top: 0;
  right: 0;
  left: $sidebarWidth;
}

main.standalone {
  margin: 0;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

</style>
