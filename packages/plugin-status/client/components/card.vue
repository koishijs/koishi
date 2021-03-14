<template>
  <section class="k-card">
    <header><slot name="header">{{ title }}</slot></header>
    <div class="k-card-body"><slot/></div>
  </section>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'

defineProps<{
  title?: string
}>()

</script>

<style lang="scss" scoped>

$paddingX: 1.2rem;
$paddingY: 1.6rem;

.k-card {
  max-width: 960px;
  margin: 2rem auto;
  border-radius: 6px;
  background: rgba(0, 0, 0, .24);
  box-shadow: 0 23px 20px -20px rgb(9 10 18 / 10%), 0 0 15px rgb(9 10 18 / 6%);

  header {
    font-size: 1.25rem;
    font-weight: bolder;
    padding: $paddingX $paddingY;
    transition: color 0.3s ease;
    color: rgba(244, 244, 245, .8);
  }

  .k-card-body {
    padding: 0 $paddingY $paddingX;
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
