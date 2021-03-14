<template>
  <section class="k-card" :class="{ frameless }">
    <header><slot name="header">{{ title }}</slot></header>
    <div class="k-card-body"><slot/></div>
  </section>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'

defineProps<{
  title: string
  frameless?: boolean
}>()

</script>

<style lang="scss" scoped>

.k-card {
  max-width: 960px;
  margin: 2rem auto;
  border-radius: 6px;
  background: rgba(0, 0, 0, .24);
  box-shadow: 0 23px 20px -20px rgb(9 10 18 / 10%), 0 0 15px rgb(9 10 18 / 6%);

  header {
    font-size: 1.25rem;
    font-weight: bolder;
    padding: 1rem 1.5rem;
  }

  .k-card-body {
    padding: 1rem;
  }

  &.frameless .k-card-body {
    padding: 0;

    p {
      margin: 1.5rem 2rem;
    }
  }

  .footer {
    border-top: 1px solid #EBEEF5;
  }
}

</style>
