import { style, emit, store, restore, Types } from '../../utils/transition'
import {} from 'vue'

interface Props {
  direction: Types.Direction
  duration: number
  timingFunction: string
}

export default {
  functional: true,

  props: {
    direction: {
      type: String,
      default: 'vertical',
    },
    duration: {
      type: Number,
      default: 0.3,
    },
    timingFunction: {
      type: String,
      default: 'ease-in-out',
    },
  },

  render(createElement, {
    props: {
      direction,
      duration,
      timingFunction,
    },
    listeners,
    children,
  }) {
    let length: Types.Length
    let paddingEnd: Types.PaddingEnd
    let paddingStart: Types.PaddingStart
    let scrollLength: Types.ScrollLength

    if (direction === 'horizontal') {
      length = 'width'
      scrollLength = 'scrollWidth'
      paddingStart = 'paddingLeft'
      paddingEnd = 'paddingRight'
    } else {
      length = 'height'
      scrollLength = 'scrollHeight'
      paddingStart = 'paddingTop'
      paddingEnd = 'paddingBottom'
    }

    const transition = style([
      length, paddingEnd, paddingStart,
    ], duration, timingFunction)

    return createElement('transition', {
      attrs: { css: false },
      on: {
        beforeEnter(el: HTMLElement) {
          emit(listeners, 'before-enter', el)
          store(el, ['transition', paddingEnd, paddingStart])
          el.style.transition = transition
          el.style[paddingStart] = '0'
          el.style[paddingEnd] = '0'
          el.style[length] = '0'
        },
        enter(el: HTMLElement, done: Function) {
          el.dataset.overflow = el.style.overflow
          restore(el, [paddingEnd, paddingStart])
          el.style[length] = el[scrollLength] ? el[scrollLength] + 'px' : ''
          el.style.overflow = 'hidden'
          setTimeout(done, 1000 * duration)
        },
        afterEnter(el: HTMLElement) {
          el.style[length] = ''
          restore(el, ['overflow', 'transition'])
          emit(listeners, 'after-enter', el)
        },
        beforeLeave(el: HTMLElement) {
          emit(listeners, 'before-leave', el)
          store(el, ['overflow', 'transition', paddingEnd, paddingStart])
          el.style[length] = el[scrollLength] + 'px'
          el.style.overflow = 'hidden'
        },
        leave(el: HTMLElement, done: Function) {
          if (el[scrollLength] !== 0) {
            el.style.transition = transition
            el.style[length] = '0'
            el.style[paddingEnd] = '0'
            el.style[paddingStart] = '0'
          }
          setTimeout(done, 1000 * duration)
        },
        afterLeave(el: HTMLElement) {
          el.style[length] = ''
          restore(el, [paddingEnd, paddingStart, 'overflow', 'transition'])
          emit(listeners, 'after-leave', el)
        },
      },
    }, children)
  },
}
