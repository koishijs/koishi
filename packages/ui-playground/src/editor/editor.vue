<template>
  <div ref="root"></div>
</template>

<script lang="ts" setup>

import { editor, Uri } from 'monaco-editor'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

const root = ref<HTMLElement>()

const props = withDefaults(defineProps<{
  original?: string
  modelValue?: string
  theme?: string
  language?: string
  options?: {}
}>(), {
  original: '\n',
  modelValue: '\n',
  language: 'typescript',
})

const emit = defineEmits(['update:modelValue', 'update:original'])

let codeEditor: editor.IStandaloneCodeEditor
let origEditor: editor.IStandaloneCodeEditor

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
  const options: editor.IStandaloneEditorConstructionOptions = {
    fontSize: 16,
    minimap: {
      enabled: false,
    },
    padding: {
      top: 8,
      bottom: 8,
    },
    theme: props.theme,
    language: props.language,
    tabSize: 2,
    insertSpaces: true,
    automaticLayout: true,
    overviewRulerLanes: 0,
    scrollBeyondLastLine: false,
    ...props.options,
  }

  options.model = editor.createModel(props.modelValue, props.language, Uri.parse('file:///untitled.ts'))
  codeEditor = editor.create(root.value, options)

  codeEditor.onDidChangeModelContent((event) => {
    const value = codeEditor.getValue()
    if (props.modelValue !== value) {
      emit('update:modelValue', value, event)
    }
  })
})

onBeforeUnmount(() => {
  codeEditor?.dispose()
})

</script>
