<template>
  <k-comment :type="fulfilled ? 'success' : required ? 'warning' : 'default'">
    <template #header>{{ required ? '必需' : '可选' }}{{ type }}：<slot name="name">{{ name }}</slot> ({{ fulfilled ? '已加载' : '未加载' }})</template>
    <slot></slot>
  </k-comment>
</template>

<script lang="ts" setup>

defineProps<{
  fulfilled: boolean
  required: boolean
  name?: any
  type: string
}>()

</script>
