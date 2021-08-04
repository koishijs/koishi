import { useDarkMode } from '@vuepress/theme-default/lib/client/composables'

const isDarkMode = useDarkMode()

export function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value
}

export function toggleFullScreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

export async function openFile() {
  const text = await upload('.js, .ts')
  window.editor.setValue(text)
}

export function saveFile() {
  download(window.editor.getValue(), 'untitled.ts')
}

async function upload(accept: string) {
  return new Promise<string>((resolve) => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = accept
    el.style.display = 'none'
    el.onchange = () => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.readAsText(el.files[0])
    }
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  })
}

function download(content: string, filename: string) {
  const el = document.createElement('a')
  el.download = filename
  el.style.display = 'none'
  const blob = new Blob([content])
  el.href = URL.createObjectURL(blob)
  document.body.appendChild(el)
  el.click()
  document.body.removeChild(el)
}
