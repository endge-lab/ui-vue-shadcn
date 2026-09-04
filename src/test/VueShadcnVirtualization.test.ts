import type { EndgeStyleMatchNode } from '@endge/core'
import type {
  SFCVueRenderContext,
} from '@/services/render/sfc/sfc-shadcn-render.type'
import type {
  SFCTableColumnStyleSurfaces,
  SFCTablePublicPart,
  SFCTablePublicSurface,
  SFCTableStyleContract,
} from '@/ui/render/sfc/SFCRender_TableStyle'
import type { EndgeShadcnTableColumn, EndgeShadcnTableProps } from '@/ui/table/table.types'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp, h, nextTick } from 'vue'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import ShadcnSfcDataTable from '@/ui/table/ShadcnSfcDataTable.vue'

describe('виртуализация VueShadcnSfcDataTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('использует безопасные значения коллекции по умолчанию и игнорирует повреждённое сохранённое состояние таблицы', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    const runtimeState = {
      runtimeId: 'runtime-test',
      storageKey: 'runtime-test',
      get<T>(): T {
        return undefined as T
      },
      set(): void {},
      remove(): void {},
      clear(): void {},
    }
    const root = document.createElement('div')
    const app = createApp({
      render: () => h(ShadcnSfcDataTable, {
        boundaryId: 'defaults-test',
        tableId: 'defaults',
        runtimeState,
        columns: createColumns(),
        source: [{ id: '1', flight: 'SU 100', gate: 'A1' }],
        styleContract: createStyleContract(),
        rowKey: 'id',
        sortMode: 'multiple',
        pinMode: 'enabled',
        columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
        defaultSort: undefined,
        defaultPin: undefined,
        defaultHidden: undefined,
        rowSize: 40,
        renderVersion: 0,
        renderCell: (column: EndgeShadcnTableColumn, row: Record<string, unknown>) => h('span', String(row[column.key] ?? '')),
      } as unknown as EndgeShadcnTableProps),
    })

    expect(() => app.mount(root)).not.toThrow()
    await nextTick()
    expect(root.querySelector('.endge-shadcn-table')).not.toBeNull()

    app.unmount()
  })

  it('не нарушает setup, когда props коллекции содержат null из устаревшего runtime-артефакта', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const root = document.createElement('div')
    const app = createApp({
      render: () => h(ShadcnSfcDataTable, {
        boundaryId: 'malformed-collections-test',
        tableId: 'malformed',
        runtimeState: null,
        columns: null,
        source: null,
        styleContract: createStyleContract(),
        rowKey: 'id',
        sortMode: 'multiple',
        pinMode: 'enabled',
        columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
        defaultSort: null,
        defaultPin: null,
        defaultHidden: null,
        pageSizes: null,
        eventBindings: null,
        rowSize: 40,
        renderVersion: 0,
        renderCell: () => null,
      } as unknown as EndgeShadcnTableProps),
    })

    expect(() => app.mount(root)).not.toThrow()
    await nextTick()
    expect(root.querySelector('.endge-shadcn-table__empty')?.textContent).toContain('Нет данных')
    app.unmount()
  })

  it('использует стандартные настройки pagination с lazy и виртуализирует активную страницу', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)

    const rows = Array.from({ length: 6_000 }, (_, index) => ({
      id: String(index),
      flight: `SU ${String(index).padStart(4, '0')}`,
      gate: `A${index % 30}`,
    }))
    const root = document.createElement('div')
    const app = createApp({
      render: () => h(ShadcnSfcDataTable, {
        boundaryId: 'virtualization-test',
        tableId: 'flights',
        runtimeState: null,
        columns: createColumns(),
        source: rows,
        styleContract: createStyleContract(),
        rowKey: 'id',
        sortMode: 'multiple',
        pinMode: 'disabled',
        columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
        defaultSort: [],
        defaultPin: [],
        defaultHidden: [],
        rowSize: 40,
        lazy: true,
        renderVersion: 0,
        renderCell: (column, row) => h('span', String(row[column.key] ?? '')),
      }),
    })

    app.mount(root)
    await nextTick()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const table = root.querySelector<HTMLTableElement>('[data-virtualized="true"]')
    const initialRows = root.querySelectorAll<HTMLElement>('.endge-shadcn-table__row')
    expect(table?.dataset.rowCount).toBe('6000')
    expect(table?.dataset.pageRowCount).toBe('10')
    expect(root.querySelector('.endge-shadcn-table')?.getAttribute('data-paging')).toBe('pages')
    expect(root.querySelector('.endge-shadcn-table')?.getAttribute('data-lazy')).toBe('true')
    expect(root.querySelector('.endge-shadcn-table__page-label')?.textContent).toContain('Page 1 of 600')
    expect(initialRows.length).toBeGreaterThan(0)
    expect(initialRows.length).toBeLessThan(40)

    root.querySelector<HTMLButtonElement>('[aria-label="Last page"]')?.click()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const lastPageIndexes = [...root.querySelectorAll<HTMLElement>('.endge-shadcn-table__row')]
      .map(row => Number(row.dataset.index))
    expect(root.querySelector('.endge-shadcn-table__page-label')?.textContent).toContain('Page 600 of 600')
    expect(Math.min(...lastPageIndexes)).toBeGreaterThanOrEqual(5_990)
    expect(lastPageIndexes.length).toBeLessThan(40)

    app.unmount()
  })

  it('виртуализирует полную локальную коллекцию без render pagination', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)

    const rows = Array.from({ length: 6_000 }, (_, index) => ({
      id: String(index),
      flight: `SU ${String(index).padStart(4, '0')}`,
      gate: `A${index % 30}`,
    }))
    const root = document.createElement('div')
    const app = createApp({
      render: () => h(ShadcnSfcDataTable, {
        boundaryId: 'virtualization-all-rows-test',
        tableId: 'flights-virtual',
        runtimeState: null,
        columns: createColumns(),
        source: rows,
        styleContract: createStyleContract(),
        rowKey: 'id',
        sortMode: 'multiple',
        pinMode: 'disabled',
        columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
        defaultSort: [],
        defaultPin: [],
        defaultHidden: [],
        rowSize: 40,
        paging: 'virtual',
        renderVersion: 0,
        renderCell: (column, row) => h('span', String(row[column.key] ?? '')),
      }),
    })

    app.mount(root)
    await nextTick()
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const table = root.querySelector<HTMLTableElement>('[data-virtualized="true"]')
    const initialRows = root.querySelectorAll<HTMLElement>('.endge-shadcn-table__row')
    expect(table?.dataset.rowCount).toBe('6000')
    expect(table?.dataset.pageRowCount).toBe('6000')
    expect(root.querySelector('.endge-shadcn-table')?.getAttribute('data-paging')).toBe('virtual')
    expect(root.querySelector('.endge-shadcn-table__pagination')).toBeNull()
    expect(initialRows.length).toBeGreaterThan(0)
    expect(initialRows.length).toBeLessThan(40)

    const viewport = root.querySelector<HTMLElement>('.endge-shadcn-table__viewport')!
    viewport.scrollTop = 5_000 * 40
    viewport.dispatchEvent(new Event('scroll'))
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    const scrolledIndexes = [...root.querySelectorAll<HTMLElement>('.endge-shadcn-table__row')]
      .map(row => Number(row.dataset.index))
    expect(Math.min(...scrolledIndexes)).toBeGreaterThan(4_980)
    expect(scrolledIndexes.length).toBeLessThan(40)

    app.unmount()
  })

  it('публикует независимые от renderer Events строк и выбора без начальных вхождений', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
    const routeChild = vi.fn(async (_source: unknown, _name: string, _payload: unknown) => undefined)
    const root = document.createElement('div')
    const app = createApp({
      render: () => h(ShadcnSfcDataTable, {
        boundaryId: 'events-test',
        nodeId: 'table-node',
        tableRef: 'table',
        tableId: 'flights',
        eventBoundary: { routeChild } as any,
        selectionMode: 'multiple',
        runtimeState: null,
        columns: createColumns(),
        source: [{ id: '1', flight: 'SU 100', gate: 'A1' }],
        styleContract: createStyleContract(),
        rowKey: 'id',
        sortMode: 'multiple',
        pinMode: 'disabled',
        columnMenu: { mode: 'disabled', menu: null, diagnostics: [] },
        defaultSort: [],
        defaultPin: [],
        defaultHidden: [],
        rowSize: 40,
        renderVersion: 0,
        renderCell: (column, row) => h('span', String(row[column.key] ?? '')),
      }),
    })
    app.mount(root)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(routeChild).not.toHaveBeenCalled()

    const row = root.querySelector<HTMLElement>('.endge-shadcn-table__row')!
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 24 }))
    await nextTick()
    expect(routeChild.mock.calls.map(call => call[1])).toEqual(['rowContextMenuRequested'])

    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await nextTick()

    expect(routeChild.mock.calls.map(call => call[1])).toEqual([
      'rowContextMenuRequested',
      'selectionChanged',
      'rowActivated',
    ])
    expect(routeChild.mock.calls[1]?.[2]).toMatchObject({
      tableId: 'flights',
      mode: 'multiple',
      selectedRowIds: ['1'],
    })
    expect(routeChild.mock.calls[0]?.[2]).toMatchObject({
      rowId: '1',
      anchor: { x: 12, y: 24 },
    })
    app.unmount()
  })
})

function createColumns(): EndgeShadcnTableColumn[] {
  return ['flight', 'gate'].map((key, index) => ({
    index,
    key,
    title: key === 'flight' ? 'Flight' : 'Gate',
    width: 160,
    minWidth: 80,
    maxWidth: 400,
    pinnable: false,
    sort: null,
    cellNode: null,
    cellNodes: [],
    styleSurfaces: {
      headerCell: createSurface('header-cell', index + 1, 2),
      headerContent: createSurface('header-content'),
    } satisfies SFCTableColumnStyleSurfaces,
  }))
}

function createStyleContract(): SFCTableStyleContract {
  const context: SFCVueRenderContext = createSFCVueRenderContext(
    {},
    0,
    null,
    null,
    [],
    'virtualization-test',
    [],
  )

  return {
    context,
    grid: createSurface('grid'),
    header: createSurface('header'),
    body: createSurface('body'),
    groupRow: createSurface('group-row'),
  }
}

function createSurface(
  part: SFCTablePublicPart,
  index = 1,
  siblingCount = 1,
): SFCTablePublicSurface {
  const node: EndgeStyleMatchNode = {
    tag: 'Table',
    classes: new Set(),
    attributes: {},
    states: new Set(),
    parts: new Set([part]),
    index,
    siblingCount,
  }
  return {
    node,
    attrs: {
      part,
      'data-endge-part': part,
      'class': [],
    },
  }
}
