<template>
  <k-card-aside class="page-database">
    <template #aside v-if="dbInfo?.model">
      <el-scrollbar>
        <div class="content-left">
          <div class="k-tab-group-title">
            数据
            <span v-if="dbInfo?.size">({{ formatSize(dbInfo.size) }})</span>
          </div>
          <k-tab-group :data="dbInfo.model" v-model="currTable"></k-tab-group>

          <!-- <k-tab-group :data="dbInfo.model" v-model="currTable"></k-tab-group> -->
        </div>
      </el-scrollbar>
    </template>
    <template v-if="dbInfo?.model">
      <div class="content-right" v-loading="loading">
        <k-data-table
          v-if="currTable"
          :name="currTable"
          :table-model="dbInfo.model[currTable]"
          :table-stats="dbInfo.tables[currTable]"
          v-model:m-status="currTableStatus"
        ></k-data-table>
      </div>
    </template>
    <el-empty v-else description="你还没有安装数据库支持">
      <k-button solid>安装数据库</k-button>
    </el-empty>
  </k-card-aside>
</template>

<script lang="ts" setup>

import type { } from '@koishijs/plugin-dataview';
import { Dict } from 'koishi';
import { computed, ref, Ref } from 'vue';
import { store } from '~/client';
import KDataTable, { TableStatus } from './components/data-table.vue';
import { formatSize } from './utils';

const dbInfo = computed(() => store.dbInfo)

const loading = ref(false);
const currTable = ref<string>('');
const tableStatus: Dict<Ref<TableStatus>> = {}
const tableStatusInit = () => {
  if (!tableStatus[currTable.value])
    tableStatus[currTable.value] = ref({
      loading: true,
      pageSize: undefined,
      offset: 0,
      sort: null,
      changes: {},
      newRow: {},
    })
}
const currTableStatus = computed({
  get() {
    if (!currTable.value) return
    tableStatusInit()
    return tableStatus[currTable.value].value
  },
  set(val: TableStatus) {
    if (!currTable.value) return
    tableStatusInit()
    tableStatus[currTable.value].value = val
  }
})
</script>

<style lang="scss">
.page-database {
  .content-left {
    padding: 1rem 0;
    line-height: 2.25rem;
  }
  .content-right {
    display: flex;
    gap: 1em;
    align-items: center;
    flex-direction: column;
    padding: 2rem;
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    box-sizing: border-box;
  }
}
</style>
