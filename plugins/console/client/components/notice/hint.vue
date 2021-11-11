<template>
  <el-tooltip :placement="placement">
    <template #content>
      <div class="k-hint-content">
        <slot/>
      </div>
    </template>
    <i :class="icon" class="k-hint" @click="$emit('click', $event)"/>
  </el-tooltip>
</template>

<script lang="ts" setup>

defineProps({
  placement: String,
  icon: { type: String, default: 'far fa-question-circle' },
})

defineEmits(['click'])

</script>

<style lang="scss">

.k-hint {
  opacity: 0.5;
  color: var(--fg2);
  margin-left: 0.25rem;
  transition: 0.3s ease;

  &:hover {
    opacity: 1;
  }
}

.k-hint-content {
  line-height: 1.5;
  max-width: 20rem;
}

</style>
