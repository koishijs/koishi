<template>
  <k-card class="k-card-numeric">
    <i :class="`fas fa-${icon}`"/>
    <div class="content">
      <p class="title">{{ title }}</p>
      <p class="value"><slot/></p>
    </div>
  </k-card>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'

defineProps<{
  title: string
  icon: string
  to?: string
}>()

</script>

<style lang="scss" scoped>

.k-card-numeric {
  i {
    font-size: 2.4rem;
    padding: 0.3rem 0;
    width: 3rem;
    text-align: center;
  }

  .content {
    float: right;
    text-align: right;
  }

  p {
    margin: 0;
  }

  .value {
    font-size: 1.2rem;
    margin-top: 0.2rem;
    color: rgba(244, 244, 245, .8);
  }
}

</style>
