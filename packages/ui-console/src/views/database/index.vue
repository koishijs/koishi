<template>
  <k-card-aside class="page-database">
    <template #aside>
      <el-scrollbar>
        <div class="content">
          <k-tab-group :data="meta.tables" v-model="current">数据</k-tab-group>
        </div>
      </el-scrollbar>
    </template>
    <div>
      {{ meta.tables[current] }}
    </div>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { meta } from '~/client'
import { ref } from 'vue'

const current = ref<string>('')

</script>

<style lang="scss">

.page-database {
  .content {
    padding: 1rem 0;
    line-height: 2.25rem;
  }
}

</style>
