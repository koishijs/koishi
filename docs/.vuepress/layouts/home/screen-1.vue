<template>
  <div class="screen flex screen-1">
    <h1><span class="koi">Koi</span>shi.js</h1>
    <p class="desc">
      CROSS-PLATFORM CHATBOT FRAMEWORK
      <br>
      MADE WITH <span class="koi">LOVE</span>
    </p>
    <div class="actions">
      <router-link class="action-button primary" to="/guide/introduction/template">Get Started</router-link>
      <a class="action-button secondary" @click="$emit('scroll-screen', 1)">Learn More</a>
    </div>
    <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" class="w-10 h-10">
      <g>
        <path fill="var(--c-love)" d="M160 256.14l-56.51 56.47-96.44-96.15a23.77 23.77.0 01-.18-33.61l.18-.18 22.59-22.51a23.94 23.94.0 0133.85.0z"></path>
        <path fill="currentcolor" d="M313 182.57 290.21 160a23.94 23.94.0 00-33.85.0L103.47 312.61 143 352l.06.06a24 24 0 0033.93-.16L313 216.36l.18-.17a23.78 23.78.0 00-.18-33.62z"></path>
      </g>
    </svg>
  </div>
</template>

<script lang="ts" setup>

defineEmits(['scroll-screen'])

</script>

<style lang="scss" scoped>

.screen-1 {
  h1 {
    font-size: 3rem;
  }

  svg {
    position: absolute;
    opacity: 60%;
    bottom: 1.5rem;
    width: 1.5rem;
    animation: bounce 1s infinite;
  }

  .desc {
    color: var(--c-text-lightest);
    text-transform: uppercase;
    text-align: center;
    line-height: 2;

     br {
      @media (min-width: 600px) {
        display: none;
      }
    }
  }

  .actions {
    margin: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 2.2rem;
    justify-content: center;

    @media (max-width: 600px) {
      margin: 4rem 0 0 0;
      flex-direction: column;
    }

    .action-button {
      display: inline-block;
      font-size: 1.05rem;
      line-height: 1.4;
      padding: 0.5rem 2.2rem;
      border-width: 2px;
      border-style: solid;
      border-radius: 2rem;
      transition: background-color var(--t-color), border-color var(--t-color);
      box-sizing: border-box;
      cursor: pointer;

      @media (max-width: 600px) {
        padding: 0.5rem 4rem;
      }

      &.primary {
        color: var(--c-bg);
        background-color: var(--c-brand);
        border-color: var(--c-brand);
        &:hover {
          background-color: var(--c-brand-light);
          border-color: var(--c-brand-light);
        }
      }

      &.secondary {
        color: var(--c-brand);
        border-color: var(--c-brand);
        &:hover {
          color: var(--c-bg);
          background-color: var(--c-brand);
        }
      }
    }
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(-50%);
    animation-timing-function: cubic-bezier(.8, 0, 1, 1);
  }

  50% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0, .2, 1);
  }
}

</style>
