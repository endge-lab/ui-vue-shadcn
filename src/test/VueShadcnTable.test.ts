import type { ComponentSFCRuntimeHost } from '@endge/core'
import {
  compileComponentSFC,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-shadcn-render.type'
import {
  VUE_SHADCN_SFC_ADAPTER_ID,
  VueShadcnSFCAdapter,
} from '@/services/render/sfc/vue-shadcn-sfc-adapter'
import VueShadcnShell from '@/ui/layout/VueShadcnShell.vue'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'

const TABLE_SOURCE = `<script setup lang="ts">
defineProps<{
  rows: unknown[]
}>()
</script>

<template>
  <Table id="flights" :rows="rows" row-key="id" sort-mode="multiple">
    <Column key="flight" title="Flight" sortable>
      <Cell><Badge tone="info">{{ row.flight }}</Badge></Cell>
    </Column>
    <Column key="gate" title="Gate">
      <Cell><Text>{{ row.gate }}</Text></Cell>
    </Column>
  </Table>
</template>`
const LAZY_TABLE_SOURCE = TABLE_SOURCE.replace(
  'sort-mode="multiple"',
  'sort-mode="multiple" lazy page-size="1" page-sizes="1,2,5"',
)
const VIRTUAL_TABLE_SOURCE = TABLE_SOURCE.replace(
  'sort-mode="multiple"',
  'sort-mode="multiple" paging="virtual"',
)
const HIDDEN_GATE_TABLE_SOURCE = TABLE_SOURCE.replace(
  'sort-mode="multiple"',
  'sort-mode="multiple" default-hidden="gate"',
)

const ROWS = [
  { id: '2', flight: 'SU 200', gate: 'B12' },
  { id: '1', flight: 'SU 100', gate: 'A04' },
]

describe('vueShadcnRender_Table', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(VueShadcnSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: VUE_SHADCN_SFC_ADAPTER_ID,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue-shadcn',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nested SFC primitives inside TanStack cells and sorts rows', async () => {
    const mounted = await mountTable()

    expect(mounted.root.querySelectorAll('.endge-shadcn-badge')).toHaveLength(2)
    expect(readFlights(mounted.root)).toEqual(['SU 200', 'SU 100'])

    mounted.root.querySelector<HTMLButtonElement>('.endge-shadcn-table__sort')?.click()
    await nextTick()

    const menu = document.body.querySelector<HTMLElement>('.endge-shadcn-menu-root')
    expect(menu).not.toBeNull()
    expect([...menu!.querySelectorAll('[role="menuitem"]')].map(item => item.textContent?.trim()))
      .toEqual(['Sort ascending', 'Sort descending', 'Hide'])
    expect(mounted.root.querySelector('.endge-shadcn-table__menu')).toBeNull()
    ;[...menu!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find(item => item.textContent?.includes('Sort ascending'))
      ?.click()
    await nextTick()
    await nextTick()

    expect(readFlights(mounted.root)).toEqual(['SU 100', 'SU 200'])
    expect(mounted.root.querySelector('.endge-shadcn-table__sort-index')).toBeNull()
    mounted.unmount()
  })

  it('restores column order and allows visibility changes from the column manager', async () => {
    const runtimeState = {
      runtimeId: 'runtime-test',
      storageKey: 'runtime-test',
      get: vi.fn((_entity: string, section: string, fallback: unknown) => {
        return section === 'order' ? ['gate', 'flight'] : fallback
      }),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    }
    const host = {
      id: 'host-test',
      entityIdentity: 'table-test',
      runtimeState,
      getArtifact: vi.fn(() => null),
    } as unknown as ComponentSFCRuntimeHost
    const mounted = await mountTable(host)

    expect(readHeaders(mounted.root)).toEqual(['Gate', 'Flight'])

    mounted.root.querySelector<HTMLButtonElement>('.endge-shadcn-table-column-manager__trigger')?.click()
    await nextTick()
    const gateVisibility = [...mounted.root.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')]
      .find(button => button.textContent?.includes('Gate'))
    gateVisibility?.click()
    await nextTick()

    expect(readHeaders(mounted.root)).toEqual(['Flight'])
    expect(runtimeState.set).toHaveBeenCalledWith('table:flights', 'visibility', { gate: false })
    mounted.unmount()
  })

  it('uses default-hidden as the initial TanStack visibility state', async () => {
    const mounted = await mountTable(null, HIDDEN_GATE_TABLE_SOURCE)

    expect(readHeaders(mounted.root)).toEqual(['Flight'])

    mounted.root.querySelector<HTMLButtonElement>('.endge-shadcn-table-column-manager__trigger')?.click()
    await nextTick()
    const gateVisibility = [...mounted.root.querySelectorAll<HTMLButtonElement>('[role="checkbox"]')]
      .find(button => button.textContent?.includes('Gate'))

    expect(gateVisibility?.getAttribute('aria-checked')).toBe('false')
    gateVisibility?.click()
    await nextTick()
    expect(readHeaders(mounted.root)).toEqual(['Flight', 'Gate'])
    mounted.unmount()
  })

  it('recognizes lazy and paginates materialized rows with declarative page settings', async () => {
    const mounted = await mountTable(null, LAZY_TABLE_SOURCE)

    expect(mounted.root.querySelector('.endge-shadcn-table')?.getAttribute('data-lazy')).toBe('true')
    expect(readFlights(mounted.root)).toEqual(['SU 200'])
    expect(mounted.root.querySelector('.endge-shadcn-table__page-label')?.textContent).toContain('Page 1 of 2')
    expect([...mounted.root.querySelectorAll('.endge-shadcn-table__page-size option')].map(option => option.textContent?.trim()))
      .toEqual(['1', '2', '5'])

    mounted.root.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.click()
    await nextTick()

    expect(readFlights(mounted.root)).toEqual(['SU 100'])
    expect(mounted.root.querySelector('.endge-shadcn-table__page-label')?.textContent).toContain('Page 2 of 2')
    mounted.unmount()
  })

  it('uses 10 rows per page by default', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      id: String(index),
      flight: `SU ${String(index).padStart(3, '0')}`,
      gate: `A${index}`,
    }))
    const mounted = await mountTable(null, TABLE_SOURCE, rows)

    expect(readFlights(mounted.root)).toHaveLength(10)
    expect(mounted.root.querySelector<HTMLSelectElement>('.endge-shadcn-table__page-size select')?.value).toBe('10')
    expect(mounted.root.querySelector('.endge-shadcn-table__page-label')?.textContent).toContain('Page 1 of 2')
    mounted.unmount()
  })

  it('renders the complete local collection as one virtualized row model', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      id: String(index),
      flight: `SU ${String(index).padStart(3, '0')}`,
      gate: `A${index}`,
    }))
    const mounted = await mountTable(null, VIRTUAL_TABLE_SOURCE, rows)
    const table = mounted.root.querySelector<HTMLTableElement>('[data-virtualized="true"]')

    expect(mounted.root.querySelector('.endge-shadcn-table')?.getAttribute('data-paging')).toBe('virtual')
    expect(table?.dataset.pageRowCount).toBe('11')
    expect(mounted.root.querySelector('.endge-shadcn-table__pagination')).toBeNull()
    mounted.unmount()
  })
})

async function mountTable(
  host: ComponentSFCRuntimeHost | null = null,
  source = TABLE_SOURCE,
  rows = ROWS,
) {
  const result = compileComponentSFC(source)
  if (!result.ir) {
    throw new Error(`Table source failed to compile: ${JSON.stringify(result.diagnostics)}`)
  }

  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({
    render: () => h(VueShadcnShell, { project: 'test', env: 'test' }, {
      default: () => h(SFC_Renderer, {
        ir: result.ir,
        props: { rows },
        host,
      }),
    }),
  })
  app.mount(root)
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()

  return {
    root,
    unmount: () => {
      app.unmount()
      root.remove()
    },
  }
}

function readFlights(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.endge-shadcn-table__row .endge-shadcn-badge')]
    .map(cell => cell.textContent?.trim() ?? '')
}

function readHeaders(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.endge-shadcn-table__head-title')]
    .map(cell => cell.textContent?.trim() ?? '')
}
