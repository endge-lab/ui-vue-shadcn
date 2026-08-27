<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import { Check, GripVertical, Settings2 } from '@lucide/vue'
import Sortable from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineOptions({ name: 'EndgeShadcnTableColumnManager' })

const props = defineProps<{
  table: Table<Record<string, unknown>>
}>()

const root = ref<HTMLElement | null>(null)
const sortableRef = ref<HTMLElement | null>(null)
const open = ref(false)
const orderList = ref<string[]>([])
let sortable: Sortable | null = null

const leafColumns = computed(() => props.table.getAllLeafColumns())
const hideableColumns = computed(() => leafColumns.value.filter(column => column.getCanHide()))

watch(
  () => props.table.getState().columnOrder,
  () => syncOrder(),
  { deep: true, immediate: true },
)
watch(sortableRef, () => mountSortable())

onMounted(() => document.addEventListener('pointerdown', closeFromOutside))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeFromOutside)
  sortable?.destroy()
})

function syncOrder(): void {
  const current = props.table.getState().columnOrder
  const known = leafColumns.value.map(column => column.id)
  orderList.value = current.length
    ? [...current.filter(id => known.includes(id)), ...known.filter(id => !current.includes(id))]
    : known
}

async function toggle(): Promise<void> {
  open.value = !open.value
  if (open.value) {
    syncOrder()
    await nextTick()
    mountSortable()
  }
}

function mountSortable(): void {
  sortable?.destroy()
  sortable = null
  if (!sortableRef.value) {
    return
  }

  sortable = Sortable.create(sortableRef.value, {
    animation: 160,
    handle: '[data-drag-handle]',
    ghostClass: 'endge-shadcn-table-column-manager__ghost',
    chosenClass: 'endge-shadcn-table-column-manager__chosen',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) {
        return
      }
      const next = [...orderList.value]
      const [moved] = next.splice(oldIndex, 1)
      if (!moved) {
        return
      }
      next.splice(newIndex, 0, moved)
      orderList.value = next
      props.table.setColumnOrder(next)
    },
  })
}

function closeFromOutside(event: PointerEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) {
    open.value = false
  }
}

function title(id: string): string {
  const column = props.table.getColumn(id)
  return String((column?.columnDef.meta as any)?.title ?? id)
}
</script>

<template>
  <div ref="root" class="endge-shadcn-table-column-manager">
    <button
      type="button"
      class="endge-shadcn-button endge-shadcn-button--outline endge-shadcn-table-column-manager__trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <Settings2 :size="15" />
      <span>Колонки</span>
    </button>

    <section v-if="open" class="endge-shadcn-table-column-manager__popover" aria-label="Настройка колонок">
      <div class="endge-shadcn-table-column-manager__section">
        <div class="endge-shadcn-table-column-manager__label">
          Видимость
        </div>
        <button
          v-for="column in hideableColumns"
          :key="column.id"
          type="button"
          class="endge-shadcn-table-column-manager__visibility"
          role="checkbox"
          :aria-checked="column.getIsVisible()"
          @click="column.toggleVisibility()"
        >
          <span class="endge-shadcn-table-column-manager__check" :data-checked="column.getIsVisible() ? '' : undefined">
            <Check v-if="column.getIsVisible()" :size="12" />
          </span>
          <span>{{ title(column.id) }}</span>
        </button>
      </div>

      <div class="endge-shadcn-table-column-manager__separator" />

      <div class="endge-shadcn-table-column-manager__section">
        <div class="endge-shadcn-table-column-manager__label">
          Порядок
        </div>
        <div ref="sortableRef" class="endge-shadcn-table-column-manager__order">
          <div v-for="id in orderList" :key="id" class="endge-shadcn-table-column-manager__item">
            <button type="button" data-drag-handle class="endge-shadcn-table-column-manager__drag" :aria-label="`Переместить ${title(id)}`">
              <GripVertical :size="15" />
            </button>
            <span>{{ title(id) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
