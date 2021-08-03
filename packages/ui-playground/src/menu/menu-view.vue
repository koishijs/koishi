<template>
  <template v-if="state.key !== 'menubar'">
    <li class="menu-item" v-for="item in state.content"
      :class="{ disabled: item.key === '$separator' }">
      <div v-if="item.key === '$separator'" class="separator"/>
      <span class="label" v-else>{{ item.key }}</span>
      <span class="bind" v-if="item.bind">{{ item.bind }}</span>
    </li>
  </template>
  <transition v-if="state.children.length" name="el-zoom-in-top">
    <ul class="menu-view" :ref="state.ref">
      <template v-for="item in state.children">
        <menu-view v-if="state.active === item.key" :state="item"/>
      </template>
    </ul>
  </transition>
</template>

<script lang="ts" setup>

import type { MenuState, MenuItem } from './utils'

defineProps<{
  state: MenuState
}>()

function getCaption(item: string) {
  return item
}

function getBinding(item: string) {
  return item
}

</script>

<style lang="scss">

.menu-view {
  position: fixed;
  z-index: 1000;
  padding: 0.4rem 0;
  margin: 0;
	outline: 0;
  border: none;
  font-size: 14px;
  transition: 0.3s ease;
	list-style-type: none;
  min-width: 200px;
  user-select: none;
  cursor: default;
  color: var(--c-menu-fg);
  background-color: var(--c-menu-bg);
  box-shadow: var(--c-menu-shadow);
}

.menu-item {
  padding: 0.4rem 0.6rem;
  line-height: 1.2;

  &:not(.disabled):hover {
    color: var(--c-menu-hover-fg);
    background-color: var(--c-menu-hover-bg);
  }

  .separator {
    border-bottom: 1px solid var(--c-menu-separator);
  }

  .label {
    padding: 0 0.4rem;
  }

  .bind {
    padding: 0 0.4rem;
    float: right;
  }
}

</style>
