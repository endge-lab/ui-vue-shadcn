<script setup lang="ts">
import type { SourceFieldOption } from '@endge/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
} from 'vue'

defineOptions({
  name: 'EndgeShadcnSelect',
  inheritAttrs: false,
})

const props = defineProps<{
  options: SourceFieldOption[]
  selectedValues: string[]
  placeholder?: string
  multiple?: boolean
  searchable?: boolean
  virtualized?: boolean
  readonly?: boolean
  disabled?: boolean
}>()

const ROW_HEIGHT = 36
const VIEWPORT_HEIGHT = 240
const OVERSCAN = 4

const attrs = useAttrs()
const root = ref<HTMLElement | null>(null)
const hiddenSelect = ref<HTMLSelectElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const open = ref(false)
const search = ref('')
const scrollTop = ref(0)
const localValues = ref<string[]>([])
const listboxId = `endge-shadcn-select-${useId()}`
const controlAttrs = computed(() => filterAttrs(attrs, false))
const valueEventAttrs = computed(() => filterAttrs(attrs, true))
const selectedValues = computed(() => new Set(localValues.value))
const effectiveSearchable = computed(() => props.searchable ?? props.options.length > 10)
const effectiveVirtualized = computed(() => props.virtualized ?? props.options.length > 10)
const useEnhancedSelect = computed(() => props.multiple || effectiveSearchable.value || effectiveVirtualized.value)
const hasSelectedOption = computed(() => props.options.some(option => selectedValues.value.has(String(option.value))))
const filteredOptions = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) {
    return props.options
  }
  return props.options.filter((option) => {
    const value = String(option.value).toLocaleLowerCase()
    const label = String(option.label ?? option.value).toLocaleLowerCase()
    return label.includes(query) || value.includes(query)
  })
})
const virtualStart = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN))
const virtualEnd = computed(() => Math.min(
  filteredOptions.value.length,
  virtualStart.value + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2,
))
const renderedOptions = computed(() => {
  const options = effectiveVirtualized.value
    ? filteredOptions.value.slice(virtualStart.value, virtualEnd.value)
    : filteredOptions.value
  return options.map((option, offset) => ({
    option,
    index: effectiveVirtualized.value ? virtualStart.value + offset : offset,
  }))
})
const virtualHeight = computed(() => effectiveVirtualized.value
  ? filteredOptions.value.length * ROW_HEIGHT
  : undefined)
const selectedOptions = computed<SourceFieldOption[]>(() => localValues.value.map(value => (
  props.options.find(option => String(option.value) === value) ?? { value, label: value }
)))
const selectedLabels = computed(() => selectedOptions.value.map(option => option.label ?? String(option.value)))
const selectionLabel = computed(() => {
  if (!selectedLabels.value.length) {
    return props.placeholder || 'Выберите…'
  }
  if (!props.multiple || selectedLabels.value.length <= 2) {
    return selectedLabels.value.join(', ')
  }
  return `${selectedLabels.value.slice(0, 2).join(', ')} +${selectedLabels.value.length - 2}`
})

watch(() => props.selectedValues, (values) => {
  localValues.value = [...values]
}, { immediate: true })

watch(search, () => {
  scrollTop.value = 0
  if (viewport.value) {
    viewport.value.scrollTop = 0
  }
})

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFromOutside))

async function toggleOpen(): Promise<void> {
  if (props.disabled || props.readonly) {
    return
  }
  open.value = !open.value
  if (open.value && effectiveSearchable.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}

async function toggleOption(value: string): Promise<void> {
  if (props.disabled || props.readonly) {
    return
  }

  if (props.multiple) {
    const next = new Set(localValues.value)
    if (next.has(value)) {
      next.delete(value)
    }
    else { next.add(value) }
    localValues.value = props.options
      .map(option => String(option.value))
      .filter(optionValue => next.has(optionValue))
  }
  else {
    localValues.value = [value]
    close()
  }

  await nextTick()
  hiddenSelect.value?.dispatchEvent(new Event('input', { bubbles: true }))
  hiddenSelect.value?.dispatchEvent(new Event('change', { bubbles: true }))
}

function close(): void {
  open.value = false
  search.value = ''
}

function closeFromOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    close()
  }
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void toggleOpen()
  }
}

function handleScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

function optionStyle(index: number): Record<string, string> | undefined {
  if (!effectiveVirtualized.value) {
    return undefined
  }
  return {
    height: `${ROW_HEIGHT}px`,
    position: 'absolute',
    transform: `translateY(${index * ROW_HEIGHT}px)`,
  }
}

function filterAttrs(source: Record<string, unknown>, valueEvents: boolean): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source)
    .filter(([key]) => isValueEventAttr(key) === valueEvents))
}

function isValueEventAttr(key: string): boolean {
  return /^on(?:Input|Change)(?:Once|Capture|Passive)*$/.test(key)
}
</script>

<template>
  <span
    ref="root"
    class="endge-shadcn-select-field"
    :data-multiple="multiple ? '' : undefined"
    :data-open="useEnhancedSelect && open ? '' : undefined"
  >
    <select
      v-if="!useEnhancedSelect"
      v-bind="$attrs"
      class="endge-shadcn-select"
      :disabled="disabled"
      :aria-readonly="readonly ? 'true' : undefined"
    >
      <option v-if="!hasSelectedOption" value="" :disabled="placeholder != null" selected>
        {{ placeholder ?? '' }}
      </option>
      <option
        v-for="(option, index) in options"
        :key="`${index}:${String(option.value)}`"
        :value="String(option.value)"
        :selected="selectedValues.has(String(option.value))"
      >
        {{ option.label ?? String(option.value) }}
      </option>
    </select>

    <template v-else>
      <button
        v-bind="controlAttrs"
        type="button"
        class="endge-shadcn-select endge-shadcn-multiselect-trigger"
        role="combobox"
        aria-haspopup="listbox"
        :aria-controls="listboxId"
        :aria-expanded="open"
        :aria-readonly="readonly ? 'true' : undefined"
        :disabled="disabled"
        @click="toggleOpen"
        @keydown="handleTriggerKeydown"
      >
        <span class="endge-shadcn-multiselect-value" :data-placeholder="selectedLabels.length ? undefined : ''">
          {{ selectionLabel }}
        </span>
        <span v-if="multiple && selectedLabels.length" class="endge-shadcn-multiselect-count" aria-hidden="true">
          {{ selectedLabels.length }}
        </span>
        <span class="endge-shadcn-select-chevron" aria-hidden="true" />
      </button>

      <div v-if="open" class="endge-shadcn-multiselect-content" @keydown.esc.stop.prevent="close">
        <input
          v-if="effectiveSearchable"
          ref="searchInput"
          v-model="search"
          class="endge-shadcn-multiselect-search"
          type="search"
          placeholder="Поиск…"
          aria-label="Поиск по вариантам"
          @keydown.stop
          @keydown.esc.stop.prevent="close"
        >
        <div
          :id="listboxId"
          ref="viewport"
          class="endge-shadcn-multiselect-viewport"
          role="listbox"
          :aria-multiselectable="multiple ? 'true' : undefined"
          @scroll="handleScroll"
        >
          <div v-if="!filteredOptions.length" class="endge-shadcn-multiselect-empty">
            {{ options.length ? 'Ничего не найдено' : 'Нет доступных вариантов' }}
          </div>
          <div
            v-else
            class="endge-shadcn-multiselect-options"
            :style="virtualHeight == null ? undefined : { height: `${virtualHeight}px` }"
          >
            <button
              v-for="entry in renderedOptions"
              :key="`${entry.index}:${String(entry.option.value)}`"
              type="button"
              class="endge-shadcn-multiselect-option"
              role="option"
              :style="optionStyle(entry.index)"
              :aria-selected="selectedValues.has(String(entry.option.value))"
              @click="toggleOption(String(entry.option.value))"
            >
              <span class="endge-shadcn-multiselect-check" aria-hidden="true" />
              <span class="endge-shadcn-multiselect-option-label">
                {{ entry.option.label ?? String(entry.option.value) }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <select
        ref="hiddenSelect"
        v-bind="valueEventAttrs"
        class="endge-shadcn-multiselect-native"
        :multiple="multiple"
        tabindex="-1"
        aria-hidden="true"
        :disabled="disabled"
      >
        <option
          v-for="(option, index) in selectedOptions"
          :key="`${index}:${String(option.value)}`"
          :value="String(option.value)"
          selected
        >
          {{ option.label ?? String(option.value) }}
        </option>
      </select>
    </template>
  </span>
</template>
