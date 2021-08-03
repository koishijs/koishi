<template>
  <nav class="playground-navbar">
    <div class="menu-group" @contextmenu.stop>
      <div v-for="(menu, index) in data.menubar" class="menu"
        @click.stop="showMenu(menu.key, $event)"
      >
        {{ menu.key }} (<span>{{ menu.shortcut }}</span>)
      </div>
    </div>
    <div class="flex-grow"/>
    <div class="icon-group">
      <toggle-dark-mode-button/>
    </div>
  </nav>
  <menu-port/>
</template>

<script lang="ts" setup>

import ToggleDarkModeButton from '@vuepress/theme-default/lib/client/components/ToggleDarkModeButton.vue'
import MenuPort from './port.vue'
import { data, showMenu } from './utils'

</script>

<style lang="scss">

.playground-navbar {
  display: flex;
  height: 2rem;
  width: 100%;
  background-color: var(--c-bg);

  .flex-grow {
    flex-grow: 1;
  }

  .menu {
    height: 100%;
    font-size: 14px;
    line-height: $menubar-height;
    padding: 0 0.8rem;
    display: inline-block;
    user-select: none;
    cursor: default;

    &:hover {
      background-color: var(--c-bg-lightest);
    }
  }

  .icon-group {
    padding: 6px 0;
  }

  .toggle-dark-button .icon {
    width: 1.5rem;
    height: 1.5rem;
  }
}

</style>
