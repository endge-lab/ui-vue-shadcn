import type { EndgeStyleMatchNode } from '@endge/core'

import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-shadcn-render.type'
import { getEndgeDOMStyleClasses } from '@/services/style/endge-dom-style'

export type SFCTablePublicPart
  = | 'grid'
    | 'header'
    | 'header-cell'
    | 'header-content'
    | 'body'
    | 'row'
    | 'cell'
    | 'cell-content'
    | 'group-row'

export interface SFCTablePublicPartAttrs extends Record<string, unknown> {
  'part': SFCTablePublicPart
  'data-endge-part': SFCTablePublicPart
  'class': string[]
  'data-endge-state'?: string
}

export interface SFCTablePublicSurface {
  node: EndgeStyleMatchNode
  attrs: SFCTablePublicPartAttrs
}

export interface SFCTableStyleContract {
  context: SFCVueRenderContext
  grid: SFCTablePublicSurface
  header: SFCTablePublicSurface
  body: SFCTablePublicSurface
  groupRow: SFCTablePublicSurface
}

export interface SFCTableColumnStyleSurfaces {
  headerCell: SFCTablePublicSurface
  headerContent: SFCTablePublicSurface
}

export interface SFCTableCellStyleSurfaces {
  cell: SFCTablePublicSurface
  cellContent: SFCTablePublicSurface
}

interface SFCTableRowStyleMeta {
  row: SFCTablePublicSurface
  columnCount: number
  contract: SFCTableStyleContract
}

export const SFC_TABLE_ROW_CLASS_FIELD = '__endgeStyleRowClass'
const SFC_TABLE_ROW_STYLE_META = Symbol('endge.table.row-style-meta')
const APPLIED_STYLE_CLASSES_ATTRIBUTE = 'data-endge-applied-style-classes'
const MAX_CELL_SURFACE_CACHE_SIZE = 512
const cellSurfaceCaches = new WeakMap<SFCTableStyleContract, Map<string, SFCTableCellStyleSurfaces>>()

export function createSFCTableStyleContract(context: SFCVueRenderContext): SFCTableStyleContract {
  const grid = createSurface(context, 'grid', 1, 1)
  const header = createSurface(context, 'header', 1, 1, undefined, grid.node)
  const body = createSurface(context, 'body', 1, 1, undefined, grid.node)
  const groupRow = createSurface(context, 'group-row', 1, 1, undefined, body.node)
  return { context, grid, header, body, groupRow }
}

export function createSFCTableColumnStyleSurfaces(
  contract: SFCTableStyleContract,
  columnCount: number,
): SFCTableColumnStyleSurfaces[] {
  let previousHeaderCell: EndgeStyleMatchNode | undefined
  const result: SFCTableColumnStyleSurfaces[] = []

  for (let index = 0; index < columnCount; index++) {
    const headerCell = createSurface(
      contract.context,
      'header-cell',
      index + 1,
      columnCount,
      previousHeaderCell,
      contract.header.node,
    )
    previousHeaderCell = headerCell.node
    const headerContent = createSurface(
      contract.context,
      'header-content',
      1,
      1,
      undefined,
      headerCell.node,
    )
    result.push({ headerCell, headerContent })
  }

  return result
}

export function decorateSFCTableRows(
  rows: readonly Record<string, unknown>[],
  columnCount: number,
  contract: SFCTableStyleContract,
): Record<string, unknown>[] {
  cellSurfaceCaches.delete(contract)

  // RevoGrid всё равно предоставляет публичные parts без правил EndgeCSS. Избегаем
  // создания логических узлов сопоставления и копий строк в этом обычном быстром пути.
  if (!contract.context.styleArtifacts.some(artifact => artifact.rules.length > 0)) {
    return [...rows]
  }

  let previousRow: EndgeStyleMatchNode | undefined

  return rows.map((row, rowIndex) => {
    const rowSurface = createSurface(
      contract.context,
      'row',
      rowIndex + 1,
      rows.length,
      previousRow,
      contract.body.node,
    )
    previousRow = rowSurface.node

    const decorated = {
      ...row,
      [SFC_TABLE_ROW_CLASS_FIELD]: rowSurface.attrs.class.join(' '),
    }
    Object.defineProperty(decorated, SFC_TABLE_ROW_STYLE_META, {
      configurable: false,
      enumerable: false,
      value: { row: rowSurface, columnCount, contract } satisfies SFCTableRowStyleMeta,
      writable: false,
    })
    return decorated
  })
}

/**
 * Оформляет только одно непрерывное окно viewport, сохраняя логические индексы
 * строк полной таблицы. Адаптеры TanStack избегают благодаря этому материализации
 * узлов сопоставления EndgeCSS для каждой строки до первой отрисовки.
 */
export function decorateSFCTableRowWindow(
  rows: readonly Record<string, unknown>[],
  columnCount: number,
  contract: SFCTableStyleContract,
  startIndex: number,
  totalRowCount: number,
): Record<string, unknown>[] {
  if (!contract.context.styleArtifacts.some(artifact => artifact.rules.length > 0)) {
    return [...rows]
  }

  const normalizedTotal = Math.max(rows.length, Math.trunc(totalRowCount))
  const normalizedStart = Math.max(0, Math.min(Math.trunc(startIndex), normalizedTotal))
  let previousRow = normalizedStart > 0
    ? createSurface(
      contract.context,
      'row',
      normalizedStart,
      normalizedTotal,
      undefined,
      contract.body.node,
    ).node
    : undefined

  return rows.map((row, localIndex) => {
    const absoluteIndex = normalizedStart + localIndex
    const rowSurface = createSurface(
      contract.context,
      'row',
      absoluteIndex + 1,
      normalizedTotal,
      previousRow,
      contract.body.node,
    )
    previousRow = rowSurface.node

    const decorated = {
      ...row,
      [SFC_TABLE_ROW_CLASS_FIELD]: rowSurface.attrs.class.join(' '),
    }
    Object.defineProperty(decorated, SFC_TABLE_ROW_STYLE_META, {
      configurable: false,
      enumerable: false,
      value: { row: rowSurface, columnCount, contract } satisfies SFCTableRowStyleMeta,
      writable: false,
    })
    return decorated
  })
}

export function getSFCTableCellStyleSurfaces(
  row: Record<string, unknown>,
  columnIndex: number,
  states: Iterable<string> = [],
): SFCTableCellStyleSurfaces | null {
  const metadata = (row as unknown as Record<PropertyKey, unknown>)[SFC_TABLE_ROW_STYLE_META] as SFCTableRowStyleMeta | undefined
  if (!metadata || columnIndex < 0 || columnIndex >= metadata.columnCount) {
    return null
  }

  const cache = getCellSurfaceCache(metadata.contract)
  const normalizedStates = [...new Set(states)].sort()
  const cacheKey = `${metadata.row.node.index}:${metadata.row.node.siblingCount}:${metadata.columnCount}:${columnIndex}:${normalizedStates.join(',')}`
  const cached = cache.get(cacheKey)
  if (cached) {
    // Обновляем порядок вставки, чтобы активные ячейки viewport оставались в ограниченном LRU.
    cache.delete(cacheKey)
    cache.set(cacheKey, cached)
    return cached
  }

  // RevoGrid виртуализирует ячейки. Строим нейтральную цепочку соседей только для ячейки,
  // которую renderer должен отобразить сейчас, и не сохраняем эту цепочку
  // ни в одной из более чем 10 тысяч исходных строк.
  let previousCell: EndgeStyleMatchNode | undefined
  let cell: SFCTablePublicSurface | undefined
  for (let index = 0; index <= columnIndex; index++) {
    cell = createSurface(
      metadata.contract.context,
      'cell',
      index + 1,
      metadata.columnCount,
      previousCell,
      metadata.row.node,
      normalizedStates,
    )
    previousCell = cell.node
  }

  if (!cell) {
    return null
  }

  const result = {
    cell,
    cellContent: createSurface(
      metadata.contract.context,
      'cell-content',
      1,
      1,
      undefined,
      cell.node,
      normalizedStates,
    ),
  }
  cache.set(cacheKey, result)
  if (cache.size > MAX_CELL_SURFACE_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
  return result
}

export function toRevoGridSurfaceProps(attrs: SFCTablePublicPartAttrs): Record<string, unknown> {
  return {
    'part': attrs.part,
    'data-endge-part': attrs['data-endge-part'],
    'data-endge-state': attrs['data-endge-state'],
    'class': Object.fromEntries(attrs.class.map(className => [className, true])),
  }
}

/** Применяет логические поверхности к DOM, принадлежащему RevoGrid, не пропуская vendor-селекторы в EndgeCSS. */
export function syncSFCTableDOMSurfaces(
  grid: HTMLElement,
  contract: SFCTableStyleContract,
): void {
  applySurfaceAttrs(grid, contract.grid.attrs)
  grid.querySelectorAll<HTMLElement>('revogr-header')
    .forEach(element => applySurfaceAttrs(element, contract.header.attrs))
  grid.querySelectorAll<HTMLElement>('revogr-data')
    .forEach((element) => {
      const rowType = element.getAttribute('type') ?? (element as HTMLElement & { type?: string }).type
      if (rowType === 'rgRow') {
        applySurfaceAttrs(element, contract.body.attrs)
      }
    })
  grid.querySelectorAll<HTMLElement>('.rgRow')
    .forEach((element) => {
      const part: SFCTablePublicPart = element.classList.contains('groupingRow') ? 'group-row' : 'row'
      if (part === 'group-row') {
        applySurfaceAttrs(element, contract.groupRow.attrs)
        return
      }

      element.setAttribute('part', part)
      element.setAttribute('data-endge-part', part)
    })
}

function createSurface(
  context: SFCVueRenderContext,
  part: SFCTablePublicPart,
  index: number,
  siblingCount: number,
  previousSibling?: EndgeStyleMatchNode,
  parent?: EndgeStyleMatchNode,
  dynamicStates: Iterable<string> = [],
): SFCTablePublicSurface {
  const host = context.styleParent
  const states = new Set([...(host?.states ?? []), ...dynamicStates])
  const node: EndgeStyleMatchNode = {
    tag: host?.tag ?? 'Table',
    id: host?.id,
    classes: host?.classes ?? new Set<string>(),
    attributes: host?.attributes ?? {},
    states,
    parts: new Set([part]),
    component: host?.component,
    identity: host?.identity,
    ownerScopeId: host?.ownerScopeId ?? context.styleOwnerScopeId,
    parent: parent ?? host?.parent,
    previousSibling,
    index,
    siblingCount,
  }
  return {
    node,
    attrs: {
      part,
      'data-endge-part': part,
      'class': getEndgeDOMStyleClasses(context.styleArtifacts, node),
      ...(states.size ? { 'data-endge-state': [...states].join(' ') } : {}),
    },
  }
}

function applySurfaceAttrs(element: HTMLElement, attrs: SFCTablePublicPartAttrs): void {
  const previousClasses = element.getAttribute(APPLIED_STYLE_CLASSES_ATTRIBUTE)?.split(/\s+/).filter(Boolean) ?? []
  previousClasses.forEach(className => element.classList.remove(className))
  attrs.class.forEach(className => element.classList.add(className))
  element.setAttribute(APPLIED_STYLE_CLASSES_ATTRIBUTE, attrs.class.join(' '))
  element.setAttribute('part', attrs.part)
  element.setAttribute('data-endge-part', attrs['data-endge-part'])
  if (attrs['data-endge-state']) {
    element.setAttribute('data-endge-state', attrs['data-endge-state'])
  }
  else { element.removeAttribute('data-endge-state') }
}

function getCellSurfaceCache(
  contract: SFCTableStyleContract,
): Map<string, SFCTableCellStyleSurfaces> {
  let cache = cellSurfaceCaches.get(contract)
  if (!cache) {
    cache = new Map()
    cellSurfaceCaches.set(contract, cache)
  }
  return cache
}
