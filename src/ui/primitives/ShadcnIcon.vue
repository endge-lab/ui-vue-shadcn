<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  EyeOff,
  GripVertical,
  Info,
  MoreHorizontal,
  Plane,
  Search,
  Settings2,
  User,
  X,
} from '@lucide/vue'
import { computed } from 'vue'

defineOptions({ name: 'EndgeShadcnIcon', inheritAttrs: false })

const props = withDefaults(defineProps<{
  name?: string
  size?: number
  strokeWidth?: number
}>(), {
  name: 'circle',
  size: 16,
  strokeWidth: 2,
})

const icons = {
  'alert': AlertTriangle,
  'alert-triangle': AlertTriangle,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'calendar': Calendar,
  'check': Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'circle': Circle,
  'clock': Clock,
  'drag': GripVertical,
  'eye-off': EyeOff,
  'grip-vertical': GripVertical,
  'info': Info,
  'menu': MoreHorizontal,
  'more-horizontal': MoreHorizontal,
  'plane': Plane,
  'search': Search,
  'settings': Settings2,
  'settings2': Settings2,
  'user': User,
  'x': X,
} as const

const normalizedName = computed(() => String(props.name || 'circle')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/[\s_]+/g, '-')
  .toLowerCase())
const icon = computed(() => icons[normalizedName.value as keyof typeof icons] ?? Circle)
</script>

<template>
  <component
    :is="icon"
    v-bind="$attrs"
    data-slot="icon"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
