<template>
  <div ref="root"></div>
</template>

<script lang="ts" setup>

import { editor, Uri } from 'monaco-editor'
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

window.router = useRouter()

const root = ref<HTMLElement>()

const props = withDefaults(defineProps<{
  modelValue?: string
  theme?: string
  language?: string
  options?: {}
}>(), {
  modelValue: '\n',
  language: 'typescript',
})

const emit = defineEmits(['update:modelValue', 'menu'])

let codeEditor: editor.IStandaloneCodeEditor

watch(() => props.options, (options) => {
  codeEditor?.updateOptions(options)
}, { deep: true })

watch(() => props.modelValue, (newValue) => {
  if (!codeEditor) return
  if (newValue !== codeEditor.getValue()) {
    codeEditor.setValue(newValue)
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
    contextmenu: false,
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
  codeEditor = window.editor = editor.create(root.value, options)

  codeEditor.onDidChangeModelContent((event) => {
    const value = codeEditor.getValue()
    if (props.modelValue !== value) {
      emit('update:modelValue', value, event)
    }
  })

  codeEditor.onContextMenu((ev) => {
    ev.event.preventDefault()
    ev.event.stopPropagation()
    emit('menu', ev.event.browserEvent)
  })

  function createDocumentAction(id: string, label: string, command: string) {
    codeEditor.addAction({
      id,
      label,
      run() {
        if (!codeEditor) return
        if (!document.execCommand(command)) {
          codeEditor.getModel()[command]?.()
        }
      },
    })
  }

  createDocumentAction('undo', 'Undo', 'undo')
  createDocumentAction('redo', 'Redo', 'redo')
  createDocumentAction('editor.action.clipboardCutAction', 'Cut', 'cut')
  createDocumentAction('editor.action.clipboardCopyAction', 'Copy', 'copy')
  createDocumentAction('editor.action.clipboardPasteAction', 'Paste', 'paste')
})

onBeforeUnmount(() => {
  codeEditor?.dispose()
})

</script>
