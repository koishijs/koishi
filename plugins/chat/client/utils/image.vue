<template>
  <img class="k-image" :src="normalizeUrl(src)" @click="handleClick"/>
</template>

<script lang="ts" setup>

import { store } from '@koishijs/ui-console'

const props = defineProps<{ src: string }>()

function normalizeUrl(url: string) {
  if (!KOISHI_CONFIG.whitelist.some(prefix => url.startsWith(prefix))) return url
  return KOISHI_CONFIG.endpoint + '/assets/' + encodeURIComponent(url)
}

function handleClick(ev: MouseEvent) {
  ev.preventDefault()
  if (ev.metaKey) return window.open(props.src, '_blank')
  store.overlayImage = ev.target as HTMLImageElement
}

</script>
