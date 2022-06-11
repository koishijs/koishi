<template>
  <span class="link" @click.stop="configurate(name)">
    {{ name }}
  </span>
</template>

<script lang="ts" setup>

import { store } from '@koishijs/client'
import { addFavorite, gotoSettings } from '../utils'

defineProps<{
  name: string
}>()

function configurate(name: string) {
  if (store.packages[name]) {
    gotoSettings(name.replace('koishi-plugin-', '').replace('@koishijs/plugin-', ''))
  } else {
    addFavorite(name)
  }
}

</script>

<style scoped lang="scss">

</style>
