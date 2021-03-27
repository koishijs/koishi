<template>
  <div class="card-grid profile-grid">
    <k-numeric title="总问题数量" icon="quote-left">{{ profile.questions }}</k-numeric>
    <k-numeric title="总问答数量" icon="quote-right">{{ profile.dialogues }}</k-numeric>
    <k-numeric title="图片服务器" icon="hdd">{{ (profile.assetSize / 1048576).toFixed(1) }} MB</k-numeric>
  </div>
  <div class="card-grid chart-grid">
    <word-cloud/>
  </div>
</template>

<script lang="ts" setup>

import { profile } from '~/client'
import WordCloud from './word-cloud.vue'

</script>

<style lang="scss">

</style>
