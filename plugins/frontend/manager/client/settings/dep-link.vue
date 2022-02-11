<template>
  <span class="k-dep-link" @click.stop="configurate(name)">
    {{ name }}
  </span>
</template>

<script lang="ts" setup>

import { useRouter } from 'vue-router'
import { store } from '~/client'
import { addFavorite } from '../utils'

defineProps<{
  name: string
}>()

const router = useRouter()

function configurate(name: string) {
  addFavorite(name)
  if (store.packages[name]) {
    router.push('/settings/' + name)
  } else {
    router.push('/market?keyword=' + name)
  }
}

</script>

<style scoped lang="scss">

.k-dep-link {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

</style>
