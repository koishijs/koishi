import rawData from './data.yaml'
import { ref } from 'vue'
import { useWindowSize } from '@vueuse/core'

export interface MenuItem {
  key: string
  bind?: string
  shortcut?: string
  action?: string
  content?: MenuItem[]
}

export interface MenuState extends MenuItem {}

export class MenuState {
  show = false
  active: string = null
  element: HTMLElement = null
  children: MenuState[] = []

  constructor(menu: MenuItem) {
    Object.assign(this, menu)
    for (const item of menu.content) {
      if (item.content) this.children.push(new MenuState(item))
    }
  }

  ref = (el) => {
    this.element = el
  }
}

const rawStates: Record<string, MenuState> = {}

for (const key in rawData) {
  rawStates[key] = new MenuState({
    key,
    content: rawData[key],
  })
}

export const data = rawData as Record<string, MenuItem[]>
export const states = ref(rawStates).value

const { width, height } = useWindowSize()

export function hideContextMenus() {
  menubarActive.value = false
  for (const key in states) {
    states[key].show = false
    states[key].active = null
  }
}

const top = ref(0)
const left = ref(0)

export const menubarActive = ref(false)

export function hoverNavbarMenu(key: string, event: MouseEvent) {
  if (menubarActive.value && states.menubar.active !== key) {
    showNavbarMenu(key, event)
  }
}

export function showNavbarMenu(key: string, event: MouseEvent) {
  const style = states.menubar.element.style
  if (states.menubar.active === key) {
    menubarActive.value = false
    states.menubar.active = null
    return
  }
  hideContextMenus()
  locateMenuAtButton(event, style)
  menubarActive.value = true
  states.menubar.active = key
}

export function showButtonMenu(key: string, event: MouseEvent) {
  const style = states[key].element.style
  hideContextMenus()
  locateMenuAtButton(event, style)
  states[key].show = true
}

export function showContextMenu(key: string, event: MouseEvent) {
  const style = states[key].element.style
  hideContextMenus()
  locateMenuAtClient(event, style)
  states[key].show = true
}

export function locateMenuAtClient(event: MouseEvent, style: CSSStyleDeclaration) {
  if (event.clientX + 200 > width.value) {
    style.left = event.clientX - 200 - left.value + 'px'
  } else {
    style.left = event.clientX - left.value + 'px'
  }
  if (event.clientY - top.value > height.value / 2) {
    style.top = ''
    style.bottom = top.value + height.value - event.clientY + 'px'
  } else {
    style.top = event.clientY - top.value + 'px'
    style.bottom = ''
  }
}

export function locateMenuAtButton(event: MouseEvent, style: CSSStyleDeclaration) {
  const rect = (event.currentTarget as Element).getBoundingClientRect()
  if (rect.left + 200 > width.value) {
    style.left = rect.left + rect.width - 200 - left.value + 'px'
  } else {
    style.left = rect.left - left.value + 'px'
  }
  style.top = rect.top + rect.height - top.value + 'px'
}
