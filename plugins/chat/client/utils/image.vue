<template>
  <img class="k-image" :src="normalizeUrl(src)" @click="handleClick"/>
</template>

<script lang="ts" setup>

import { shared } from '.'

const props = defineProps<{ src: string }>()

function normalizeUrl(url: string) {
  if (!KOISHI_CONFIG.whitelist.some(prefix => url.startsWith(prefix))) return url
  return KOISHI_CONFIG.endpoint + '/assets/' + encodeURIComponent(url)
}

function handleClick(ev: MouseEvent) {
  ev.preventDefault()
  if (ev.metaKey) return window.open(props.src, '_blank')
  shared.overlayImage = ev.target as HTMLImageElement
}

</script>
