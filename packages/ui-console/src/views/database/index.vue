<template>
  <k-card-aside class="page-database">
    <template #aside v-if="meta.tables">
      <el-scrollbar>
        <div class="content">
          <k-tab-group :data="meta.tables" v-model="current">数据</k-tab-group>
        </div>
      </el-scrollbar>
    </template>
    <div v-if="meta.tables">
      {{ meta.tables[current] }}
    </div>
    <el-empty v-else description="你还没有安装数据库支持">
      <k-button solid>安装数据库</k-button>
    </el-empty>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { ElEmpty } from 'element-plus'
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
