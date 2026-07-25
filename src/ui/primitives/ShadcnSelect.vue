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
  readonly?: boolean
  disabled?: boolean
}>()

const attrs = useAttrs()
const root = ref<HTMLElement | null>(null)
const hiddenSelect = ref<HTMLSelectElement | null>(null)
const open = ref(false)
const localValues = ref<string[]>([])
const listboxId = `endge-shadcn-multiselect-${useId()}`
const multiSelectControlAttrs = computed(() => filterAttrs(attrs, false))
const multiSelectValueEventAttrs = computed(() => filterAttrs(attrs, true))
const selectedValues = computed(() => new Set(props.multiple ? localValues.value : props.selectedValues))
const hasSelectedOption = computed(() => props.options.some(option => selectedValues.value.has(String(option.value))))
const selectedLabels = computed(() => props.options
  .filter(option => selectedValues.value.has(String(option.value)))
  .map(option => option.label ?? String(option.value)))
const selectionLabel = computed(() => {
  if (!selectedLabels.value.length)
    return props.placeholder || 'Выберите…'
  if (selectedLabels.value.length <= 2)
    return selectedLabels.value.join(', ')
  return `${selectedLabels.value.slice(0, 2).join(', ')} +${selectedLabels.value.length - 2}`
})

watch(() => props.selectedValues, (values) => {
  localValues.value = [...values]
}, { immediate: true })

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeFromOutside))

function toggleOpen(): void {
  if (props.disabled || props.readonly)
    return
  open.value = !open.value
}

async function toggleOption(value: string): Promise<void> {
  if (props.disabled || props.readonly)
    return

  const next = new Set(localValues.value)
  if (next.has(value))
    next.delete(value)
  else
    next.add(value)
  localValues.value = props.options
    .map(option => String(option.value))
    .filter(optionValue => next.has(optionValue))

  await nextTick()
  hiddenSelect.value?.dispatchEvent(new Event('change', { bubbles: true }))
}

function close(): void {
  open.value = false
}

function closeFromOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node))
    close()
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!props.disabled && !props.readonly)
      open.value = true
  }
}

function filterAttrs(
  source: Record<string, unknown>,
  valueEvents: boolean,
): Record<string, unknown> {
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
    :data-open="multiple && open ? '' : undefined"
  >
    <select
      v-if="!multiple"
      v-bind="$attrs"
      class="endge-shadcn-select"
      :disabled="disabled"
      :aria-readonly="readonly ? 'true' : undefined"
    >
      <option
        v-if="!hasSelectedOption"
        value=""
        :disabled="placeholder != null"
        selected
      >
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
        v-bind="multiSelectControlAttrs"
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
        <span
          class="endge-shadcn-multiselect-value"
          :data-placeholder="selectedLabels.length ? undefined : ''"
        >
          {{ selectionLabel }}
        </span>
        <span
          v-if="selectedLabels.length"
          class="endge-shadcn-multiselect-count"
          aria-hidden="true"
        >
          {{ selectedLabels.length }}
        </span>
        <span class="endge-shadcn-select-chevron" aria-hidden="true" />
      </button>

      <div
        v-if="open"
        :id="listboxId"
        class="endge-shadcn-multiselect-content"
        role="listbox"
        aria-multiselectable="true"
        @keydown.esc.stop.prevent="close"
      >
        <div v-if="!options.length" class="endge-shadcn-multiselect-empty">
          Нет доступных вариантов
        </div>
        <button
          v-for="(option, index) in options"
          v-else
          :key="`${index}:${String(option.value)}`"
          type="button"
          class="endge-shadcn-multiselect-option"
          role="option"
          :aria-selected="selectedValues.has(String(option.value))"
          @click="toggleOption(String(option.value))"
        >
          <span class="endge-shadcn-multiselect-check" aria-hidden="true" />
          <span class="endge-shadcn-multiselect-option-label">
            {{ option.label ?? String(option.value) }}
          </span>
        </button>
      </div>

      <select
        ref="hiddenSelect"
        v-bind="multiSelectValueEventAttrs"
        class="endge-shadcn-multiselect-native"
        multiple
        tabindex="-1"
        aria-hidden="true"
        :disabled="disabled"
      >
        <option
          v-for="(option, index) in options"
          :key="`${index}:${String(option.value)}`"
          :value="String(option.value)"
          :selected="selectedValues.has(String(option.value))"
        >
          {{ option.label ?? String(option.value) }}
        </option>
      </select>
    </template>
  </span>
</template>
