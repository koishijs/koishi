<script lang="ts">

import { defineComponent, Transition, h } from 'vue'

export default defineComponent(() => {
  return (context) => h(Transition, {
    onBeforeEnter(el: HTMLElement) {
      el.classList.add('collapse-transition')
      el.dataset.oldPaddingTop = el.style.paddingTop
      el.dataset.oldPaddingBottom = el.style.paddingBottom
      el.style.height = '0'
      el.style.paddingTop = '0'
      el.style.paddingBottom = '0'
    },
    onEnter(el: HTMLElement) {
      el.dataset.oldOverflow = el.style.overflow
      if (el.scrollHeight !== 0) {
        el.style.height = el.scrollHeight + 'px'
        el.style.paddingTop = el.dataset.oldPaddingTop
        el.style.paddingBottom = el.dataset.oldPaddingBottom
      } else {
        el.style.height = ''
        el.style.paddingTop = el.dataset.oldPaddingTop
        el.style.paddingBottom = el.dataset.oldPaddingBottom
      }
      el.style.overflow = 'hidden'
    },
    onAfterEnter(el: HTMLElement) {
      el.classList.remove('collapse-transition')
      el.style.height = ''
      el.style.overflow = el.dataset.oldOverflow
    },
    onBeforeLeave(el: HTMLElement) {
      el.dataset.oldPaddingTop = el.style.paddingTop
      el.dataset.oldPaddingBottom = el.style.paddingBottom
      el.dataset.oldOverflow = el.style.overflow
      el.style.height = el.scrollHeight + 'px'
      el.style.overflow = 'hidden'
    },
    onLeave(el: HTMLElement) {
      if (el.scrollHeight !== 0) {
        el.classList.add('collapse-transition')
        el.style.transitionProperty = 'height'
        el.style.height = '0'
        el.style.paddingTop = '0'
        el.style.paddingBottom = '0'
      }
    },
    onAfterLeave(el: HTMLElement) {
      el.classList.remove('collapse-transition')
      el.style.height = ''
      el.style.overflow = el.dataset.oldOverflow
      el.style.paddingTop = el.dataset.oldPaddingTop
      el.style.paddingBottom = el.dataset.oldPaddingBottom
    },
  }, context.$slots.default)
})

</script>

<style>

.collapse-transition {
  transition: 0.3s height ease-in-out, 0.3s padding-top ease-in-out, 0.3s padding-bottom ease-in-out;
}

</style>
