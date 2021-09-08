<template>
  <div class="k-message">
    <template v-for="({ type, data }) in segment.parse(content)">
      <span v-if="type === 'text'">{{ data.content }}</span>
      <span v-else-if="type === 'at'">@{{ data.name }}</span>
      <k-image v-else-if="type === 'image'" :src="data.url"/>
      <img class="face" v-else-if="type === 'face'" :src="data.url"/>
      <span v-else-if="segmentTypes[type]">[{{ segmentTypes[type] }}]</span>
      <span v-else>[未知]</span>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { segment } from '~/client'
import KImage from './image.vue'

defineProps<{
  content: string
}>()

const segmentTypes = {
  record: '语音',
  video: '短视频',
  image: '图片',
  music: '音乐',
  quote: '引用',
  forward: '合并转发',
  dice: '掷骰子',
  rps: '猜拳',
  poke: '戳一戳',
  json: 'JSON',
  xml: 'XML',
  share: '分享',
  location: '地点',
  card: '卡片消息',
}

</script>

<style lang="scss" scoped>

.k-message {
  white-space: break-spaces;
  line-height: 1.5;
  position: relative;

  img {
    max-height: 320px;
    max-width: 100%;
  }

  img.face {
    height: 1.25rem;
    vertical-align: middle;
  }
}

</style>
