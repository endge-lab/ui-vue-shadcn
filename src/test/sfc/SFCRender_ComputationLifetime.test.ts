import { compileComponentSFC, ComputationResourceRegistry } from '@endge/core'
import { describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowRef } from 'vue'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'
import { computationScopeKey, reconcileForComputations, reconcileTableComputations, releaseNodeComputations } from '@/ui/render/sfc/SFCRender_Computations'

function fixture(scope = 'renderer:1/table:grid') {
  const registry = new ComputationResourceRegistry()
  const host = { releaseComputationResources: vi.fn((scope: string, keep?: (key: string) => boolean) => registry.releaseScope(scope, keep)), getArtifact: () => null }
  const context = { host, consumerScope: scope } as any
  function add(key: string) {
    const dispose = vi.fn()
    registry.getOrCreate(key, {}, () => ({ updateInput() {}, dispose }) as any)
    return dispose
  }
  return { registry, host, context, add }
}

describe('время жизни computation consumers renderer', () => {
  it('удаляет ресурсы ушедших строк и колонок, оставляет offscreen строки и соседнюю таблицу', () => {
    const f = fixture()
    const cell = (row: string, column: string) => `${f.context.consumerScope}/row:${computationScopeKey(row)}/column:${computationScopeKey(column)}/component:cell:state:port`
    const removedRow = f.add(cell('old', 'value'))
    const removedColumn = f.add(cell('current', 'old'))
    const current = f.add(cell('current', 'value'))
    const offscreen = f.add(cell('off/screen:1', 'val/ue:1'))
    const neighbor = f.add('renderer:2/table:grid/row:old/column:value:port')
    reconcileTableComputations(f.context, [{ id: 'current' }, { id: 'off/screen:1' }], 'id', [{ key: 'value' }, { key: 'val/ue:1' }])
    expect(removedRow).toHaveBeenCalledOnce()
    expect(removedColumn).toHaveBeenCalledOnce()
    expect(current).not.toHaveBeenCalled()
    expect(offscreen).not.toHaveBeenCalled()
    expect(neighbor).not.toHaveBeenCalled()
    f.registry.dispose()
  })

  it('освобождает For с исчезнувшими ключами и скрытые ветви', () => {
    const f = fixture('renderer:1')
    const old = f.add('renderer:1/for:list:old/component:cell:state:port')
    const retained = f.add('renderer:1/for:list:a%2Fb%3Ac/component:cell:state:port')
    const adjacent = f.add('renderer:1/for:listing:old/component:cell:state:port')
    reconcileForComputations(f.context, 'list', ['a/b:c'])
    expect(old).toHaveBeenCalledOnce()
    expect(retained).not.toHaveBeenCalled()
    releaseNodeComputations(f.context, { id: 'list', kind: 'element', children: [] } as any)
    expect(retained).toHaveBeenCalledOnce()
    expect(adjacent).not.toHaveBeenCalled()
    f.registry.dispose()
  })

  it('изолирует два Vue renderer на одном host и очищает прежний host при замене', async () => {
    const first = fixture()
    const second = fixture()
    const host = shallowRef(first.host)
    const ir = compileComponentSFC('<template></template>').ir
    const element = document.createElement('div')
    const app = createApp({ render: () => h('div', [h(SFC_Renderer, { host: host.value as any, ir }), h(SFC_Renderer, { host: first.host as any, ir })]) })
    app.mount(element)
    host.value = second.host
    await nextTick()
    const firstScope = first.host.releaseComputationResources.mock.calls[0]![0]
    expect(firstScope).toMatch(/^renderer:/)
    app.unmount()
    expect(first.host.releaseComputationResources.mock.calls.map(call => call[0])).toHaveLength(2)
    expect(first.host.releaseComputationResources.mock.calls[1]![0]).not.toBe(firstScope)
    expect(second.host.releaseComputationResources).toHaveBeenCalledWith(firstScope)
  })
})
