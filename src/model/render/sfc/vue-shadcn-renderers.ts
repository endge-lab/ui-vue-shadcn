import type { SourceFieldOption, SourceFieldType } from '@endge/core'
import { isoToDateInput, isoToDateTimeLocalInput, timeToTimeInput } from '@endge/utils'
import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

import ShadcnCheckbox from '@/ui/primitives/ShadcnCheckbox.vue'
import ShadcnBadge from '@/ui/primitives/ShadcnBadge.vue'
import ShadcnIcon from '@/ui/primitives/ShadcnIcon.vue'
import ShadcnInput from '@/ui/primitives/ShadcnInput.vue'
import ShadcnSelect from '@/ui/primitives/ShadcnSelect.vue'
import ShadcnSeparator from '@/ui/primitives/ShadcnSeparator.vue'
import ShadcnTextarea from '@/ui/primitives/ShadcnTextarea.vue'

type SFCInputType = Extract<SourceFieldType, 'String' | 'Number' | 'Date' | 'Time' | 'DateTime'>

export const VueShadcnRender_Text: SFCVueRenderAdapterFunction = (input) => {
  const content = input.props.value == null ? input.children : String(input.props.value)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-text', 'endge-shadcn-text', input.props.class],
  }, content)
}

export const VueShadcnRender_DateTime: SFCVueRenderAdapterFunction = (input) => {
  return input.h('time', {
    ...input.attrs,
    class: ['endge-sfc-datetime', 'endge-shadcn-datetime', input.props.class],
    datetime: input.props.value == null ? undefined : String(input.props.value),
  }, formatDateTime(input.props.value, input.props.format, input.props.timezone))
}

export const VueShadcnRender_Number: SFCVueRenderAdapterFunction = (input) => {
  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-number', 'endge-shadcn-number', input.props.class],
  }, formatNumber(input.props.value, input.props))
}

export const VueShadcnRender_Icon: SFCVueRenderAdapterFunction = (input) => {
  const name = input.props.name ?? input.props.icon ?? ''
  const size = Number(input.props.size ?? 16)

  return input.h(ShadcnIcon, {
    ...input.attrs,
    class: ['endge-sfc-icon', 'endge-shadcn-icon', input.props.class],
    name: String(name),
    size: Number.isFinite(size) ? size : 16,
    'aria-label': name ? String(name) : undefined,
  })
}

export const VueShadcnRender_Badge: SFCVueRenderAdapterFunction = (input) => {
  return input.h(ShadcnBadge, {
    ...input.attrs,
    class: ['endge-sfc-badge', 'endge-shadcn-badge', input.props.class],
    tone: normalizeTone(input.props.tone),
  }, { default: () => input.children })
}

export const VueShadcnRender_Dot: SFCVueRenderAdapterFunction = (input) => {
  const size = Number(input.props.size ?? 8)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-dot', 'endge-shadcn-dot', input.props.class],
    'data-tone': normalizeTone(input.props.tone),
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      width: `${Number.isFinite(size) ? size : 8}px`,
      height: `${Number.isFinite(size) ? size : 8}px`,
    },
  })
}

export const VueShadcnRender_Box: SFCVueRenderAdapterFunction = (input) => {
  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-box', 'endge-shadcn-box', input.props.class],
  }, input.children)
}

export const VueShadcnRender_Flex: SFCVueRenderAdapterFunction = (input) => {
  const isColumn = input.props.col === true || input.props.direction === 'column'

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-flex', 'endge-shadcn-flex', input.props.class],
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      display: 'flex',
      flexDirection: isColumn ? 'column' : 'row',
      gap: normalizeGap(input.props.gap),
      alignItems: input.props.align == null ? undefined : String(input.props.align),
      justifyContent: input.props.justify == null ? undefined : String(input.props.justify),
      flexWrap: input.props.wrap === true ? 'wrap' : undefined,
    },
  }, input.children)
}

export const VueShadcnRender_Grid: SFCVueRenderAdapterFunction = (input) => {
  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-grid', 'endge-shadcn-grid', input.props.class],
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      display: 'grid',
      gridTemplateColumns: normalizeTracks(input.props.columns, 12),
      gridTemplateRows: normalizeTracks(input.props.rows),
      gridAutoRows: normalizeLength(input.props.autoRows),
      gridAutoFlow: normalizeAutoFlow(input.props.autoFlow),
      gap: normalizeGap(input.props.gap),
      columnGap: normalizeGap(input.props.columnGap),
      rowGap: normalizeGap(input.props.rowGap),
      alignItems: normalizeAlignment(input.props.align),
      justifyItems: normalizeAlignment(input.props.justify),
    },
  }, input.children)
}

export const VueShadcnRender_Divider: SFCVueRenderAdapterFunction = (input) => {
  const vertical = input.props.vertical === true || input.props.orientation === 'vertical'

  return input.h(ShadcnSeparator, {
    ...input.attrs,
    class: ['endge-sfc-divider', 'endge-shadcn-divider', input.props.class],
    orientation: vertical ? 'vertical' : 'horizontal',
    style: input.attrs.style,
  })
}

export const VueShadcnRender_Input: SFCVueRenderAdapterFunction = (input) => {
  const type = normalizeInputType(input.props.type)

  return input.h(ShadcnInput, {
    ...input.attrs,
    class: ['endge-sfc-input', 'endge-shadcn-input', input.props.class],
    type: toNativeInputType(type),
    value: normalizeInputValue(type, input.props.value),
    placeholder: toOptionalString(input.props.placeholder),
    min: input.props.min,
    max: input.props.max,
    step: input.props.step,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
}

export const VueShadcnRender_Textarea: SFCVueRenderAdapterFunction = (input) => {
  return input.h(ShadcnTextarea, {
    ...input.attrs,
    class: ['endge-sfc-textarea', 'endge-shadcn-textarea', input.props.class],
    value: input.props.value == null ? '' : String(input.props.value),
    placeholder: toOptionalString(input.props.placeholder),
    rows: input.props.rows == null ? undefined : String(input.props.rows),
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
}

export const VueShadcnRender_Checkbox: SFCVueRenderAdapterFunction = (input) => {
  return input.h(ShadcnCheckbox, {
    ...input.attrs,
    class: ['endge-sfc-checkbox-field', 'endge-shadcn-checkbox-field', input.props.class],
    checked: input.props.checked === true,
    label: toOptionalString(input.props.label),
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
}

export const VueShadcnRender_Select: SFCVueRenderAdapterFunction = (input) => {
  const multiple = input.props.multiple === true
  const options = normalizeOptions(input.props.options)
  const autoOptimize = options.length > 10

  return input.h(ShadcnSelect, {
    ...input.attrs,
    class: ['endge-sfc-select', input.props.class],
    options,
    selectedValues: normalizeSelectedValues(input.props.value, multiple),
    placeholder: toOptionalString(input.props.placeholder),
    multiple,
    searchable: typeof input.props.searchable === 'boolean' ? input.props.searchable : autoOptimize,
    virtualized: typeof input.props.virtualized === 'boolean' ? input.props.virtualized : autoOptimize,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
}

function normalizeInputType(value: unknown): SFCInputType {
  if (value === 'Number' || value === 'Date' || value === 'Time' || value === 'DateTime')
    return value

  return 'String'
}

function toNativeInputType(type: SFCInputType): string {
  if (type === 'Number') return 'number'
  if (type === 'Date') return 'date'
  if (type === 'Time') return 'time'
  if (type === 'DateTime') return 'datetime-local'
  return 'text'
}

function normalizeInputValue(type: SFCInputType, value: unknown): string | number {
  if (value == null) return ''
  if (type === 'Number') {
    if (typeof value === 'string' && value.trim() === '') return ''
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : ''
  }
  if (type === 'Date') return isoToDateInput(value)
  if (type === 'Time') return timeToTimeInput(value)
  if (type === 'DateTime') return isoToDateTimeLocalInput(value)
  return String(value)
}

function normalizeOptions(value: unknown): SourceFieldOption[] {
  if (!Array.isArray(value)) return []

  return value.filter((item): item is SourceFieldOption => {
    if (!item || typeof item !== 'object' || !Object.prototype.hasOwnProperty.call(item, 'value'))
      return false

    const optionValue = (item as SourceFieldOption).value
    return typeof optionValue === 'string' || typeof optionValue === 'number' || typeof optionValue === 'boolean'
  })
}

function normalizeSelectedValues(value: unknown, multiple: boolean): string[] {
  const values = multiple ? (Array.isArray(value) ? value : []) : [value]
  return values.filter(item => item != null).map(item => String(item))
}

function formatDateTime(value: unknown, format: unknown, timezone: unknown): string {
  if (value == null) return ''

  const text = String(value).trim()
  const timeOnly = format === 'HH:mm'
    ? text.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
    : null
  if (timeOnly)
    return `${timeOnly[1]}:${timeOnly[2]}`

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return String(value)
  const timeZone = normalizeTimezone(timezone)
  if (format === 'HH:mm') {
    return formatInTimezone(date, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }, timeZone)
  }
  if (format === 'date') return formatInTimezone(date, {}, timeZone)

  return formatInTimezone(date, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }, timeZone)
}

function normalizeTimezone(value: unknown): string | undefined {
  const timezone = String(value ?? '').trim()
  return !timezone || timezone === 'local' ? undefined : timezone
}

function formatInTimezone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date)
  }
  catch {
    return new Intl.DateTimeFormat(undefined, options).format(date)
  }
}

function formatNumber(value: unknown, props: Record<string, unknown>): string {
  if (value == null) return props.empty == null ? '' : String(props.empty)

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return String(value)
  const minimumFractionDigits = toOptionalNumber(props.minFractionDigits)
  const maximumFractionDigits = toOptionalNumber(props.maxFractionDigits ?? props.decimals)
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numberValue)

  return `${props.prefix ?? ''}${formatted}${props.suffix ?? ''}`
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

function toOptionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}

function normalizeGap(value: unknown): string | undefined {
  if (value == null || value === false) return undefined
  if (typeof value === 'number') return `${value * 4}px`

  const source = String(value).trim()
  if (source === '') return undefined
  if (/^-?\d+(\.\d+)?$/.test(source)) return `${Number(source) * 4}px`
  return source
}

function normalizeLength(value: unknown): string | undefined {
  if (value == null || value === false) return undefined
  if (typeof value === 'number') return `${value}px`

  const source = String(value).trim()
  if (source === '') return undefined
  if (/^-?\d+(\.\d+)?$/.test(source)) return `${Number(source)}px`
  return source
}

function normalizeTracks(value: unknown, fallback?: number): string | undefined {
  if (value == null || value === false || String(value).trim() === '') {
    return fallback == null ? undefined : `repeat(${fallback}, minmax(0, 1fr))`
  }

  const source = String(value).trim()
  if (/^\d+$/.test(source) && Number(source) > 0) {
    return `repeat(${Number(source)}, minmax(0, 1fr))`
  }
  return source
}

function normalizeAutoFlow(value: unknown): string | undefined {
  const source = String(value ?? '').trim()
  return ['row', 'column', 'row dense', 'column dense'].includes(source)
    ? source
    : undefined
}

function normalizeAlignment(value: unknown): string | undefined {
  const source = String(value ?? '').trim()
  return ['start', 'center', 'end', 'stretch'].includes(source)
    ? source
    : undefined
}

function normalizeTone(value: unknown): string | undefined {
  return value == null ? undefined : String(value).trim().toLowerCase()
}
