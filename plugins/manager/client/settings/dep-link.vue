<template>
  <span class="k-dep-link" @click.stop="$router.replace({ query: { name } })">
    {{ name }}
  </span>
</template>

<script lang="ts" setup>

defineProps<{
  name: string | number
}>()

</script>

<style scoped lang="scss">

.k-dep-link {
  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

</style>
