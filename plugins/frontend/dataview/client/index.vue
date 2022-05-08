<template>
  <k-card-aside class="page-database">
    <template #aside>
      <el-scrollbar class="content-left">
        <div class="k-tab-group-title">
          数据库
          <span v-if="store.dbInfo?.size">({{ formatSize(store.dbInfo.size) }})</span>
        </div>
        <k-tab-group :data="store.dbInfo.tables" v-model="current"></k-tab-group>
      </el-scrollbar>
    </template>
    <keep-alive>
      <k-empty v-if="!current">
        <div>在左侧选择要访问的数据表</div>
      </k-empty>
      <table-view v-else :key="current" :name="current"></table-view>
    </keep-alive>
  </k-card-aside>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { router, store } from '@koishijs/client'
import { formatSize } from './utils'
import TableView from './components/data-table.vue'

function join(source: string | string[]) {
  return Array.isArray(source) ? source.join('/') : source || ''
}

const route = useRoute()

const current = computed<string>({
  get() {
    const name = join(route.params.name)
    return store.dbInfo.tables[name] ? name : ''
  },
  set(name) {
    if (!store.dbInfo.tables[name]) name = ''
    router.replace('/database/' + name)
  },
})

</script>

<style lang="scss">

.page-database aside .el-scrollbar__view {
  padding: 1rem 0;
  line-height: 2.25rem;
}

</style>
