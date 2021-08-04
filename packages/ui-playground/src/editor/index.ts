/// <reference types="../../../ui-core/src/global" />

import { defineAsyncComponent } from 'vue'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import coreLibrary from 'koishi/lib/koishi.d.ts?raw'
import utilsLibrary from 'koishi/lib/utils.d.ts?raw'
import OneDark from './onedark.yaml'
import OneLight from './onelight.yaml'

declare global {
  interface Window {
    editor: import('monaco-editor').editor.IStandaloneCodeEditor
  }
}

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

export default defineAsyncComponent(() => import('./editor.vue'))

const workerPromise = (async () => {
  const { editor, languages, Uri } = await import('monaco-editor')
  const { ModuleKind, ScriptTarget, typescriptDefaults, getTypeScriptWorker } = languages.typescript

  editor.defineTheme('onedark', OneDark)
  editor.defineTheme('onelight', OneLight)

  if (import.meta.hot) {
    import.meta.hot.accept('./onedark.yaml', (OneDark: any) => {
      editor.defineTheme('onedark', OneDark)
    })
    import.meta.hot.accept('./onelight.yaml', (OneLight: any) => {
      editor.defineTheme('onelight', OneLight)
    })
  }

  typescriptDefaults.setCompilerOptions({
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ESNext,
  })

  typescriptDefaults.addExtraLib(coreLibrary, 'koishi-core.d.ts')
  typescriptDefaults.addExtraLib(utilsLibrary, 'koishi-utils.d.ts')

  const getter = await getTypeScriptWorker()
  return getter(Uri.parse('file:///untitled.ts'))
})()

const filename = 'file:///untitled.ts'

export async function transpile() {
  try {
    const { outputFiles } = await (await workerPromise).getEmitOutput(filename)
    return outputFiles[0]
  } catch {}
}
