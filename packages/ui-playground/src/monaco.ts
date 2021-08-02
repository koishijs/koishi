/// <reference types="../../ui-core/src/global" />

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import coreLibrary from 'koishi/lib/koishi.d.ts?raw'
import utilsLibrary from 'koishi/lib/utils.d.ts?raw'

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

const workerPromise = (async () => {
  const { languages, Uri } = await import('monaco-editor')
  const { ModuleKind, ScriptTarget, typescriptDefaults, getTypeScriptWorker } = languages.typescript

  typescriptDefaults.setCompilerOptions({
    module: ModuleKind.CommonJS,
    target: ScriptTarget.ESNext,
  })

  typescriptDefaults.addExtraLib(coreLibrary, 'koishi-core.d.ts')
  typescriptDefaults.addExtraLib(utilsLibrary, 'koishi-utils.d.ts')

  const getter = await getTypeScriptWorker()
  return getter(Uri.parse('file:///untitled.ts'))
})()

export const filename = 'file:///untitled.ts'

export async function transpile() {
  try {
    const { outputFiles } = await (await workerPromise).getEmitOutput(filename)
    return outputFiles[0]
  } catch {}
}
