import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import type { SFCVueRenderContext } from '@/services/render/sfc/sfc-shadcn-render.type'

/** Ключ строки не должен смешиваться с разделителями иерархии consumer. */
export function computationScopeKey(key: unknown): string {
  return encodeURIComponent(String(key))
}

/** Удаляет ресурсы ушедших строк/колонок, сохраняя cache текущего набора данных, включая offscreen строки. */
export function reconcileTableComputations(
  context: SFCVueRenderContext | null | undefined,
  rows: readonly Record<string, unknown>[],
  rowKey: string,
  columns: readonly { key: string }[],
): void {
  if (!context?.host) {
    return
  }
  const rowIds = new Set(rows.map((row, index) => computationScopeKey(row[rowKey] ?? index)))
  const columnIds = new Set(columns.map(column => computationScopeKey(column.key)))
  context.host.releaseComputationResources(context.consumerScope, (key) => {
    const path = key.slice(context.consumerScope.length + 1)
    if (!path.startsWith('row:')) {
      return true
    }
    const [row, column] = path.split('/')
    return rowIds.has(row!.slice(4)) && columnIds.has(column?.slice(7) ?? '')
  })
}

/** For сохраняет только реально присутствующие consumer-ветви. */
export function reconcileForComputations(context: SFCVueRenderContext, nodeId: string, keys: readonly unknown[]): void {
  const scope = `${context.consumerScope}/for:${nodeId}`
  const active = new Set(keys.map(computationScopeKey))
  context.host?.releaseComputationResources(scope, (key) => {
    const child = key.slice(scope.length + 1).split(/[/:]/, 1)[0]!
    return active.has(child)
  })
}

/** Убирает ресурсы скрытой ветви; Component и Table являются отдельными consumer scopes. */
export function releaseNodeComputations(context: SFCVueRenderContext, node: RComponentSFC_IR_ElementNode): void {
  for (const kind of ['component', 'table', 'for']) {
    context.host?.releaseComputationResources(`${context.consumerScope}/${kind}:${node.id}`)
  }
  for (const child of node.children ?? []) {
    if (child.kind === 'element') {
      releaseNodeComputations(context, child)
    }
  }
}
