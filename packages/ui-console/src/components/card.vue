<template>
  <section class="k-card" :class="{ scrollbar }">
    <header v-if="title || $slots.header">
      <slot name="header">{{ title }}</slot>
    </header>
    <el-scrollbar v-if="scrollbar">
      <div class="k-card-body"><slot/></div>
    </el-scrollbar>
    <div v-else class="k-card-body"><slot/></div>
    <footer v-if="$slots.footer">
      <slot name="footer"></slot>
    </footer>
  </section>
</template>

<script lang="ts" setup>

defineProps<{
  title?: string
  scrollbar?: boolean
}>()

</script>

<style lang="scss">

$paddingX: 1.25rem;
$paddingY: 1.5rem;

.k-card {
  margin: 0 auto 2rem;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  color: var(--card-fg);
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);

  header {
    font-size: 1.25rem;
    font-weight: bolder;
    padding: $paddingX $paddingY 0;
    transition: color 0.3s ease;
  }

  footer {
    padding: 0 $paddingY $paddingX;
  }

  .k-card-body {
    position: relative;
    padding: $paddingX $paddingY;
  }

  &.frameless .k-card-body {
    padding: 0;
  }

  .footer {
    border-top: 1px solid var(--border);
  }
}

</style>
