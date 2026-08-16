import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Node, TableSelectionTrigger } from '@endge/core'
import {
  normalizeComponentSFCTableColumnMenu,
  normalizeComponentSFCTableRowMenu,
  normalizeComponentSFCTableColumnPin,
  normalizeComponentSFCTableColumnPinMode,
  normalizeComponentSFCTableColumnVisibility,
  normalizeComponentSFCTableSort,
  normalizeComponentSFCTableSortMode,
} from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import {
  createSFCTableColumnStyleSurfaces,
  createSFCTableStyleContract,
  getSFCTableCellStyleSurfaces,
} from '@/ui/render/sfc/SFCRender_TableStyle'
import { evaluateSFCProps, evaluateSFCValue, readSFCObjectPath } from '@/ui/render/sfc/SFCRender_Evaluator'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { normalizeSFCTableCellAlignment } from '@/ui/render/sfc/SFCRender_TableAlignment'

import type { EndgeShadcnTableColumn, EndgeShadcnTablePaging } from '@/ui/table/table.types'
import ShadcnSfcDataTable from '@/ui/table/ShadcnSfcDataTable.vue'

/** Shadcn/TanStack implementation of the compound SFC Table tag. */
export const VueShadcnRender_Table: SFCVueRenderFunction = SFCRender_Base((input) => {
  const rows = normalizeRows(input.props.rows)
  const explicitHeight = input.props.height ?? input.props.h
  const fillsAvailableHeight = explicitHeight == null || explicitHeight === ''
  const rowKey = normalizeText(input.props['row-key'] ?? input.props.rowKey, 'id')
  const sortDescriptor = normalizeComponentSFCTableSort(input.node)
  const pinDescriptor = normalizeComponentSFCTableColumnPin(input.node)
  const visibilityDescriptor = normalizeComponentSFCTableColumnVisibility(input.node)
  const columnMenuDescriptor = input.node.tableMenus?.column ?? normalizeComponentSFCTableColumnMenu(input.node)
  const rowMenuDescriptor = input.node.tableMenus?.row ?? normalizeComponentSFCTableRowMenu(input.node)
  const styleContract = createSFCTableStyleContract(input.context)
  const columns = collectTableColumns(input.node, input.context, sortDescriptor, pinDescriptor, styleContract)
  const tableId = normalizeText(input.props.id ?? input.props.tableId ?? input.attrs.id, '')
  const cellAlignment = normalizeSFCTableCellAlignment(
    input.props['cell-align'] ?? input.props.cellAlign,
    input.props['cell-vertical-align'] ?? input.props.cellVerticalAlign,
  )
  const tableContext = extendSFCVueRenderContext(
    input.context,
    {},
    input.context.iteration,
    `${input.context.consumerScope}/table:${input.node.id}`,
  )

  return input.h('div', {
    ...input.attrs,
    'data-endge-layout-fill-height': fillsAvailableHeight ? '' : undefined,
    class: ['endge-sfc-table', 'endge-shadcn-sfc-table', input.props.class],
    style: {
      ...(isPlainObject(input.attrs.style) ? input.attrs.style : {}),
      width: normalizeCssSize(input.props.width ?? input.props.w, '100%'),
      height: normalizeCssSize(explicitHeight, '100%'),
      minHeight: normalizeCssSize(input.props.minHeight ?? input.props.minH, '180px'),
      flex: fillsAvailableHeight ? '1 1 0%' : undefined,
      overflow: 'hidden',
    },
  }, [
    input.h(ShadcnSfcDataTable, {
      boundaryId: input.node.id,
      nodeId: input.node.id,
      tableRef: normalizeOptionalText(input.props.ref ?? input.attrs.ref),
      tableId,
      eventBoundary: input.context.eventBoundary,
      eventBindings: input.node.events ?? [],
      selectionMode: normalizeSelectionMode(input.props['selection-mode'] ?? input.props.selectionMode),
      selectionTrigger: normalizeSelectionTrigger(input.props['selection-trigger'] ?? input.props.selectionTrigger),
      runtimeState: input.context.runtimeState,
      columns,
      source: rows,
      styleContract,
      rowKey,
      sortMode: normalizeComponentSFCTableSortMode(input.props['sort-mode'] ?? input.props.sortMode ?? sortDescriptor.mode),
      pinMode: normalizeComponentSFCTableColumnPinMode(input.props['column-pin'] ?? input.props.columnPin ?? pinDescriptor.mode),
      columnMenu: columnMenuDescriptor,
      rowMenu: rowMenuDescriptor,
      menuContext: tableContext,
      defaultSort: sortDescriptor.defaultSort,
      defaultPin: pinDescriptor.defaultPin,
      defaultHidden: visibilityDescriptor.defaultHidden,
      rowSize: normalizeNumber(input.props.rowSize, 40),
      paging: normalizeTablePaging(input.props.paging),
      pageSize: normalizeNumber(input.props['page-size'] ?? input.props.pageSize, 10),
      pageSizes: normalizePageSizes(input.props['page-sizes'] ?? input.props.pageSizes),
      lazy: input.props.lazy === true,
      renderVersion: input.context.renderVersion,
      renderCell: (
        column: EndgeShadcnTableColumn,
        row: Record<string, unknown>,
        rowIndex: number,
        rowId: string,
      ) => {
        const cellContext = extendSFCVueRenderContext(tableContext, {
          row,
          rowIndex,
          // TanStack requires its internal row id to be a string, but the SFC
          // lexical rowKey must preserve the authored data type. Store
          // selectors commonly compare numeric ids and must receive a number.
          rowKey: resolveLexicalRowKey(row[rowKey], rowId),
          columnKey: column.key,
          value: readSFCObjectPath(column.key, row),
        }, tableContext.iteration, `${tableContext.consumerScope}/row:${rowId}/column:${column.key}`)
        const children = renderSFCNodes(input.h, column.cellNodes, cellContext)
        const contentAttrs = getSFCTableCellStyleSurfaces(row, column.index)?.cellContent.attrs

        return input.h('div', {
          part: contentAttrs?.part ?? 'cell-content',
          'data-endge-part': contentAttrs?.['data-endge-part'] ?? 'cell-content',
          class: ['endge-sfc-table-cell-content', 'endge-shadcn-table__cell-content', contentAttrs?.class],
          style: {
            display: 'flex',
            alignItems: mapVerticalAlignment(cellAlignment.vertical),
            justifyContent: mapHorizontalAlignment(cellAlignment.horizontal),
            width: '100%',
            minWidth: 0,
          },
        }, children)
      },
    }),
  ])
})

function collectTableColumns(
  tableNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  sortDescriptor: ReturnType<typeof normalizeComponentSFCTableSort>,
  pinDescriptor: ReturnType<typeof normalizeComponentSFCTableColumnPin>,
  styleContract: ReturnType<typeof createSFCTableStyleContract>,
): EndgeShadcnTableColumn[] {
  const nodes = tableNode.children.filter(isElementNode).filter(node => node.tag === 'Column')
  const styleSurfaces = createSFCTableColumnStyleSurfaces(styleContract, nodes.length)

  return nodes.map((node, index) => {
    const props = evaluateSFCProps(node.props, context)
    const key = normalizeColumnKey(node, context, props.key, `column_${index}`)
    const sort = sortDescriptor.columns.find(column => column.key === key) ?? null
    const pin = pinDescriptor.columns.find(column => column.key === key) ?? null
    const width = normalizeOptionalNumber(props.width ?? props.size)

    return {
      index,
      key,
      title: normalizeText(props.title ?? props.name, key),
      width,
      minWidth: normalizeNumber(props.minWidth ?? props.minSize, 64),
      maxWidth: normalizeNumber(props.maxWidth ?? props.maxSize, 1200),
      pinnable: pin?.pinnable ?? true,
      sort: sort
        ? { sortable: sort.sortable, comparator: sort.comparator, paths: [...sort.paths] }
        : null,
      cellNodes: resolveCellNodes(node),
      styleSurfaces: styleSurfaces[index]!,
    }
  })
}

function resolveCellNodes(columnNode: RComponentSFC_IR_ElementNode): RComponentSFC_IR_Node[] {
  const cell = columnNode.children.filter(isElementNode).find(node => node.tag === 'Cell')
  return (cell?.children ?? columnNode.children).filter(node => !isTableMenuNode(node))
}

function normalizeColumnKey(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  propValue: unknown,
  fallback: string,
): string {
  const evaluated = propValue ?? evaluateSFCValue(columnNode.directives.key, context)
  if (evaluated != null) return normalizeText(evaluated, fallback)
  const directiveKey = columnNode.directives.key
  if (directiveKey?.kind === 'expression' && directiveKey.reads.length === 0)
    return normalizeText(directiveKey.source.replace(/^['"]|['"]$/g, ''), fallback)
  return fallback
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map((row, index) => isPlainObject(row) ? row : { id: index, value: row })
}

function resolveLexicalRowKey(value: unknown, fallback: string): unknown {
  return String(value ?? '').trim() ? value : fallback
}

function normalizeText(value: unknown, fallback: string): string {
  const source = String(value ?? '').trim()
  return source || fallback
}

function normalizeOptionalText(value: unknown): string | null {
  const source = String(value ?? '').trim()
  return source || null
}

function normalizeSelectionMode(value: unknown): 'none' | 'single' | 'multiple' {
  return value === 'single' || value === 'multiple' ? value : 'none'
}

function normalizeSelectionTrigger(value: unknown): TableSelectionTrigger {
  return value === 'control' || value === 'row' || value === 'both' ? value : 'auto'
}

function normalizeNumber(value: unknown, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function normalizeTablePaging(value: unknown): EndgeShadcnTablePaging {
  return String(value ?? '').trim().toLowerCase() === 'virtual' ? 'virtual' : 'pages'
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function normalizePageSizes(value: unknown): number[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [10, 25, 50, 100]
  const sizes = source
    .map(Number)
    .filter(size => Number.isFinite(size) && size > 0)
    .map(Math.floor)
  return [...new Set(sizes)].sort((left, right) => left - right)
}

function normalizeCssSize(value: unknown, fallback: string): string {
  if (value == null || value === '') return fallback
  return typeof value === 'number' ? `${value}px` : String(value)
}

function mapHorizontalAlignment(value: string): 'flex-start' | 'center' | 'flex-end' {
  if (value === 'center') return 'center'
  return value === 'right' ? 'flex-end' : 'flex-start'
}

function mapVerticalAlignment(value: string): 'flex-start' | 'center' | 'flex-end' {
  if (value === 'middle') return 'center'
  return value === 'bottom' ? 'flex-end' : 'flex-start'
}

function isElementNode(node: RComponentSFC_IR_Node): node is RComponentSFC_IR_ElementNode {
  return node.kind === 'element'
}

function isTableMenuNode(node: RComponentSFC_IR_Node): boolean {
  return node.kind === 'element'
    && (node.tag === 'ColumnMenu' || node.tag === 'RowMenu' || node.tag === 'MenuItem' || node.tag === 'MenuSeparator')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
