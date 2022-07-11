<template>
  <el-switch v-if="schema.type === 'boolean'" v-model="value" :disabled="disabled"></el-switch>

  <template v-else-if="schema.type === 'number'">
    <el-slider v-if="schema.meta.role === 'slider'" style="width: 200px"
      v-model="value" :disabled="disabled" :max="schema.meta.max" :min="schema.meta.min" :step="schema.meta.step"
    ></el-slider>
    <el-input-number v-else
      v-model="value" :disabled="disabled" :max="schema.meta.max" :min="schema.meta.min" :step="schema.meta.step"
    ></el-input-number>
  </template>

  <el-input v-else v-model="value" :disabled="disabled"
    :style="{ width: schema.meta.role === 'url' ? '18rem' : '12rem' }" :type="type">
    <template #suffix v-if="schema.meta.role === 'url'">
      <k-icon name="external" @click="onClickExternal(value)"></k-icon>
    </template>
    <template #suffix v-else-if="schema.meta.role === 'secret'">
      <k-icon :name="showPass ? 'eye' : 'eye-slash'" @click="showPass = !showPass"></k-icon>
    </template>
  </el-input>
</template>

<script lang="ts" setup>

import { computed, PropType, ref } from 'vue'
import Schema from 'schemastery'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  schema: {} as PropType<Schema>,
  initial: {},
  modelValue: {},
  disabled: Boolean,
})

const showPass = ref(false)

const value = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

const type = computed(() => {
  const { type, meta } = props.schema
  return type === 'number' ? 'number' : meta.role === 'secret' && !showPass.value ? 'password' : 'text'
})

function onClickExternal(value: string) {
  if (!value) return
  open(value, '', 'noopener=yes,noreferrer=yes')
}

</script>

<style lang="scss">

.schema-item {
  .el-input {
    .k-icon {
      color: var(--fg3);
      transition: color 0.3s ease;
      cursor: pointer;

      &:hover {
        color: var(--fg1);
      }
    }
  }
}

</style>
