<template>
  <section class="k-card-aside">
    <aside v-if="$slots.aside">
      <slot name="aside"></slot>
    </aside>
    <main>
      <slot></slot>
    </main>
  </section>
</template>

<style lang="scss">

.k-card-aside {
  height: calc(100vh - 4rem);
  margin: 0 auto 2rem;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  color: var(--card-fg);
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);
  display: flex;

  > aside {
    overflow-y: auto;
    width: 16rem;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
  }

  > main {
    width: 100%;
  }
}

</style>
