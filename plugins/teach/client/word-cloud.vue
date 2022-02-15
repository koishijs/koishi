<template>
  <k-card class="frameless word-cloud" v-if="questions">
    <template #header>
      问答日均触发次数
      <k-button class="refresh" frameless @click="refresh">刷新</k-button>
    </template>
    <k-chart :option="option" autoresize/>
    <template #footer>
      显示的次数为实际触发次数。不考虑重定向问答和指令调用。
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { store } from '@koishijs/client'
import { computed, ref } from 'vue'

const questions = ref(store.stats.questions)

function refresh() {
  questions.value = store.stats.questions
}

const option = computed(() => ({
  tooltip: {
    show: true,
    formatter({ data }) {
      return `${data.name}<br>日均触发：${+data.value.toFixed(1)}`
    },
  },
  series: {
    type: 'wordCloud',
    data: questions.value,
  },
}))

</script>

<style lang="scss">

.word-cloud {
  .refresh {
    float: right;
    font-size: 1rem;
    padding: 0;
    min-height: 1.8rem;
  }
}

</style>
