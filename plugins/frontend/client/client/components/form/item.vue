<template>
  <div class="schema-item">
    <div class="actions"></div>
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

</script>

<style lang="scss" scoped>

.schema-item {
  position: relative;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid var(--border);
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

  .actions {
    position: absolute;
    top: 0;
    height: 100%;
    left: -10px;
    width: 10px;
    transition: var(--color-transition);
  }

  &.required .actions {
    border-right: 2px solid var(--error);
  }

  &.changed .actions {
    border-right: 2px solid var(--primary);
  }
}

</style>
