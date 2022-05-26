<template>
  <div class="schema-item">
    <div class="actions" v-if="!disabled">
      <el-dropdown placement="bottom-start" @command="$emit('command', $event)">
        <k-icon name="cog"></k-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <slot name="menu"></slot>
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

defineEmits(['command'])

</script>

<style lang="scss">

.schema-item {
  position: relative;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  transition: var(--color-transition);

  &:first-child, :not(.schema-item):not(.k-schema-group) + & {
    border-top: 1px solid var(--border);
  }

  & + h2 {
    margin-top: 2rem;
  }

  &:hover {
    background-color: var(--hover-bg);
  }

  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    column-gap: 1rem;
    min-height: 3rem;
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
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: absolute;
    top: 0;
    height: 100%;
    left: -$actions-width;
    width: $actions-width;
    border-right: 2px solid transparent;
    transition: var(--color-transition);

    .k-icon {
      padding: 0 5px;
      cursor: pointer;
      opacity: 0;
      color: var(--disabled);
      transition: var(--color-transition);

      &:hover {
        color: var(--fg1);
      }
    }
  }

  &:hover .actions .k-icon {
    opacity: 1;
  }

  &.changed .actions {
    border-right-color: var(--primary);
  }

  &.required .actions {
    border-right-color: var(--error);
  }

  &.invalid .actions {
    border-right-color: var(--warning);
  }
}

</style>
