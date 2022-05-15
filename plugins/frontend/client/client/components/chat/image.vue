<template>
  <img class="chat-image" :src="src" @click="handleClick"/>
</template>

<script lang="ts" setup>

import { shared } from './utils'

const props = defineProps<{ src: string }>()

function handleClick(ev: MouseEvent) {
  ev.preventDefault()
  if (ev.metaKey) return window.open(props.src, '_blank')
  shared.overlayImage = ev.target as HTMLImageElement
}

</script>
