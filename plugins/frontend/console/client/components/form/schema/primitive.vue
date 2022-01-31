<template>
  <div class="schema-item">
    <div class="schema-header">
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">
        <el-switch v-if="schema.type === 'boolean'" v-model="config"></el-switch>
        <template v-else>
          <k-input v-model="config"
            :style="{ width: schema.meta.role === 'url' ? '18rem' : '12rem' }"
            :type="schema.type === 'number' ? 'number' : schema.meta.role === 'secret' && !showPass ? 'password' : 'text'">
            <template #suffix v-if="schema.meta.role === 'url'">
              <a :href="config" target="_blank" rel="noopener noreferrer">
                <k-icon name="external"></k-icon>
              </a>
            </template>
            <template #suffix v-else-if="schema.meta.role === 'secret'">
              <k-icon :name="showPass ? 'eye' : 'eye-slash'" @click="showPass = !showPass"></k-icon>
            </template>
          </k-input>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { computed, PropType, ref } from 'vue'
import Schema from 'schemastery'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
})

const showPass = ref(false)

const config = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

</script>
