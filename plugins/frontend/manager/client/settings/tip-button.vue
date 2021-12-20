<template>
  <el-tooltip v-if="tip || $slots.content" :placement="placement">
    <template #content><slot name="content">{{ tip }}</slot></template>
    <k-button solid disabled @click="$emit('click', $event)">
      <slot></slot>
    </k-button>
  </el-tooltip>
  <k-button v-else solid @click="$emit('click', $event)">
    <slot></slot>
  </k-button>
</template>

<script lang="ts" setup>

defineProps({
  tip: String,
  placement: { type: String, default: 'bottom' },
})

defineEmits(['click'])

</script>
