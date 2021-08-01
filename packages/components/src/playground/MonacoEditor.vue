<template>
  <div ref="root"></div>
</template>

<script lang="ts" setup>

/// <reference types="../global" />

import { editor, Uri } from 'monaco-editor'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import OneDark from './onedark.yaml'
import OneLight from './onelight.yaml'

window.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

const root = ref<HTMLElement>()

const props = withDefaults(defineProps<{
  original?: string
  modelValue?: string
  theme?: string
  language?: string
  options?: {}
  diff?: boolean
}>(), {
  original: '\n',
  modelValue: '\n',
})

const emit = defineEmits(['update:modelValue', 'update:original'])

let codeEditor: editor.IStandaloneCodeEditor
let origEditor: editor.IStandaloneCodeEditor
let diffEditor: editor.IStandaloneDiffEditor

watch(() => props.options, (options) => {
  codeEditor?.updateOptions(options)
}, { deep: true })

watch(() => props.modelValue, (newValue) => {
  if (!codeEditor) return
  if (newValue !== codeEditor.getValue()) {
    codeEditor.setValue(newValue)
  }
})

watch(() => props.original, (newValue) => {
  if (!origEditor) return
  if (newValue !== origEditor.getValue()) {
    origEditor.setValue(newValue)
  }
})

watch(() => props.language, (newVal) => {
  if (!codeEditor) return
  editor.setModelLanguage(codeEditor.getModel(), newVal)
})

watch(() => props.theme, (newVal) => {
  if (codeEditor) editor.setTheme(newVal)
})

onMounted(() => {
  const options = {
    fontSize: 16,
    minimap: {
      enabled: false,
    },
    language: props.language,
    tabSize: 2,
    insertSpaces: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    ...props.options,
  }

  if (props.diff) {
    diffEditor = editor.createDiffEditor(root.value, options)
    diffEditor.setModel({
      original: editor.createModel(props.original, props.language),
      modified: editor.createModel(props.modelValue, props.language),
    })
    codeEditor = diffEditor.getModifiedEditor()
    origEditor = diffEditor.getOriginalEditor()
  } else {
    options['model'] = editor.createModel(props.modelValue, props.language, Uri.parse(`file:///untitled.ts`))
    codeEditor = editor.create(root.value, options)
  }

  codeEditor.onDidChangeModelContent((event) => {
    const value = codeEditor.getValue()
    if (props.modelValue !== value) {
      emit('update:modelValue', value, event)
    }
  })

  origEditor?.onDidChangeModelContent((event) => {
    const value = origEditor.getValue()
    if (props.original !== value) {
      emit('update:original', value, event)
    }
  })
})

onBeforeUnmount(() => {
  (diffEditor || codeEditor)?.dispose()
})

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

</script>
