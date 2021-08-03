<template>
  <teleport to="body">
    <div class="menu-port">
      <template v-for="state in states">
        <menu-view v-if="state.key === 'menubar'" :state="state"/>
        <transition name="el-zoom-in-top" v-else>
          <ul v-show="state.show" class="menu-view" :ref="state.ref">
            <menu-view :state="state"/>
          </ul>
        </transition>
      </template>
    </div>
  </teleport>
</template>

<script lang="ts" setup>

import { states } from './utils'
import MenuView from './menu-view.vue'

</script>
