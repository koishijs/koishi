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
  display: flex;
  height: calc(100vh - 4rem);
  margin: 2rem;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);
  transition: background-color 0.3s ease;

  > aside {
    overflow-x: hidden;
    overflow-y: auto;
    min-width: 16rem;
    max-width: 18rem;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    transition: border-color 0.3s ease;
  }

  > main {
    width: 100%;
  }
}

</style>
