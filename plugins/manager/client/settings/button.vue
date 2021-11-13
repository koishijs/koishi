<template>
  <el-tooltip v-if="message" :content="message" :placement="placement">
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
  message: String,
  placement: { type: String, default: 'bottom' },
})

defineEmits(['click'])

</script>
