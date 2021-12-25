<template>
  <template v-if="state.key !== 'menubar'">
    <li v-for="item in state.content"
      :class="getItemClass(state, item)"
      @click.stop="handleClick(item)">
      <div v-if="item.key === '$separator'" class="separator"/>
      <span class="label" v-else>{{ item.key }}</span>
      <span class="bind" v-if="getBinding(item)">{{ getBinding(item) }}</span>
    </li>
  </template>
  <ul v-if="state.children.length" class="menu-view" :ref="state.ref" v-show="state.active">
    <template v-for="item in state.children">
      <menu-view v-if="state.active === item.key" :state="item"/>
    </template>
  </ul>
</template>

<script lang="ts" setup>

import type { MenuState, MenuItem } from './utils'
import type {} from '../editor'
import { hideContextMenus } from './utils'
import * as actions from './actions'
import keymap from './keymap.yaml'

const customActions = { ...actions }

if (import.meta.hot) {
  import.meta.hot.accept('./actions', (newModule) => {
    Object.assign(customActions, newModule)
  })
}

defineProps<{ 
  state: MenuState
}>()

const getBinding = (item: MenuItem) => keymap[item.action]

const getItemClass = (state: MenuState, item: MenuItem) => ({
  'menu-item': true,
  disabled: !item.action && !item.content,
  active: item.key === state.active,
})

function getActionCallback(key: string) {
  if (key.startsWith('custom')) {
    return customActions[key.slice(7)]
  } else if (window.editor) {
    const action = window.editor.getAction(key)
    if (!action) return
    return () => {
      window.editor.focus()
      action.run()
    }
  }
}

function handleClick(item: MenuItem) {
  if (!item.action) return
  hideContextMenus()
  const action = getActionCallback(item.action)
  if (action) return action(...item.args)
  console.warn(`cannot find action "${item.action}"`)
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
	list-style-type: none;
  min-width: 240px;
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

  &.disabled {
    color: var(--c-menu-disabled);
  }

  &.active {
    color: var(--c-menu-active-fg);
    background-color: var(--c-menu-active-bg);
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
