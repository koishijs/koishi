<template>
  <k-card-aside class="page-database">
    <template #aside>
      <el-scrollbar>
        <div class="content">
          <div class="k-tab-group-title">表</div>
          <k-tab-item v-for="(_, key) in meta.tables" :key="key" :label="key" v-model="current"></k-tab-item>
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

.content {
  padding: 1rem 0;
  line-height: 2.25rem;
}

</style>
