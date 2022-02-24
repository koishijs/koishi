<template>
  <div class="k-schema-group">
    <template v-for="([key, _], index) in entries" :key="index">
      <template v-if="isObjectSchema(schema.inner)">
        <schema-item @command="handleCommand($event, index)"
          :class="{ invalid: entries.filter(e => e[0] === key).length > 1 }">
          <template #left>
            <h3>
              <span>{{ prefix }}</span>
              <el-input v-if="schema.type === 'dict'" v-model="entries[index][0]"></el-input>
              <span v-else>{{ key }}</span>
            </h3>
          </template>
          <template #menu>
            <el-dropdown-item divided :disabled="!index" command="up">上移</el-dropdown-item>
            <el-dropdown-item :disabled="index === entries.length - 1" command="down">下移</el-dropdown-item>
            <el-dropdown-item command="delete">删除</el-dropdown-item>
          </template>
        </schema-item>

        <div class="k-schema-group">
          <k-schema
            v-model="entries[index][1]"
            :initial="initial?.[key]"
            :schema="schema.inner"
            :disabled="disabled"
            :prefix="prefix + key + '.'">
            <h3>
              <span>{{ prefix + key }}</span>
            </h3>
          </k-schema>
        </div>
      </template>

      <k-schema v-else
        v-model="entries[index][1]"
        :invalid="entries.filter(e => e[0] === key).length > 1"
        :initial="initial?.[key]"
        :schema="schema.inner"
        :disabled="disabled"
        :prefix="prefix + key + '.'"
        @command="handleCommand($event, index)">
        <template #menu>
          <el-dropdown-item divided :disabled="!index" command="up">上移</el-dropdown-item>
          <el-dropdown-item :disabled="index === entries.length - 1" command="down">下移</el-dropdown-item>
          <el-dropdown-item command="delete">删除</el-dropdown-item>
        </template>
        <h3>
          <span>{{ prefix }}</span>
          <el-input v-if="schema.type === 'dict'" v-model="entries[index][0]"></el-input>
          <span v-else>{{ key }}</span>
        </h3>
      </k-schema>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { PropType, ref, watch, WatchStopHandle } from 'vue'
import { getFallback, isObjectSchema, Schema } from './utils'
import SchemaItem from './item.vue'

function handleCommand(action: string, index?: number) {
  if (action === 'down') {
    if (props.schema.type === 'dict') {
      entries.value.splice(index + 1, 0, ...entries.value.splice(index, 1))
    } else {
      const temp = entries.value[index][1]
      entries.value[index][1] = entries.value[index + 1][1]
      entries.value[index + 1][1] = temp
    }
  } else if (action === 'up') {
    if (props.schema.type === 'dict') {
      entries.value.splice(index - 1, 0, ...entries.value.splice(index, 1))
    } else {
      const temp = entries.value[index][1]
      entries.value[index][1] = entries.value[index - 1][1]
      entries.value[index - 1][1] = temp
    }
  } else if (action === 'delete') {
    entries.value.splice(index, 1)
  } else if (action === 'add') {
    entries.value.push(['', getFallback(props.schema.inner) ?? null])
  }
}

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  initial: {},
  prefix: String,
  disabled: Boolean,
  signal: Boolean,
})

const emit = defineEmits(['update:modelValue', 'update:signal'])

const entries = ref<any[]>()

let stop: WatchStopHandle

watch(() => props.modelValue, (value) => {
  stop?.()
  entries.value = Object.entries(value || {})
  stop = doWatch()
}, { immediate: true, deep: true })

watch(() => props.signal, (value) => {
  if (!value) return
  handleCommand('add')
  emit('update:signal', false)
})

function doWatch() {
  return watch(entries, () => {
    if (props.schema.type === 'dict') {
      const result = {}
      for (const [key, value] of entries.value) {
        if (key in result) return
        result[key] = value
      }
      emit('update:modelValue', result)
    } else {
      emit('update:modelValue', entries.value.map(([, value]) => value))
    }
  }, { deep: true })
}

</script>

<style lang="scss">

.schema-item h3 {
  .el-input {
    display: inline;

    input {
      width: auto;
      border: none;
      padding: 0;
      font-size: 1.125rem;
      font-weight: inherit;
      font-family: inherit;
      border-radius: 0;
    }
  }
}

</style>
