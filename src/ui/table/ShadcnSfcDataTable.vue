<script setup lang="ts">
import type {
  Cell,
  Column,
  ColumnDef,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  PaginationState,
  Row,
  SortingState,
  Updater,
  VisibilityState,
} from '@tanstack/vue-table'
import type { VirtualItem } from '@tanstack/vue-virtual'
import type {
  ComponentSFCTableColumnPinStateItem,
  ComponentSFCTableSortStateItem,
  ComponentSFCEventRuntimeSource,
  ContextMenuDescriptor,
  RuntimeBoundaryPatch,
  TableColumnActionContext,
  TableRowActionContext,
  TableColumnPinSide,
  TableRuntimeActionTarget,
  TableEventMap,
  TableEventName,
  TableSortDirection,
} from '@endge/core'
import type { CSSProperties } from 'vue'
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Filter,
} from '@lucide/vue'
import { TABLE_RUNTIME_ACTION_IDS } from '@endge/core'
import {
  decorateSFCTableRowWindow,
  getSFCTableCellStyleSurfaces,
  SFC_TABLE_ROW_CLASS_FIELD,
} from '@/ui/render/sfc/SFCRender_TableStyle'
import { SFCVueBoundaryRegistryKey } from '@/ui/render/sfc/SFCRender_BoundaryRegistry'
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue'

import type { EndgeShadcnTableColumn, EndgeShadcnTableProps } from './table.types'
import {
  closeShadcnMenu,
  elementMenuAnchor,
  openShadcnMenu,
  pointMenuAnchor,
} from '@/ui/overlay/shadcn-menu-manager'
import ShadcnInput from '@/ui/primitives/ShadcnInput.vue'
import VueShadcnFilterRenderer from '@/ui/filter/VueShadcnFilterRenderer.vue'
import ShadcnTableColumnManager from './ShadcnTableColumnManager.vue'
import { ShadcnTableRuntimeContextKey } from './shadcn-table-runtime-context'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { readSFCObjectPath } from '@/ui/render/sfc/SFCRender_Evaluator'
import { resolveSFCTableMenu } from '@/model/render/sfc/resolve-sfc-table-menu'

defineOptions({ name: 'EndgeShadcnSfcDataTable' })

const props = withDefaults(defineProps<EndgeShadcnTableProps>(), {
  columns: () => [],
  source: () => [],
  eventBindings: () => [],
  defaultSort: () => [],
  defaultPin: () => [],
  defaultHidden: () => [],
  rowSize: 40,
  paging: 'pages',
  pageSize: 10,
  pageSizes: () => [10, 25, 50, 100],
  lazy: false,
  selectionMode: 'none',
  selectionTrigger: 'auto',
  rowMenu: () => ({ mode: 'none', menu: null, diagnostics: [] }),
})
const SELECTION_COLUMN_ID = '__endge_selection__'
const tableColumns = computed<EndgeShadcnTableColumn[]>(() => Array.isArray(props.columns) ? props.columns : [])
const defaultSortItems = computed<ComponentSFCTableSortStateItem[]>(() => Array.isArray(props.defaultSort) ? props.defaultSort : [])
const defaultPinItems = computed<ComponentSFCTableColumnPinStateItem[]>(() => Array.isArray(props.defaultPin) ? props.defaultPin : [])
const defaultHiddenKeys = computed<string[]>(() => Array.isArray(props.defaultHidden) ? props.defaultHidden : [])
const pageSizeItems = computed<number[]>(() => Array.isArray(props.pageSizes) ? props.pageSizes : [10, 25, 50, 100])
const runtimeEventBindings = computed(() => Array.isArray(props.eventBindings) ? props.eventBindings : [])
const boundaryRegistry = inject(SFCVueBoundaryRegistryKey, null)
const runtimeContext = inject(ShadcnTableRuntimeContextKey, null)
const showSearch = computed(() => runtimeContext?.showSearch.value === true)
const filterRuntime = computed(() => runtimeContext?.filterRuntime.value ?? null)
const showFilters = computed(() => (
  runtimeContext?.showFilters.value === true
  && filterRuntime.value != null
))
const showRuntimeControls = computed(() => showSearch.value || showFilters.value)
const filtersVisible = computed(() => runtimeContext?.filtersVisible.value === true)
const scrollRoot = ref<HTMLElement | null>(null)
const baseRows = shallowRef(copyRows(props.source))

const tableStateKey = computed(() => props.tableId ? `table:${props.tableId}` : null)
const sorting = ref<SortingState>(readInitialSorting())
const columnPinning = ref<ColumnPinningState>(readInitialPinning())
const columnOrder = ref<ColumnOrderState>(readTableArrayState('order', tableColumns.value.map(column => column.key)))
const columnVisibility = ref<VisibilityState>(readInitialVisibility())
const columnSizing = ref<ColumnSizingState>(readTableRecordState('sizing', {}))
const pagination = ref<PaginationState>(readInitialPagination())
const selectedRowIds = shallowRef<Set<string>>(new Set())
const selectionAnchorId = ref<string | null>(null)
const resolvedSelectionTrigger = computed(() => props.selectionTrigger === 'auto' ? 'row' : props.selectionTrigger)
const showSelectionControl = computed(() => props.selectionMode !== 'none'
  && (resolvedSelectionTrigger.value === 'control' || resolvedSelectionTrigger.value === 'both'))
const selectOnRow = computed(() => props.selectionMode !== 'none'
  && (resolvedSelectionTrigger.value === 'row' || resolvedSelectionTrigger.value === 'both'))
const resolvedColumnOrder = computed<ColumnOrderState>(() => showSelectionControl.value
  ? [SELECTION_COLUMN_ID, ...columnOrder.value.filter(key => key !== SELECTION_COLUMN_ID)]
  : columnOrder.value.filter(key => key !== SELECTION_COLUMN_ID))
let columnSizeTimer: ReturnType<typeof setTimeout> | null = null
const columnDefinitions = computed<ColumnDef<Record<string, unknown>>[]>(() => [
  ...(showSelectionControl.value
    ? [{
        id: SELECTION_COLUMN_ID,
        header: '',
        size: 44,
        minSize: 44,
        maxSize: 44,
        enableHiding: false,
        enablePinning: false,
        enableSorting: false,
        enableResizing: false,
      } satisfies ColumnDef<Record<string, unknown>>]
    : []),
  ...tableColumns.value.map(column => ({
    id: column.key,
    accessorFn: (row: Record<string, unknown>) => row[column.key],
    header: column.title,
    size: column.width ?? 150,
    minSize: column.minWidth,
    maxSize: column.maxWidth,
    enableHiding: true,
    enablePinning: props.pinMode !== 'disabled' && column.pinnable,
    enableSorting: props.sortMode !== 'disabled' && column.sort?.sortable === true,
    sortingFn: (
      left: Row<Record<string, unknown>>,
      right: Row<Record<string, unknown>>,
    ) => compareRows(left.original, right.original, column),
    cell: ({ row }: { row: Row<Record<string, unknown>> }) => renderTableCell(column, row),
    meta: {
      title: column.title,
      endgeColumn: column,
    },
  })),
])

const table = useVueTable({
  get data() { return baseRows.value },
  get columns() { return columnDefinitions.value },
  getRowId: (row, index) => normalizeRowId(row[props.rowKey], index),
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  enableMultiSort: props.sortMode === 'multiple',
  enableSortingRemoval: props.sortMode !== 'fixed',
  isMultiSortEvent: () => props.sortMode === 'multiple',
  columnResizeMode: 'onChange',
  state: {
    get sorting() { return sorting.value },
    get columnPinning() { return columnPinning.value },
    get columnOrder() { return resolvedColumnOrder.value },
    get columnVisibility() { return columnVisibility.value },
    get columnSizing() { return columnSizing.value },
    get pagination() { return pagination.value },
  },
  onSortingChange: updater => updateSorting(updater),
  onColumnPinningChange: updater => updatePinning(updater),
  onColumnOrderChange: updater => updateColumnOrder(updater),
  onColumnVisibilityChange: updater => updateColumnVisibility(updater),
  onColumnSizingChange: updater => updateColumnSizing(updater),
  onPaginationChange: updatePagination,
})

const flatHeaders = computed(() => {
  void resolvedColumnOrder.value
  void columnVisibility.value
  void columnPinning.value
  return table.getFlatHeaders()
})

const stableCells = new WeakMap<
  Row<Record<string, unknown>>,
  Map<string, Cell<Record<string, unknown>, unknown>>
>()

/**
 * Сохраняет Cell context при чистой перестановке колонок, чтобы не рендерить
 * повторно всё SFC-содержимое строки.
 */
function getStableVisibleCells(
  row: Row<Record<string, unknown>>,
): Cell<Record<string, unknown>, unknown>[] {
  void resolvedColumnOrder.value
  void columnVisibility.value
  void columnPinning.value

  let rowCells = stableCells.get(row)
  if (!rowCells) {
    rowCells = new Map()
    stableCells.set(row, rowCells)
  }

  return row.getVisibleCells().map((cell) => {
    const cached = rowCells.get(cell.column.id)
    if (cached?.column === cell.column)
      return cached

    rowCells.set(cell.column.id, cell)
    return cell
  })
}

const tableRows = computed(() => props.paging === 'virtual'
  ? table.getPrePaginationRowModel().rows
  : table.getRowModel().rows)
const visibleRowIds = computed(() => tableRows.value.map(row => row.id))
const allVisibleRowsSelected = computed(() => visibleRowIds.value.length > 0
  && visibleRowIds.value.every(rowId => selectedRowIds.value.has(rowId)))
const someVisibleRowsSelected = computed(() => !allVisibleRowsSelected.value
  && visibleRowIds.value.some(rowId => selectedRowIds.value.has(rowId)))
const totalRowCount = computed(() => table.getPrePaginationRowModel().rows.length)
const pageCount = computed(() => Math.max(1, table.getPageCount()))
const currentPage = computed(() => Math.min(pagination.value.pageIndex + 1, pageCount.value))
const pageSizeOptions = computed(() => [...new Set([...pageSizeItems.value, pagination.value.pageSize])]
  .filter(size => Number.isFinite(size) && size > 0)
  .sort((left, right) => left - right))
const pageOffset = computed(() => props.paging === 'pages'
  ? pagination.value.pageIndex * pagination.value.pageSize
  : 0)
const rowVirtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>(computed(() => ({
  count: tableRows.value.length,
  estimateSize: () => props.rowSize,
  getItemKey: index => tableRows.value[index]?.id ?? index,
  getScrollElement: () => scrollRoot.value,
  initialRect: { width: 0, height: Math.max(360, props.rowSize * 10) },
  overscan: 10,
})))
const virtualItems = computed(() => rowVirtualizer.value.getVirtualItems())
const virtualRows = computed<VirtualTableRow[]>(() => {
  const items = virtualItems.value
  if (items.length === 0) return []

  const rows = items
    .map(item => tableRows.value[item.index])
    .filter((row): row is Row<Record<string, unknown>> => row != null)
  const styledRows = decorateSFCTableRowWindow(
    rows.map(row => row.original),
    tableColumns.value.length,
    props.styleContract,
    pageOffset.value + items[0]!.index,
    totalRowCount.value,
  )

  return rows.map((row, index) => ({
    virtualItem: items[index]!,
    row,
    styledRow: styledRows[index] ?? row.original,
    rowIndex: pageOffset.value + items[index]!.index,
  }))
})

function updateSearchValue(event: Event): void {
  if (!runtimeContext)
    return

  runtimeContext.searchValue.value = (event.target as HTMLInputElement).value
}

function toggleFilters(): void {
  if (!runtimeContext)
    return

  runtimeContext.filtersVisible.value = !runtimeContext.filtersVisible.value
}

const virtualRowContexts = computed(() => new Map(
  virtualRows.value.map(entry => [entry.row.id, entry] as const),
))
const virtualBodyHeight = computed(() => tableRows.value.length === 0 ? 96 : rowVirtualizer.value.getTotalSize())
const visibleColumnCount = computed(() => Math.max(1, table.getVisibleLeafColumns().length))
const tableWidth = computed(() => {
  columnSizing.value
  columnVisibility.value
  return `${table.getTotalSize()}px`
})

interface VirtualTableRow {
  virtualItem: VirtualItem
  row: Row<Record<string, unknown>>
  styledRow: Record<string, unknown>
  rowIndex: number
}

const defaultColumnMenu: ContextMenuDescriptor = {
  kind: 'context-menu',
  items: [
    menuItem(TABLE_RUNTIME_ACTION_IDS.sortSetColumnAsc, 'Sort ascending', 'arrow-up'),
    menuItem(TABLE_RUNTIME_ACTION_IDS.sortSetColumnDesc, 'Sort descending', 'arrow-down'),
    { kind: 'separator', id: 'sort-visibility-separator' },
    menuItem(TABLE_RUNTIME_ACTION_IDS.columnHide, 'Hide', 'eye-off'),
  ],
}

const tableActionTarget: TableRuntimeActionTarget = {
  setColumnVisibility: async (columnKey, visible) => {
    table.getColumn(columnKey)?.toggleVisibility(visible)
  },
  setColumnPin: async (columnKey, side) => {
    table.getColumn(columnKey)?.pin(side === 'none' ? false : side)
  },
  resetColumnPin: async (columnKey) => {
    const fallback = defaultPinItems.value.find(item => item.key === columnKey)?.side ?? false
    table.getColumn(columnKey)?.pin(fallback)
  },
  resetAllPins: async () => {
    updatePinning(toTanStackPinning(defaultPinItems.value))
  },
  setColumnSort: async (columnKey, direction) => setColumnSort(columnKey, direction),
  clearColumnSort: async columnKey => setSorting(sorting.value.filter(item => item.id !== columnKey)),
  clearAllSort: async () => setSorting([]),
}

const unregisterBoundary = boundaryRegistry?.register(props.boundaryId, {
  applyPatch: applyRuntimePatch,
})

watch(
  () => [props.source, props.renderVersion] as const,
  async ([source]) => {
    baseRows.value = copyRows(source)
    await nextTick()
    clampPagination()
    reconcileSelection()
  },
)
watch(
  () => tableColumns.value.map(column => column.key).join('|'),
  () => reconcileColumnState(),
)
watch(
  () => defaultHiddenKeys.value.join('|'),
  () => {
    columnVisibility.value = readInitialVisibility()
  },
)
watch(
  () => [props.selectionMode, props.selectionTrigger] as const,
  ([selectionMode]) => {
    if (selectionMode === 'none') {
      selectedRowIds.value = new Set()
      selectionAnchorId.value = null
    }
    else if (selectionMode === 'single' && selectedRowIds.value.size > 1) {
      selectedRowIds.value = new Set([...selectedRowIds.value].slice(0, 1))
    }
  },
)

onBeforeUnmount(() => {
  if (columnSizeTimer) clearTimeout(columnSizeTimer)
  unregisterBoundary?.()
  closeShadcnMenu(props.boundaryId)
})

function renderTableCell(
  column: EndgeShadcnTableColumn,
  row: Row<Record<string, unknown>>,
) {
  const virtualRow = virtualRowContexts.value.get(row.id)
  return props.renderCell(
    column,
    virtualRow?.styledRow ?? row.original,
    virtualRow?.rowIndex ?? row.index,
    row.id,
  )
}

function updatePagination(updater: Updater<PaginationState>): void {
  const previous = pagination.value
  const next = resolveUpdater(updater, pagination.value)
  const pageSize = normalizePositiveInteger(next.pageSize, props.pageSize)
  const maxPageIndex = Math.max(0, Math.ceil(totalRowCount.value / pageSize) - 1)
  pagination.value = {
    pageIndex: Math.min(Math.max(0, Math.floor(next.pageIndex)), maxPageIndex),
    pageSize,
  }
  persistTableState('pagination', pagination.value)
  if (scrollRoot.value)
    scrollRoot.value.scrollTop = 0
  if (previous.pageIndex !== pagination.value.pageIndex || previous.pageSize !== pagination.value.pageSize) {
    emitTableEvent('pageChanged', {
      tableId: effectiveTableId(),
      pageIndex: pagination.value.pageIndex,
      pageSize: pagination.value.pageSize,
      pageCount: pageCount.value,
    })
  }
}

function setPageSize(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  updatePagination({ pageIndex: 0, pageSize: Number(target.value) })
}

function clampPagination(): void {
  updatePagination(pagination.value)
}

function readInitialPagination(): PaginationState {
  const fallback = { pageIndex: 0, pageSize: props.pageSize }
  const stored = readTableState<PaginationState>('pagination', fallback)
  const pageSize = normalizePositiveInteger(stored.pageSize, props.pageSize)
  return {
    pageIndex: Math.min(
      normalizeNonNegativeInteger(stored.pageIndex, 0),
      Math.max(0, Math.ceil(baseRows.value.length / pageSize) - 1),
    ),
    pageSize,
  }
}

function updateSorting(updater: Updater<SortingState>): void {
  if (props.sortMode === 'disabled' || props.sortMode === 'fixed')
    return
  const next = resolveUpdater(updater, sorting.value)
  setSorting(props.sortMode === 'single' ? next.slice(0, 1) : next)
}

function setSorting(next: SortingState): void {
  const previous = JSON.stringify(sorting.value)
  sorting.value = next
  persistTableState('sort', next.map(item => ({ key: item.id, direction: item.desc ? 'desc' : 'asc' })))
  if (previous !== JSON.stringify(next)) {
    emitTableEvent('sortChanged', {
      tableId: effectiveTableId(),
      sort: next.map(item => ({ columnKey: item.id, direction: item.desc ? 'desc' : 'asc' })),
    })
  }
}

function updatePinning(updater: Updater<ColumnPinningState>): void {
  if (props.pinMode === 'disabled')
    return
  const previous = JSON.stringify(columnPinning.value)
  columnPinning.value = resolveUpdater(updater, columnPinning.value)
  persistTableState('pin', toEndgePinning(columnPinning.value))
  if (previous !== JSON.stringify(columnPinning.value)) {
    emitTableEvent('columnPinChanged', {
      tableId: effectiveTableId(),
      left: [...(columnPinning.value.left ?? [])],
      right: [...(columnPinning.value.right ?? [])],
    })
  }
}

function updateColumnOrder(updater: Updater<ColumnOrderState>): void {
  const next = resolveUpdater(updater, resolvedColumnOrder.value)
    .filter(key => key !== SELECTION_COLUMN_ID)
  if (JSON.stringify(next) === JSON.stringify(columnOrder.value)) return
  columnOrder.value = next
  persistTableState('order', next)
  emitTableEvent('columnOrderChanged', { tableId: effectiveTableId(), columnKeys: [...next] })
}

function updateColumnVisibility(updater: Updater<VisibilityState>): void {
  const next = resolveUpdater(updater, columnVisibility.value)
  if (JSON.stringify(next) === JSON.stringify(columnVisibility.value)) return
  columnVisibility.value = next
  persistTableState('visibility', next)
  const visibility = Object.fromEntries(tableColumns.value.map(column => [column.key, next[column.key] !== false]))
  emitTableEvent('columnVisibilityChanged', {
    tableId: effectiveTableId(),
    visibility,
    hiddenColumnKeys: Object.entries(visibility).filter(([, visible]) => !visible).map(([key]) => key),
  })
}

function updateColumnSizing(updater: Updater<ColumnSizingState>): void {
  const previous = columnSizing.value
  const next = resolveUpdater(updater, previous)
  if (JSON.stringify(next) === JSON.stringify(previous)) return
  columnSizing.value = next
  persistTableState('sizing', next)
  const changedColumnKey = Object.keys(next).find(key => next[key] !== previous[key]) ?? null
  if (columnSizeTimer) clearTimeout(columnSizeTimer)
  columnSizeTimer = setTimeout(() => {
    columnSizeTimer = null
    emitTableEvent('columnSizeChanged', {
      tableId: effectiveTableId(),
      sizes: { ...columnSizing.value },
      changedColumnKey,
    })
  }, 80)
}

function resolveUpdater<T>(updater: Updater<T>, current: T): T {
  return typeof updater === 'function'
    ? (updater as (previous: T) => T)(current)
    : updater
}

function readInitialSorting(): SortingState {
  const fallback = props.sortMode === 'disabled' ? [] : defaultSortItems.value
  const persisted = readTableArrayState<ComponentSFCTableSortStateItem>('sort', fallback)
  const allowed = new Set(tableColumns.value.filter(column => column.sort?.sortable).map(column => column.key))
  const normalized = persisted
    .filter(isTableSortStateItem)
    .filter(item => allowed.has(item.key))
    .map(item => ({ id: item.key, desc: item.direction === 'desc' }))
  return props.sortMode === 'single' ? normalized.slice(0, 1) : normalized
}

function readInitialPinning(): ColumnPinningState {
  if (props.pinMode === 'disabled') return { left: [], right: [] }
  return toTanStackPinning(
    readTableArrayState<ComponentSFCTableColumnPinStateItem>('pin', defaultPinItems.value)
      .filter(isTablePinStateItem),
  )
}

function readInitialVisibility(): VisibilityState {
  const fallback = Object.fromEntries(defaultHiddenKeys.value.map(key => [key, false]))
  const stored = readTableRecordState<VisibilityState>('visibility', fallback)
  const known = new Set(tableColumns.value.map(column => column.key))

  return Object.fromEntries(
    Object.entries(stored).filter(([key, visible]) => known.has(key) && typeof visible === 'boolean'),
  )
}

function readTableState<T>(section: string, fallback: T): T {
  const key = tableStateKey.value
  if (!props.runtimeState || !key)
    return fallback
  const value = props.runtimeState.get<unknown>(key, section, fallback)
  return value == null ? fallback : value as T
}

function readTableArrayState<T>(section: string, fallback: T[]): T[] {
  const value = readTableState<unknown>(section, fallback)
  return Array.isArray(value) ? value as T[] : fallback
}

function readTableRecordState<T extends Record<string, unknown>>(section: string, fallback: T): T {
  const value = readTableState<unknown>(section, fallback)
  return isPlainObject(value) ? value as T : fallback
}

function persistTableState<T>(section: string, value: T): void {
  const key = tableStateKey.value
  if (!props.runtimeState || !key)
    return
  props.runtimeState.set(key, section, value)
}

function reconcileColumnState(): void {
  const keys = tableColumns.value.map(column => column.key)
  columnOrder.value = [
    ...columnOrder.value.filter(key => keys.includes(key)),
    ...keys.filter(key => !columnOrder.value.includes(key)),
  ]
  columnPinning.value = {
    left: (columnPinning.value.left ?? []).filter(key => keys.includes(key)),
    right: (columnPinning.value.right ?? []).filter(key => keys.includes(key)),
  }
  columnVisibility.value = Object.fromEntries(
    Object.entries(columnVisibility.value).filter(([key]) => keys.includes(key)),
  )
}

function setColumnSort(columnKey: string, direction: TableSortDirection): void {
  if (props.sortMode === 'disabled' || props.sortMode === 'fixed') return
  const next = { id: columnKey, desc: direction === 'desc' }
  if (props.sortMode === 'single') {
    setSorting([next])
    return
  }
  const existing = sorting.value.findIndex(item => item.id === columnKey)
  setSorting(existing < 0
    ? [...sorting.value, next]
    : sorting.value.map(item => item.id === columnKey ? next : item))
}

function openColumnMenu(
  column: Column<Record<string, unknown>>,
  event: MouseEvent,
  anchorKind: 'element' | 'point',
): void {
  const descriptor = getColumnDescriptor(column)
  const menu = resolveColumnMenu(descriptor)
  if (!menu) return
  const context = createColumnActionContext(column, descriptor)
  if (!menu.items.some(item => item.kind === 'item'))
    return
  event.preventDefault()
  event.stopPropagation()
  openShadcnMenu({
    ownerId: props.boundaryId,
    anchor: anchorKind === 'element'
      ? elementMenuAnchor(event.currentTarget as Element)
      : pointMenuAnchor(event.clientX, event.clientY),
    menu,
    context,
  })
}

function onColumnHeaderClick(column: Column<Record<string, unknown>>, event: MouseEvent): void {
  if (resolveColumnMenu(getColumnDescriptor(column))) {
    openColumnMenu(column, event, 'element')
    return
  }
  if (column.getCanSort() && props.sortMode !== 'fixed') column.toggleSorting()
}

function resolveColumnMenu(_column: EndgeShadcnTableColumn): ContextMenuDescriptor | null {
  if (props.columnMenu.mode === 'disabled') return null
  if (props.columnMenu.mode === 'inline') return props.menuContext ? resolveSFCTableMenu(props.columnMenu.menu, props.menuContext) : null
  return defaultColumnMenu
}

function createColumnActionContext(
  column: Column<Record<string, unknown>>,
  descriptor: EndgeShadcnTableColumn,
): TableColumnActionContext {
  const sortIndex = sorting.value.findIndex(item => item.id === column.id)
  const defaultPin = defaultPinItems.value.find(item => item.key === column.id)?.side ?? 'none'
  return {
    surface: 'table-column-header',
    runtimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
    tableRuntimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
    tableId: props.tableId || props.boundaryId,
    target: tableActionTarget,
    columnKey: column.id,
    columnIndex: descriptor.index,
    hideable: column.getCanHide(),
    pinnable: descriptor.pinnable,
    pinMode: props.pinMode,
    pinState: (column.getIsPinned() || 'none') as TableColumnPinSide,
    defaultPinState: defaultPin,
    hasPinChanges: JSON.stringify(toEndgePinning(columnPinning.value)) !== JSON.stringify(defaultPinItems.value),
    sortable: descriptor.sort?.sortable === true,
    sortMode: props.sortMode,
    sortState: {
      active: sortIndex >= 0,
      direction: sortIndex >= 0 ? (sorting.value[sortIndex]?.desc ? 'desc' : 'asc') : undefined,
      index: sortIndex >= 0 ? sortIndex : undefined,
    },
    activeSortCount: sorting.value.length,
  }
}

async function applyRuntimePatch(patch: RuntimeBoundaryPatch): Promise<boolean> {
  if (patch.kind !== 'collection-projection-update' || patch.boundaryId !== props.boundaryId)
    return false
  const next = copyRows(baseRows.value)
  const rowIndex = resolvePatchedRowIndex(next, patch)
  if (rowIndex < 0) return false
  if (!isPlainObject(patch.itemSnapshot)) return false
  next[rowIndex] = { ...patch.itemSnapshot }
  baseRows.value = next
  await nextTick()
  return true
}

function resolvePatchedRowIndex(rows: Record<string, unknown>[], patch: RuntimeBoundaryPatch): number {
  const key = isPlainObject(patch.itemSnapshot) ? patch.itemSnapshot[props.rowKey] : undefined
  if (key != null) {
    const index = rows.findIndex(row => row[props.rowKey] === key)
    if (index >= 0) return index
  }
  return patch.itemIndex != null && patch.itemIndex >= 0 && patch.itemIndex < rows.length ? patch.itemIndex : -1
}

function getColumnDescriptor(column: Column<Record<string, unknown>>): EndgeShadcnTableColumn {
  return (column.columnDef.meta as any).endgeColumn as EndgeShadcnTableColumn
}

function isSelectionColumn(column: Column<Record<string, unknown>>): boolean {
  return column.id === SELECTION_COLUMN_ID
}

function toggleVisibleRows(checked: boolean): void {
  if (props.selectionMode !== 'multiple') return
  const next = new Set(selectedRowIds.value)
  for (const rowId of visibleRowIds.value) {
    if (checked) next.add(rowId)
    else next.delete(rowId)
  }
  commitSelection(next)
}

function toggleRowFromControl(row: Row<Record<string, unknown>>, checked: boolean): void {
  if (props.selectionMode === 'none') return
  const next = new Set(selectedRowIds.value)
  if (props.selectionMode === 'single') {
    if (!checked) return
    next.clear()
  }
  if (checked) next.add(row.id)
  else next.delete(row.id)
  selectionAnchorId.value = row.id
  commitSelection(next)
}

function handleSelectionControlChange(row: Row<Record<string, unknown>>, event: Event): void {
  toggleRowFromControl(row, (event.target as HTMLInputElement).checked)
}

function handleVisibleSelectionChange(event: Event): void {
  toggleVisibleRows((event.target as HTMLInputElement).checked)
}

function getPinnedStyle(column: Column<Record<string, unknown>>): CSSProperties {
  const pinned = column.getIsPinned()
  return {
    left: pinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: pinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    position: pinned ? 'sticky' : 'relative',
    width: `${column.getSize()}px`,
    minWidth: `${column.getSize()}px`,
    maxWidth: `${column.getSize()}px`,
    flex: `0 0 ${column.getSize()}px`,
    zIndex: pinned ? 3 : 1,
  }
}

function getVirtualRowStyle(virtualItem: VirtualItem): CSSProperties {
  return {
    display: 'flex',
    height: `${virtualItem.size}px`,
    position: 'absolute',
    transform: `translateY(${virtualItem.start}px)`,
    width: '100%',
  }
}

function getCellAttrs(row: Record<string, unknown>, column: EndgeShadcnTableColumn): Record<string, unknown> {
  return getSFCTableCellStyleSurfaces(row, column.index)?.cell.attrs ?? {
    part: 'cell',
    'data-endge-part': 'cell',
    class: [],
  }
}

function getRowClass(row: Record<string, unknown>): string | string[] | undefined {
  const value = row[SFC_TABLE_ROW_CLASS_FIELD]
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value
  return undefined
}

function effectiveTableId(): string {
  return props.tableId || props.boundaryId
}

function eventSource(): ComponentSFCEventRuntimeSource {
  return {
    nodeId: props.nodeId ?? props.boundaryId,
    ref: props.tableRef ?? undefined,
    componentTag: 'Table',
    target: {
      type: 'component.table',
      identity: effectiveTableId(),
      value: tableActionTarget,
    },
  }
}

function emitTableEvent<TName extends TableEventName>(name: TName, payload: TableEventMap[TName]): void {
  const boundary = props.eventBoundary
  if (boundary && typeof boundary.routeChild === 'function')
    void boundary.routeChild(eventSource(), name, payload, runtimeEventBindings.value)
}

function resolveColumnKey(event: MouseEvent | KeyboardEvent): string | null {
  const element = event.target instanceof Element ? event.target.closest('td') : null
  const index = element ? Array.from(element.parentElement?.children ?? []).indexOf(element) : -1
  const columnId = index >= 0 ? table.getVisibleLeafColumns()[index]?.id ?? null : null
  return columnId === SELECTION_COLUMN_ID ? null : columnId
}

function activateRow(entry: VirtualTableRow, event: MouseEvent | KeyboardEvent): void {
  emitTableEvent('rowActivated', {
    tableId: effectiveTableId(),
    rowId: entry.row.id,
    rowIndex: entry.rowIndex,
    row: entry.row.original,
    columnKey: resolveColumnKey(event),
    activation: event instanceof KeyboardEvent ? 'keyboard' : 'pointer',
  })
}

function requestRowContextMenu(entry: VirtualTableRow, event: MouseEvent): void {
  event.preventDefault()
  const columnKey = resolveColumnKey(event) ?? ''
  const row = entry.row.original
  const value = columnKey ? readSFCObjectPath(columnKey, row) : undefined
  emitTableEvent('rowContextMenuRequested', {
    tableId: effectiveTableId(),
    rowId: entry.row.id,
    rowIndex: entry.rowIndex,
    row,
    columnKey: columnKey || null,
    anchor: { x: event.clientX, y: event.clientY },
  })
  const column = props.columns.find(candidate => candidate.key === columnKey)
  const menuDescriptor = column?.cellMenu ?? props.rowMenu
  if (menuDescriptor.mode !== 'inline' || !menuDescriptor.menu || !props.menuContext || !column) return
  const tableContext = {
    id: effectiveTableId(),
    runtimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
    state: { selectedRowIds: [...selectedRowIds.value] },
  }
  const rowContext = { id: entry.row.id, index: entry.rowIndex, data: row }
  const columnContext = {
    key: column.key,
    index: column.index,
    title: column.title,
    metadata: column.metadata ?? {},
  }
  const cell = { value }
  const baseMenuContext = props.menuContext
  const menuContext = extendSFCVueRenderContext(
    baseMenuContext,
    {
      $table: tableContext,
      $row: rowContext,
      $column: columnContext,
      $cell: cell,
      row,
      rowId: entry.row.id,
      rowIndex: entry.rowIndex,
      columnKey,
      columnMeta: column.metadata ?? {},
      value,
    },
    baseMenuContext.iteration,
    `${baseMenuContext.consumerScope}/row-menu:${entry.row.id}:${columnKey}`,
  )
  const menu = resolveSFCTableMenu(menuDescriptor.menu, menuContext)
  const context: TableRowActionContext = {
    surface: 'table-row',
    runtimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
    tableRuntimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
    tableId: effectiveTableId(),
    table: tableContext,
    rowContext,
    column: columnContext,
    cell,
    target: tableActionTarget,
    row,
    rowId: entry.row.id,
    rowIndex: entry.rowIndex,
    columnKey,
    value,
  }
  if (!menu || !menu.items.some(item => item.kind === 'item')) {
    closeShadcnMenu(props.boundaryId)
    return
  }
  event.stopPropagation()
  openShadcnMenu({
    ownerId: props.boundaryId,
    anchor: pointMenuAnchor(event.clientX, event.clientY),
    menu,
    context,
  })
}

function onRowClick(entry: VirtualTableRow, event: MouseEvent): void {
  if (!selectOnRow.value) return
  const next = new Set(selectedRowIds.value)
  if (props.selectionMode === 'single') {
    next.clear()
    next.add(entry.row.id)
  }
  else if (event.shiftKey && selectionAnchorId.value) {
    const rows = tableRows.value
    const from = rows.findIndex(row => row.id === selectionAnchorId.value)
    const to = rows.findIndex(row => row.id === entry.row.id)
    if (from >= 0 && to >= 0) {
      if (!event.metaKey && !event.ctrlKey) next.clear()
      for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1)
        next.add(rows[index]!.id)
    }
  }
  else if (event.metaKey || event.ctrlKey) {
    if (next.has(entry.row.id)) next.delete(entry.row.id)
    else next.add(entry.row.id)
  }
  else {
    next.clear()
    next.add(entry.row.id)
  }
  selectionAnchorId.value = entry.row.id
  commitSelection(next)
}

function onRowKeydown(entry: VirtualTableRow, event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    activateRow(entry, event)
  }
  else if (event.key === ' ') {
    event.preventDefault()
    onRowClick(entry, event as unknown as MouseEvent)
  }
}

function commitSelection(next: Set<string>): void {
  if (props.selectionMode === 'none') return
  const previous = selectedRowIds.value
  const addedRowIds = [...next].filter(id => !previous.has(id))
  const removedRowIds = [...previous].filter(id => !next.has(id))
  if (addedRowIds.length === 0 && removedRowIds.length === 0) return
  selectedRowIds.value = next
  const rowsById = new Map(table.getCoreRowModel().rows.map(row => [row.id, row.original] as const))
  const selectedRowIdsOrdered = [...next].filter(id => rowsById.has(id))
  emitTableEvent('selectionChanged', {
    tableId: effectiveTableId(),
    mode: props.selectionMode,
    selectedRowIds: selectedRowIdsOrdered,
    selectedRows: selectedRowIdsOrdered.map(id => rowsById.get(id)!),
    addedRowIds,
    removedRowIds,
  })
}

function reconcileSelection(): void {
  if (props.selectionMode === 'none' || selectedRowIds.value.size === 0) return
  const available = new Set(table.getCoreRowModel().rows.map(row => row.id))
  commitSelection(new Set([...selectedRowIds.value].filter(id => available.has(id))))
}

function getSortIndex(columnId: string): number | null {
  const index = sorting.value.findIndex(item => item.id === columnId)
  return index < 0 ? null : index + 1
}

function compareRows(left: Record<string, unknown>, right: Record<string, unknown>, column: EndgeShadcnTableColumn): number {
  if (!column.sort) return 0
  for (const path of column.sort.paths) {
    const result = compareValues(readPath(left, path), readPath(right, path), column.sort.comparator)
    if (result !== 0) return result
  }
  return 0
}

function compareValues(left: unknown, right: unknown, comparator: string): number {
  const leftEmpty = left == null || left === ''
  const rightEmpty = right == null || right === ''
  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1
  if (comparator === 'number') return compareNumber(left, right)
  if (comparator === 'date') return compareNumber(Date.parse(String(left)), Date.parse(String(right)))
  if (comparator === 'time') return compareNumber(parseTime(left), parseTime(right))
  if (comparator === 'boolean') return Number(Boolean(left)) - Number(Boolean(right))
  return new Intl.Collator(undefined, { numeric: comparator !== 'text', sensitivity: 'base' })
    .compare(String(left), String(right))
}

function compareNumber(left: unknown, right: unknown): number {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b))
    return String(left).localeCompare(String(right), undefined, { numeric: true })
  return a - b
}

function parseTime(value: unknown): number {
  const match = String(value ?? '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : Number.NaN
}

function readPath(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((value, segment) => {
    return value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
  }, row)
}

function toTanStackPinning(value: ComponentSFCTableColumnPinStateItem[]): ColumnPinningState {
  return {
    left: value.filter(item => item.side === 'left').map(item => item.key),
    right: value.filter(item => item.side === 'right').map(item => item.key),
  }
}

function isTableSortStateItem(value: unknown): value is ComponentSFCTableSortStateItem {
  if (!isPlainObject(value)) return false
  return typeof value.key === 'string'
    && (value.direction === 'asc' || value.direction === 'desc')
}

function isTablePinStateItem(value: unknown): value is ComponentSFCTableColumnPinStateItem {
  if (!isPlainObject(value)) return false
  return typeof value.key === 'string'
    && (value.side === 'left' || value.side === 'right')
}

function toEndgePinning(value: ColumnPinningState): ComponentSFCTableColumnPinStateItem[] {
  return [
    ...(value.left ?? []).map(key => ({ key, side: 'left' as const })),
    ...(value.right ?? []).map(key => ({ key, side: 'right' as const })),
  ]
}

function copyRows(rows: unknown): Record<string, unknown>[] {
  return Array.isArray(rows) ? rows.filter(isPlainObject) : []
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeRowId(value: unknown, index: number): string {
  const normalized = String(value ?? '').trim()
  return normalized || String(index)
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const normalized = Math.floor(Number(value))
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const normalized = Math.floor(Number(value))
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback
}

function menuItem(id: string, label: string, icon: string) {
  return { kind: 'item' as const, id, label, action: id, icon }
}
</script>

<template>
  <div
    class="endge-shadcn-table"
    :data-paging="paging"
    :data-lazy="lazy ? 'true' : undefined"
    :style="{ '--endge-table-row-size': `${rowSize}px` }"
  >
    <div class="endge-shadcn-table__toolbar">
      <div v-if="showRuntimeControls" class="endge-shadcn-table__runtime-controls">
        <ShadcnInput
          v-if="showSearch"
          class="endge-shadcn-input endge-shadcn-table__search"
          type="search"
          :value="runtimeContext?.searchValue.value ?? ''"
          placeholder="Поиск…"
          aria-label="Поиск по таблице"
          @input="updateSearchValue"
        />

        <button
          v-if="showFilters"
          type="button"
          class="endge-shadcn-button endge-shadcn-button--outline endge-shadcn-table__filter-toggle"
          :data-active="filtersVisible ? 'true' : undefined"
          :aria-expanded="filtersVisible"
          :aria-label="filtersVisible ? 'Скрыть фильтры' : 'Показать фильтры'"
          :title="filtersVisible ? 'Скрыть фильтры' : 'Показать фильтры'"
          @click="toggleFilters"
        >
          <Filter :size="15" />
        </button>
      </div>

      <div
        class="endge-shadcn-table__toolbar-meta"
        :class="{ 'endge-shadcn-table__toolbar-meta--after-controls': showRuntimeControls }"
      >
        <div class="endge-shadcn-table__summary">
          <span>{{ totalRowCount }}</span>
          <span class="endge-shadcn-table__summary-label">строк</span>
        </div>
        <ShadcnTableColumnManager v-if="tableColumns.length > 1" :table="table" />
      </div>
    </div>

    <div
      v-if="filterRuntime"
      v-show="filtersVisible"
      class="endge-shadcn-table__runtime-filters"
    >
      <VueShadcnFilterRenderer :runtime="filterRuntime" />
    </div>

    <div
      ref="scrollRoot"
      v-bind="styleContract.grid.attrs"
      class="endge-shadcn-table__viewport"
    >
      <table
        data-slot="table"
        data-virtualized="true"
        :data-row-count="totalRowCount"
        :data-page-row-count="tableRows.length"
        class="endge-shadcn-table__table"
        :style="{ width: tableWidth }"
      >
        <thead v-bind="styleContract.header.attrs" class="endge-shadcn-table__header">
          <tr>
            <th
              v-for="header in flatHeaders"
              :key="header.id"
              v-bind="isSelectionColumn(header.column) ? {} : getColumnDescriptor(header.column).styleSurfaces.headerCell.attrs"
              class="endge-shadcn-table__head"
              :class="{
                'endge-shadcn-table__head--pinned': header.column.getIsPinned(),
                'endge-shadcn-table__selection-head': isSelectionColumn(header.column),
              }"
              :style="getPinnedStyle(header.column)"
              @contextmenu="isSelectionColumn(header.column) ? undefined : openColumnMenu(header.column, $event, 'point')"
            >
              <input
                v-if="isSelectionColumn(header.column) && selectionMode === 'multiple'"
                class="endge-shadcn-checkbox endge-shadcn-table__selection-input"
                type="checkbox"
                :checked="allVisibleRowsSelected"
                :indeterminate="someVisibleRowsSelected"
                aria-label="Выбрать отображаемые строки"
                @click.stop
                @change="handleVisibleSelectionChange"
              >
              <button
                v-else-if="!isSelectionColumn(header.column)"
                type="button"
                class="endge-shadcn-table__sort"
                :class="{ 'endge-shadcn-table__sort--enabled': header.column.getIsSorted() }"
                :disabled="!header.column.getCanSort() && !resolveColumnMenu(getColumnDescriptor(header.column))"
                @click="onColumnHeaderClick(header.column, $event)"
              >
                <span v-bind="getColumnDescriptor(header.column).styleSurfaces.headerContent.attrs" class="endge-shadcn-table__head-title">
                  <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                </span>
                <span v-if="header.column.getCanSort()" class="endge-shadcn-table__sort-icon">
                  <ArrowUp v-if="header.column.getIsSorted() === 'asc'" :size="14" />
                  <ArrowDown v-else-if="header.column.getIsSorted() === 'desc'" :size="14" />
                  <ChevronsUpDown v-else :size="14" />
                  <span v-if="getSortIndex(header.column.id) != null && sorting.length > 1" class="endge-shadcn-table__sort-index">
                    {{ getSortIndex(header.column.id) }}
                  </span>
                </span>
              </button>
              <div
                v-if="header.column.getCanResize()"
                class="endge-shadcn-table__resizer"
                :class="{ 'endge-shadcn-table__resizer--active': header.column.getIsResizing() }"
                @mousedown="header.getResizeHandler()($event)"
                @touchstart="header.getResizeHandler()($event)"
                @dblclick="header.column.resetSize()"
              />
            </th>
          </tr>
        </thead>

        <tbody
          v-bind="styleContract.body.attrs"
          class="endge-shadcn-table__body"
          :style="{ height: `${virtualBodyHeight}px` }"
        >
          <tr
            v-for="virtualRow in virtualRows"
            :key="String(virtualRow.virtualItem.key)"
            :data-index="virtualRow.rowIndex"
            class="endge-shadcn-table__row"
            :class="[getRowClass(virtualRow.styledRow), { 'endge-shadcn-table__row--selected': selectedRowIds.has(virtualRow.row.id) }]"
            :style="getVirtualRowStyle(virtualRow.virtualItem)"
            :tabindex="selectionMode === 'none' ? -1 : 0"
            :aria-selected="selectionMode === 'none' ? undefined : selectedRowIds.has(virtualRow.row.id)"
            @click="onRowClick(virtualRow, $event)"
            @dblclick="activateRow(virtualRow, $event)"
            @contextmenu="requestRowContextMenu(virtualRow, $event)"
            @keydown="onRowKeydown(virtualRow, $event)"
          >
            <td
              v-for="cell in getStableVisibleCells(virtualRow.row)"
              :key="cell.id"
              v-bind="isSelectionColumn(cell.column) ? {} : getCellAttrs(virtualRow.styledRow, getColumnDescriptor(cell.column))"
              class="endge-shadcn-table__cell"
              :class="{
                'endge-shadcn-table__cell--pinned': cell.column.getIsPinned(),
                'endge-shadcn-table__selection-cell': isSelectionColumn(cell.column),
              }"
              :style="getPinnedStyle(cell.column)"
            >
              <input
                v-if="isSelectionColumn(cell.column)"
                class="endge-shadcn-checkbox endge-shadcn-table__selection-input"
                :class="{ 'endge-shadcn-table__selection-input--single': selectionMode === 'single' }"
                :type="selectionMode === 'single' ? 'radio' : 'checkbox'"
                :name="selectionMode === 'single' ? `endge-table-selection-${tableId || boundaryId}` : undefined"
                :checked="selectedRowIds.has(virtualRow.row.id)"
                aria-label="Выбрать строку"
                @click.stop
                @change="handleSelectionControlChange(virtualRow.row, $event)"
              >
              <FlexRender v-else :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
          <tr v-if="tableRows.length === 0">
            <td :colspan="visibleColumnCount" class="endge-shadcn-table__empty">Нет данных</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer v-if="paging === 'pages'" class="endge-shadcn-table__pagination" aria-label="Table pagination">
      <div class="endge-shadcn-table__pagination-controls">
        <label class="endge-shadcn-table__page-size">
          <span>Rows per page</span>
          <span class="endge-shadcn-table__page-size-select">
            <select :value="pagination.pageSize" aria-label="Rows per page" @change="setPageSize">
              <option v-for="size in pageSizeOptions" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </span>
        </label>

        <span class="endge-shadcn-table__page-label">Page {{ currentPage }} of {{ pageCount }}</span>

        <div class="endge-shadcn-table__page-buttons">
          <button
            type="button"
            aria-label="First page"
            :disabled="!table.getCanPreviousPage()"
            @click="table.setPageIndex(0)"
          >
            <ChevronsLeft :size="16" />
          </button>
          <button
            type="button"
            aria-label="Previous page"
            :disabled="!table.getCanPreviousPage()"
            @click="table.previousPage()"
          >
            <ChevronLeft :size="16" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            :disabled="!table.getCanNextPage()"
            @click="table.nextPage()"
          >
            <ChevronRight :size="16" />
          </button>
          <button
            type="button"
            aria-label="Last page"
            :disabled="!table.getCanNextPage()"
            @click="table.setPageIndex(pageCount - 1)"
          >
            <ChevronsRight :size="16" />
          </button>
        </div>
      </div>
    </footer>
  </div>
</template>
