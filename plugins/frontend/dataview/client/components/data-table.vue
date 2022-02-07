<template v-loading="loading">
  <div class="header">
    <span class="table-title">
      {{ props.name }} {{
        props.tableStats.size
          ? `(${formatSize(props.tableStats.size)})`
          : ''
      }}
    </span>
    <div class="operations">
      <span v-if="existChanges">
        <k-button solid :disabled="!existValidChanges" @click="onSubmitChanges">应用修改</k-button>
        <el-popconfirm
          @confirm="onCancelChanges()"
          title="真的要取消所有修改吗？"
          confirm-button-text="是"
          cancel-button-text="否"
        >
          <template #reference>
            <k-button solid type="error">取消修改</k-button>
          </template>
        </el-popconfirm>
      </span>
      <span v-else>双击单元格修改数据</span>
    </div>
  </div>
  <el-table
    :data="tableData"
    class="data-table"
    style="width: 100%"
    height="100%"
    :border="true"
    :cell-class-name="({ row, column, rowIndex, columnIndex }) => isCellChanged({ row, column, $index: rowIndex }, false)
      ? 'cell-changed'
      : ''
    "
    @sort-change="onSort"
    @cell-dblclick="onOuterCellClick"
  >
    <el-table-column
      v-for="(field, fName) in props.tableModel.fields"
      :sortable="existChanges ? false : 'custom'"
      :prop="fName"
      :label="fName"
      :fixed="[props.tableModel.primary || []].flat().includes(fName)"
      :resizable="true"
    >
      <template #header="{ column }">
        {{ column.label }}
        <div class="insertion">
          <k-input
            @click.stop
            v-model="status.newRow[column.label]"
            v-bind="columnInputAttr[column.label]"
          ></k-input>
        </div>
      </template>
      <template #default="scope">
        <template v-if="isCellChanged(scope, false)">
          <k-input
            v-model="status.changes[scope.$index][scope.column.label].model"
            v-bind="columnInputAttr[scope.column.label]"
          >
            <template #suffix>
              <k-button frameless type="error" @click="onCancelInput(scope)">
                <k-icon name="times-full"></k-icon>
              </k-button>
            </template>
          </k-input>
        </template>
        <div v-else @parent-dblclick="onCellDblClick(scope)" class="inner-cell">
          {{
            field.type === 'json'
              ? JSON.stringify(scope.row[fName])
              : scope.row[fName]?.toString()
          }}
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="60" fixed="right" align="center">
      <template #header="{ column }">
        {{ column.label }}
        <div class="insertion" @click.stop>
          <k-button frameless :disabled="!newRowValid || existChanges" @click="onInsertRow">插入</k-button>
        </div>
      </template>

      <template #default="scope">
        <el-popconfirm
          @confirm="onDeleteRow(scope)"
          title="真的要删除这条数据吗？"
          confirm-button-text="是"
          cancel-button-text="否"
        >
          <template #reference>
            <k-button frameless type="error" :disabled="existChanges">
              <k-icon name="times-full"></k-icon>
            </k-button>
          </template>
        </el-popconfirm>
      </template>
    </el-table-column>
  </el-table>
  <el-pagination
    layout="total, sizes, prev, pager, next, jumper"
    :small="true"
    :total="props.tableStats.count"
    :page-sizes="props.pageSizes"
    :default-page-size="props.pageSizes[0]"
    v-model:page-size="status.pageSize"
    :default-current-page="1"
    v-model:current-page="currPage"
    :disabled="existChanges"
  ></el-pagination>
</template>

<script lang="ts" setup>

import { } from '@koishijs/plugin-console';
import { ElMessage, ElPagination, ElPopconfirm, ElTable, ElTableColumn } from 'element-plus';
import { Dict, Model, Query } from 'koishi';
import { computed, ComputedRef, reactive, ref, Ref, watchEffect, watch } from 'vue';
import { formatSize, handleError, sendFallible } from '../utils';

export type TableStatus = {
  loading: boolean
  pageSize: number
  offset: number
  sort: SortState
  changes: ChangesState
  newRow: newRowState
}

export type SortState = {
  field: string,
  order: 'ascending' | 'descending'
}
export type ChangesState = Record<number, Record<string, {
  model: any
}>> // $index => field => input model

export type newRowState = Dict<any> // field => input model

const props: Readonly<{
  name: string,
  tableModel: Model.Config<Record<string, any>>,
  tableStats: Query.TableStats,
  pageSizes: number[]
  // model values below
  mStatus: TableStatus
}> = defineProps({
  name: { required: true, type: String, },
  tableModel: { required: true },
  tableStats: {
    required: true,
    default: {} as Query.TableStats
  },
  pageSizes: {
    default: [30, 50, 100, 150, 200, 500, 1000]
  },
  mStatus: {
    required: true,
    default: undefined as TableStatus
  },
})
const emits = defineEmits([
  'update:mStatus',
])
const status = computed({
  get: () => props.mStatus,
  set: v => emits('update:mStatus', v),
})
status.value.pageSize = status.value.pageSize || props.pageSizes[0]
watch(() => status.value.pageSize, (v) => {
  console.log(status.value.newRow)
  status.value.offset = Math.floor(status.value.offset / v) * v
}, {})
watch(() => props.tableModel.fields, (v) => {
  console.log(status.value.newRow)
  for (const fName in props.tableModel.fields)
    if (!(fName in status.value.newRow)) {
      console.log(fName)
      status.value.newRow[fName] = ''
    }
}, { immediate: true })

// used as async computed
const tableData = ref([])
async function updateData() {
  if (!props.name) return
  status.value.loading = true
  const querySort = status.value.sort && {
    [status.value.sort.field]: {
      ascending: 'asc' as const,
      descending: 'desc' as const
    }[status.value.sort.order]
  }
  const modifier = {
    offset: status.value.offset,
    limit: status.value.pageSize,
    sort: querySort,
  }
  // await new Promise((res) => setInterval(() => res(0), 1000))
  tableData.value = await sendFallible<'get'>('dataview/db-get', props.name as never, {}, modifier)
  status.value.loading = false
}
watchEffect(updateData)

const currPage = computed({
  get: () => Math.floor(status.value.offset / status.value.pageSize) + 1,
  set: p => status.value.offset = (p - 1) * status.value.pageSize
})

const validChanges: ComputedRef<ChangesState> = computed(() => {
  const result = {}
  for (const i in status.value.changes || {}) {
    for (const field in status.value.changes[i]) {
      if (columnInputAttr.value[field].validate)
        if (!columnInputAttr.value[field].validate(status.value.changes[i][field].model))
          continue // skip invalid changes
      if (!result[i]) result[i] = {}
      result[i][field] = status.value.changes[i][field]
    }
  }
  return result
})

const existChanges = computed(() => !!Object.keys(status.value.changes || {}).length)
const existValidChanges = computed(() => !!Object.keys(validChanges.value || {}).length)
const newRowValid = computed(() => {
  for (const field in props.tableModel.fields) {
    if (columnInputAttr.value[field].validate)
      if (!columnInputAttr.value[field].validate(status.value.newRow[field])) {
        console.log(field)
        return false
      }
  }
  return true
})

const columnInputAttr: ComputedRef<Dict<{
  type: string
  validate: Function
  step?: number
}>> = computed(() => Object.keys(props.tableModel.fields).reduce((o, fName) => {
  const fieldConfig = props.tableModel.fields[fName]

  let type, step
  switch (fieldConfig.type) {
    case 'integer':
    case 'unsigned':
    case 'timestamp':
      step = 1

    case 'float':
    case 'double':
    case 'decimal':
      type = 'number'

      break
    case 'date':
    case 'time':
      type = fieldConfig.type
      break

    default:
      type = 'text'
      break
  }

  const validate = (val) => {
    if (fieldConfig.nullable === false && !val.length) return false
    if (type.value === 'number') val = parseFloat(val)
    switch (fieldConfig.type) {
      case 'unsigned':
      case 'timestamp':
        if (val < 0)
          return false
      case 'integer':
        if (val % 1 != 0) return false
        break
      case 'json':
        if (!(val as string).startsWith('{') || !(val as string).endsWith('}'))
          return false
        break
    }
    return true
  }

  o[fName] = { type, validate, step }
  return o
}, {}))

function onSort(e) {
  if (e.order === null)
    status.value.sort = null
  else
    status.value.sort = {
      field: e.prop,
      order: e.order,
    }
}

/** Check if a table cell has pending changes */
function isCellChanged({ row, column, $index }, checkValue = true) {
  if (status.value.changes?.[$index]?.[column.label] === undefined) return false
  if (!checkValue) return true
  return status.value.changes?.[row.id]?.[column.label].model.value !== row[column.label]
}

/* Just to get $index */
function onOuterCellClick(_row, _column, element) {
  element.querySelector('.inner-cell').dispatchEvent(new Event('parent-dblclick'))
}
function onCellDblClick({ row, column, $index }) {
  if (isCellChanged({ row, column, $index }, false)) return // Change record exists
  if (status.value.changes[$index] === undefined)
    status.value.changes[$index] = {}
  status.value.changes[$index][column.label] = reactive({
    model: row[column.label],
  })
}
/** Discard current change */
function onCancelInput({ column, $index }) {
  delete status.value.changes[$index][column.label]
  if (!Object.keys(status.value.changes[$index]).length)
    delete status.value.changes[$index]
}
/** Discard all changes */
function onCancelChanges() {
  status.value.changes = {}
}

async function onSubmitChanges() {
  status.value.loading = true
  const submitted: {
    idx: string
    field: string
  }[] = []
  for (const idx in validChanges.value) {
    const row = tableData.value[idx]
    const data: Dict = {}
    for (const field in validChanges.value[idx])
      data[field] = validChanges.value[idx][field].model
    try {
      // await new Promise(res => setInterval(() => res(1), 1000))
      await sendFallible<'set'>('dataview/db-set', props.name as never, row, data)

      for (const field in validChanges.value[idx])
        submitted.push({ idx, field })
    }
    catch (e) {
      handleError(e, '更新数据失败')
    }
  }

  // clear current changes
  for (const c of submitted)
    delete status.value.changes[c.idx][c.field]
  for (const idx in status.value.changes)
    if (!Object.keys(status.value.changes[idx]).length)
      delete status.value.changes[idx]
  await updateData()
  if (submitted.length)
    ElMessage.success(`成功修改 ${submitted.length} 项数据`)
  status.value.loading = false
}

async function onDeleteRow({ row, $index }) {
  status.value.loading = true
  try {
    await sendFallible<'remove'>('dataview/db-remove', props.name as never, row)
    await updateData()
    ElMessage.success(`成功删除数据`)
  } catch (e) {
    handleError(e, '数据删除失败')
  }
  status.value.loading = false
}

async function onInsertRow() {
  status.value.loading = true
  const row = Object.keys(status.value.newRow).reduce((o, field) => {
    o[field] = status.value.newRow[field]
    return o
  }, {})
  try {
    const res = await sendFallible<'create'>('dataview/db-create', props.name as never, row)
    if ('failed' in res) throw new Error()
    await updateData()
    ElMessage.success(`成功添加数据`)
    for (const field in status.value.newRow)
      status.value.newRow[field] = ''
  } catch (e) {
    handleError(e, '添加数据失败')
  }
  status.value.loading = false
}
</script>

<style lang="scss" scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  .table-title {
    font-weight: bold;
    font-size: 1.6em;
  }
}
.operations {
  .k-button:last-child {
    margin-right: 0;
  }
}
.insertion {
  float: left;
  width: 100%;
  margin-top: 0.5em;
}
</style>

<style lang="scss">
.data-table {
  .el-table__cell {
    padding: 4px 0;
  }
  .cell {
    word-break: keep-all;
    white-space: nowrap;
    line-height: 1.2;
  }
  .cell-changed {
    &.el-table__cell {
      padding: 2px;
    }

    .cell,
    .cell:first-child {
      padding: 0;
    }
  }

  .k-input {
    height: unset;
    .k-icon {
      display: block;
    }
    input {
      padding-left: 10px !important;
    }
  }
}
</style>
