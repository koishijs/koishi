<template>
  <div class="card-grid profile-grid">
    <k-numeric title="总问题数量" icon="quote-left">{{ meta.questions }}</k-numeric>
    <k-numeric title="总问答数量" icon="quote-right">{{ meta.dialogues }}</k-numeric>
    <k-numeric title="图片服务器" icon="hdd">{{ assetSize }}</k-numeric>
  </div>
  <div class="card-grid chart-grid">
    <word-cloud/>
  </div>
</template>

<script lang="ts" setup>

import { meta } from '~/client'
import { computed } from 'vue'
import WordCloud from './word-cloud.vue'

const assetSize = computed(() => {
  if (!meta.value.assetSize) return '暂无数据'
  return (meta.value.assetSize / 1048576).toFixed(1) + ' MB'
})

</script>

<style lang="scss">

</style>
