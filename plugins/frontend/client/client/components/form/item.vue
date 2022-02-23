<template>
  <div class="schema-item">
    <div class="actions">
      <el-dropdown placement="bottom-start">
        <k-icon name="cog"></k-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :disabled="disabled" @click="$emit('discard')">撤销更改</el-dropdown-item>
            <el-dropdown-item :disabled="disabled" @click="$emit('default')">恢复默认值</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="header">
      <div class="left">
        <slot name="left"></slot>
      </div>
      <div class="right">
        <slot name="right"></slot>
      </div>
    </div>
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>

defineProps<{
  disabled?: boolean
}>()

defineEmits(['discard', 'default'])

</script>

<style lang="scss">

.schema-item {
  position: relative;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  border-left: 2px solid transparent;
  transition: var(--color-transition);

  &:first-child, :not(.schema-item) + & {
    border-top: 1px solid var(--border);
  }

  & + :not(.schema-item) {
    margin-top: 2rem;
  }

  &:hover {
    background-color: var(--hover-bg);
  }

  &.changed {
    border-left-color: var(--primary);
  }

  &.required {
    border-left-color: var(--error);
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    column-gap: 1rem;
  }

  .left {
    display: inline-block;
  }

  .right {
    margin: 0.5rem 0;
    float: right;
  }

  $actions-width: 3rem;

  .actions {
    position: absolute;
    text-align: center;
    padding: 0.875rem 0;
    top: 0;
    height: 100%;
    left: -$actions-width;
    width: $actions-width;
    opacity: 0;
    transition: var(--color-transition);

    .k-icon {
      padding: 0 5px;
      cursor: pointer;
      color: var(--disabled);
      transition: var(--color-transition);
    }

    .k-icon:hover {
      color: var(--fg1);
    }
  }

  &:hover .actions {
    opacity: 1;
  }
}

</style>
