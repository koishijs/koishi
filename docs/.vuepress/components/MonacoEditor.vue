<template>
  <div ref="root"></div>
</template>

<script lang="ts" setup>

import { editor as monaco } from 'monaco-editor'
import { ref, watch, onMounted, onBeforeUnmount, defineProps, defineEmit, withDefaults } from 'vue'
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

const emit = defineEmit(['update:modelValue', 'update:original'])

let codeEditor: monaco.IStandaloneCodeEditor
let origEditor: monaco.IStandaloneCodeEditor
let diffEditor: monaco.IStandaloneDiffEditor

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
  monaco.setModelLanguage(codeEditor.getModel(), newVal)
})

watch(() => props.theme, (newVal) => {
  if (codeEditor) monaco.setTheme(newVal)
})

onMounted(() => {
  const options = {
    fontSize: 16,
    minimap: {
      enabled: false,
    },
    value: props.modelValue,
    theme: props.theme,
    language: props.language,
    tabSize: 2,
    insertSpaces: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    ...props.options,
  }

  if (props.diff) {
    diffEditor = monaco.createDiffEditor(root.value, options)
    diffEditor.setModel({
      original: monaco.createModel(props.original, props.language),
      modified: monaco.createModel(props.modelValue, props.language),
    })
    codeEditor = diffEditor.getModifiedEditor()
    origEditor = diffEditor.getOriginalEditor()
  } else {
    codeEditor = monaco.create(root.value, options)
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

monaco.defineTheme('onedark', OneDark)
monaco.defineTheme('onelight', OneLight)

if (import.meta.hot) {
  import.meta.hot.accept('./onedark.yaml', (OneDark) => {
    monaco.defineTheme('onedark', OneDark)
  })
  import.meta.hot.accept('./onelight.yaml', (OneDark) => {
    monaco.defineTheme('onelight', OneLight)
  })
}

</script>
