<template>
  <template v-if="!frameless">
    <navbar/>
    <sidebar/>
  </template>
  <main :class="{ frameless }">
    <router-view v-if="loaded"/>
  </main>
</template>

<script lang="ts" setup>

import * as client from '~/client'
import Navbar from './navbar.vue'
import Sidebar from './sidebar.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const frameless = computed(() => route.meta.frameless)
const loaded = computed(() => (route.meta.require || []).every((key) => client[key].value))

</script>

<style lang="scss">

@import '~/variables';

body {
  margin: 0;
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

a {
  color: $default;
  text-decoration: none;
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

main.frameless {
  margin: 0;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

::-webkit-scrollbar {
  height: 100%;
  width: 0.6rem;
}

::-webkit-scrollbar-thumb {
  border-radius: 0.6rem;
  background: #fff4;
  &:hover {
    background: #fff8;
  }
}

::-webkit-scrollbar-track {
  border-radius: 0.6rem;
  box-shadow: inset 0 0 6px #000b;
}

</style>
