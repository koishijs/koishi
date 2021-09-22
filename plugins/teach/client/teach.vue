<template>
  <div class="card-grid profile-grid">
    <k-numeric title="总问题数量" icon="quote-left">{{ meta.questions }}</k-numeric>
    <k-numeric title="总问答数量" icon="quote-right">{{ meta.dialogues }}</k-numeric>
    <k-numeric title="图片服务器" icon="hdd" type="size" :value="meta.assetSize" fallback="暂无数据"/>
  </div>
  <div class="card-grid chart-grid">
    <word-cloud/>
  </div>
</template>

<script lang="ts" setup>

import { meta } from '@koishijs/ui-console'
import WordCloud from './word-cloud.vue'

</script>

<style lang="scss">

</style>
