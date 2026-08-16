<script setup lang="ts">
import type { FilterViewBuiltinProps, FilterViewRenderModel } from '@endge/core'
import type { VueShadcnFilterRendererProps } from '@/domain/types/filter-renderer.type'

import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import VueShadcnFilterField from '@/ui/filter/VueShadcnFilterField.vue'

const props = defineProps<VueShadcnFilterRendererProps>()
const model = shallowRef<FilterViewRenderModel>(props.runtime.getRenderModel())
const adapterVersion = ref(0)
const fields = computed(() => model.value.fields.filter(field => field.type !== 'Object'))
const builtinProps = computed<FilterViewBuiltinProps>(() => {
  const value = model.value.props
  return value && typeof value === 'object' ? value as FilterViewBuiltinProps : {}
})
const showLabels = computed(() => builtinProps.value.showLabels !== false)
const refresh = () => { model.value = props.runtime.getRenderModel() }
const unsubscribeAdapter = Endge.uiRegistry.subscribe(() => {
  adapterVersion.value += 1
})

function bind(runtime: VueShadcnFilterRendererProps['runtime']): void {
  runtime.on('render:change', refresh)
}

function unbind(runtime: VueShadcnFilterRendererProps['runtime']): void {
  runtime.off('render:change', refresh)
}

watch(() => props.runtime, (next, previous) => {
  if (previous) {
    unbind(previous)
    model.value = next.getRenderModel()
  }
  bind(next)
}, { immediate: true })
onBeforeUnmount(() => {
  unbind(props.runtime)
  unsubscribeAdapter()
})

async function updateField(key: string, value: unknown): Promise<void> {
  if (props.readonly)
    return
  await props.runtime.setValue(key, value)
}

function fieldLabel(key: string): string {
  const label = builtinProps.value.labels?.[key]
  return typeof label === 'string' && label.trim() ? label : key
}
</script>

<template>
  <div
    v-if="model.implementation.kind === 'generated'"
    class="endge-shadcn-filter-renderer"
    :aria-readonly="readonly === true"
    :data-adapter-version="adapterVersion"
  >
    <VueShadcnFilterField
      v-for="field in fields"
      :key="`${adapterVersion}:${field.key}`"
      :field="field"
      :label="fieldLabel(field.key)"
      :show-label="showLabels"
      :readonly="readonly"
      @update:value="updateField(field.key, $event)"
    />
  </div>
  <div v-else class="endge-shadcn-filter-renderer__unsupported">
    {{ `Пользовательский Filter view "${model.implementation.identity}" пока не подключён к renderer-у.` }}
  </div>
</template>

<style scoped>
.endge-shadcn-filter-renderer { align-items: end; display: flex; flex-wrap: wrap; gap: .75rem; min-width: 0; }
.endge-shadcn-filter-renderer__unsupported { color: var(--muted-foreground, #64748b); font-size: .875rem; }
</style>
