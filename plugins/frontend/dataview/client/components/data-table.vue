<template>
  <div class="content-right" v-loading="state.loading">
    <div class="header">
      <span class="table-title">
        {{ name }} {{
          table.size
            ? `(${formatSize(table.size)})`
            : ''
        }}
      </span>
      <div class="operations">
        <span v-if="existChanges">
          <k-button solid :disabled="!existValidChanges" @click="onSubmitChanges">应用修改</k-button>
          <k-button solid type="error" @click="onCancelChanges">取消修改</k-button>
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
        v-for="fName in Object.keys(table.fields)"
        :sortable="existChanges ? false : 'custom'"
        :prop="fName"
        :label="fName"
        :fixed="[table.primary || []].flat().includes(fName)"
        :resizable="true"
      >
        <template #header="{ column }">
          {{ column.label }}
          <div class="insertion" @click.stop>
            <component
              :is="columnInputAttr[column.label].is"
              @click.stop
              v-model="state.newRow[column.label]"
              v-bind="columnInputAttr[column.label].attrs || {}"
              size="small"
            ></component>
          </div>
        </template>
        <template #default="scope">
          <template v-if="isCellChanged(scope, false)">
            <component
              :is="columnInputAttr[scope.column.label].is"
              v-model="state.changes[scope.$index][scope.column.label].model"
              v-bind="columnInputAttr[scope.column.label].attrs || {}"
              size="small"
            >
              <template #suffix>
                <k-button frameless type="error" @click="onCancelInput(scope)">
                  <k-icon name="times-full"></k-icon>
                </k-button>
              </template>
            </component>
          </template>
          <div v-else @parent-dblclick="onCellDblClick(scope)" class="inner-cell">
            {{
              renderCell(fName, scope)
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
      :total="table.count"
      :page-sizes="pageSizes"
      :default-page-size="pageSizes[0]"
      v-model:page-size="state.pageSize"
      :default-current-page="1"
      v-model:current-page="currPage"
      :disabled="existChanges"
    ></el-pagination>
  </div>
</template>

<script lang="ts" setup>

import { Dict } from 'koishi'
import { computed, ComputedRef, nextTick, reactive, ref, watch, watchEffect } from 'vue'
import { store } from '@koishijs/client'
import { message } from '@koishijs/client'
import { formatSize, handleError, sendQuery, timeStr } from '../utils'

export interface TableStatus {
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

const state = reactive<TableStatus>({
  loading: true,
  pageSize: undefined,
  offset: 0,
  sort: null,
  changes: {},
  newRow: {},
})

const pageSizes = [30, 50, 100, 150, 200, 500, 1000]

const props = defineProps<{
  name: string
}>()

const table = computed(() => store.dbInfo.tables[props.name])

watchEffect(() => {
  state.pageSize = state.pageSize || pageSizes[0]
})
watch(() => state.pageSize, (v) => {
  state.offset = Math.floor(state.offset / v) * v
}, {})
watch(() => table.value.fields, (v) => {
  for (const fName in table.value.fields)
    if (!(fName in state.newRow))
      state.newRow[fName] = ''
}, { immediate: true })

// used as async computed
const tableData = ref([])
async function updateData() {
  if (!props.name) return
  state.loading = true
  const querySort = state.sort && {
    [state.sort.field]: {
      ascending: 'asc' as const,
      descending: 'desc' as const
    }[state.sort.order]
  }
  const modifier = {
    offset: state.offset,
    limit: state.pageSize,
    sort: querySort,
  }
  // await new Promise((res) => setInterval(() => res(0), 1000))
  tableData.value = await sendQuery('get', props.name as never, {}, modifier)
  await nextTick()
  state.loading = false
}
watchEffect(updateData)

const currPage = computed({
  get: () => Math.floor(state.offset / state.pageSize) + 1,
  set: p => state.offset = (p - 1) * state.pageSize
})

const validChanges: ComputedRef<ChangesState> = computed(() => {
  const result = {}
  for (const i in state.changes || {}) {
    for (const field in state.changes[i]) {
      const column = columnInputAttr.value[field]
      if (column.attrs?.validate)
        if (!column.attrs.validate(state.changes[i][field].model))
          continue // skip invalid changes
      if (!result[i]) result[i] = {}
      result[i][field] = state.changes[i][field]
    }
  }
  return result
})

const existChanges = computed(() => !!Object.keys(state.changes || {}).length)
const existValidChanges = computed(() => !!Object.keys(validChanges.value || {}).length)
const newRowValid = computed(() => {
  for (const field in table.value.fields) {
    const column = columnInputAttr.value[field]
    if (column.attrs?.validate)
      if (!column.attrs.validate(state.newRow[field])) {
        console.log(field)
        return false
      }
  }
  return true
})

const columnInputAttr: ComputedRef<Dict<{
  is: 'el-input' | 'el-date-picker' | 'el-time-picker'
  attrs?: {
    type: string
    validate: Function
    step?: number
  }
}>> = computed(() => Object.keys(table.value.fields).reduce((o, fName) => {
  const fieldConfig = table.value.fields[fName]
  const dateAttrs = { clearable: false}

  let type, step
  switch (fieldConfig.type) {
    case 'time':
      return { ...o, [fName]: { is: 'el-time-picker', attrs: dateAttrs} }
    case 'date':
      return { ...o, [fName]: { is: 'el-date-picker', attrs: {...dateAttrs,  type: 'date' } } }
    case 'timestamp':
      return { ...o, [fName]: { is: 'el-date-picker', attrs: {...dateAttrs,  type: 'datetime' } } }

    case 'integer':
    case 'unsigned':
      step = 1

    case 'float':
    case 'double':
    case 'decimal':
      type = 'number'
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
        if (val < 0)
          return false
      case 'integer':
        if (val % 1 != 0) return false
        break
      case 'json':
        if (val === '') return true
        if (!(val as string).startsWith('{') || !(val as string).endsWith('}'))
          return false
        break
    }
    return true
  }

  o[fName] = { is: 'el-input', attrs: { type, validate, step } }
  return o
}, {}))

function onSort(e) {
  if (e.order === null)
    state.sort = null
  else
    state.sort = {
      field: e.prop,
      order: e.order,
    }
}

function renderCell(field: string, { row, column, $index }) {
  const fType = table.value.fields[field].type
  const data = row[field]
  switch (fType) {
    case 'json':
      return JSON.stringify(data)
    case 'date':
      if (data instanceof Date)
        return data.toJSON().slice(0, 10)
      break
    case 'time':
      if (data instanceof Date)
        return timeStr(data)
      break
    case 'timestamp':
      if (data instanceof Date)
        return `${data.toJSON().slice(0, 10)} ${timeStr(data)}`
      break
  }
  return data
}

/** convert cell data to model value */
function toModelValue(field: string, data) {
  const fType = table.value.fields[field].type
  switch (fType) {
    case 'json':
      return JSON.stringify(data)
    case 'time':
      if (typeof data !== 'string') return data
      const [h, m, s] = data.split(':')
      const time = new Date()
      time.setHours(parseInt(h), parseInt(m), parseInt(s))
      return time
  }
  return data
}

/** convert model value data to cell */
function fromModelValue(field: string, data) {
  const fType = table.value.fields[field].type
  switch (fType) {
    case 'json':
      return JSON.parse(data)
  }
  return data
}

/** Check if a table cell has pending changes */
function isCellChanged({ row, column, $index }, checkValue = true) {
  if (state.changes?.[$index]?.[column.label] === undefined) return false
  if (!checkValue) return true
  return state.changes?.[row.id]?.[column.label].model.value !== row[column.label]
}

/* Just to get $index */
function onOuterCellClick(_row, _column, element) {
  element.querySelector('.inner-cell').dispatchEvent(new Event('parent-dblclick'))
}
function onCellDblClick({ row, column, $index }) {
  if (isCellChanged({ row, column, $index }, false)) return // Change record exists
  if (state.changes[$index] === undefined)
    state.changes[$index] = {}
  state.changes[$index][column.label] = reactive({
    model: toModelValue(column.label, row[column.label]),
  })
}
/** Discard current change */
function onCancelInput({ column, $index }) {
  delete state.changes[$index][column.label]
  if (!Object.keys(state.changes[$index]).length)
    delete state.changes[$index]
}
/** Discard all changes */
function onCancelChanges() {
  state.changes = {}
}

async function onSubmitChanges() {
  state.loading = true
  const submitted: {
    idx: string
    field: string
  }[] = []
  for (const idx in validChanges.value) {
    try {
      const row = tableData.value[idx]
      const data: Dict = {}
      for (const field in validChanges.value[idx]) {
        data[field] = validChanges.value[idx][field].model
        data[field] = fromModelValue(field, data[field])
      }
      console.log('Update row: ', data)
      // await new Promise(res => setInterval(() => res(1), 1000))
      await sendQuery('set', props.name as never, row, data)

      for (const field in validChanges.value[idx])
        submitted.push({ idx, field })
    }
    catch (e) {
      handleError(e, '更新数据失败')
    }
  }

  // clear current changes
  for (const c of submitted)
    delete state.changes[c.idx][c.field]
  for (const idx in state.changes)
    if (!Object.keys(state.changes[idx]).length)
      delete state.changes[idx]
  await updateData()
  if (submitted.length)
    message.success(`成功修改 ${submitted.length} 项数据`)
  state.loading = false
}

async function onDeleteRow({ row, $index }) {
  state.loading = true
  try {
    await sendQuery('remove', props.name as never, row)
    await updateData()
    message.success(`成功删除数据`)
  } catch (e) {
    handleError(e, '数据删除失败')
  }
  state.loading = false
}

async function onInsertRow() {
  state.loading = true
  try {
    const row = Object.keys(state.newRow).reduce((o, field) => {
      if (state.newRow[field]) {
        o[field] = state.newRow[field]
        o[field] = fromModelValue(field, o[field])
      }
      return o
    }, {})
    console.log('Create row: ', row)
    await sendQuery('create', props.name as never, row)
    await updateData()
    message.success(`成功添加数据`)
    for (const field in state.newRow)
      state.newRow[field] = ''
  } catch (e) {
    handleError(e, '添加数据失败')
  }
  state.loading = false
}
</script>

<style lang="scss" scoped>

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
  .el-date-editor.el-input,
  .el-date-editor.el-input__inner {
    width: 100%;
  }
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

  .el-input {
    .k-icon {
      display: block;
    }
  }
}
</style>
