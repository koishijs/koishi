<template>
  <div class="k-comment" :class="type">
    <h4 class="k-comment-header"><slot name="header">{{ title }}</slot></h4>
    <slot/>
  </div>
</template>

<script lang="ts" setup>

defineProps({
  type: { type: String, default: 'default' },
  title: { type: String, required: false },
})

</script>

<style lang="scss" scoped>

.k-comment {
  padding: 1px 1.5rem !important;
  margin: 2rem 0;
  border-left-width: 4px !important;
  border-left-style: solid;
  background-color: var(--bg1);
  position: relative;
  line-height: 1.7;

  h4 {
    margin: 1rem 0;
  }

  &::before {
    content: "!";
    position: absolute;
    top: 20px;
    left: -12px;
    color: #fff;
    width: 20px;
    height: 20px;
    border-radius: 100%;
    text-align: center;
    line-height: 20px;
    font-weight: 700;
    font-family: "Dosis", "Source Sans Pro", "Helvetica Neue", Arial,sans-serif;
    font-size: 14px;
  }

  &.default {
    border-left-color: var(--active);
    &::before {
      background-color: var(--active);
    }
  }

  &.warning {
    border-left-color: var(--warning);
    &::before {
      background-color: var(--warning);
    }
  }

  &.success {
    border-left-color: var(--success);
    &::before {
      content: '√';
      background-color: var(--success);
    }
  }

  &.error {
    border-left-color: var(--error);
    &::before {
      content: '×';
      background-color: var(--error);
    }
  }

  & + & {
    margin-top: -1rem;
  }
}

</style>
