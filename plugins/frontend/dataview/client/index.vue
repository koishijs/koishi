<template>
  <k-card-aside class="page-database">
    <template #aside v-if="tables">
      <el-scrollbar>
        <div class="content">
          <div class="k-tab-group-title">数据</div>
          <k-tab-group :data="tables" v-model="current"></k-tab-group>
        </div>
      </el-scrollbar>
    </template>
    <div v-if="tables">
      {{ tables[current] }}
    </div>
    <el-empty v-else description="你还没有安装数据库支持">
      <k-button solid>安装数据库</k-button>
    </el-empty>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import type {} from '@koishijs/plugin-dataview/src'
import { ref, computed } from 'vue'

const current = ref<string>('')
const tables = computed(() => store.tables)

</script>

<style lang="scss">

.page-database {
  .content {
    padding: 1rem 0;
    line-height: 2.25rem;
  }
}

</style>
