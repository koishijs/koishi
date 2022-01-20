<template>
  <div class="schema-group" v-if="desc">
    <h2>{{ desc }}</h2>
    <div class="schema-group-body">
      <slot/>
    </div>
  </div>
  <slot v-else/>
</template>

<script lang="ts" setup>

defineProps<{
  desc?: string | boolean
}>()

</script>

<style lang="scss">

.schema-group {
  h2 {
    font-size: 1.25em;
    margin: 0 0 -1.25rem;
  }
}

.schema-group-body {
  padding-left: 1.5rem;
}

</style>
