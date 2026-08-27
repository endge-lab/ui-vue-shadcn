import type { ComponentSFCProgramPayload, ProgramArtifact } from '@endge/core'
import {
  compileComponentSFC,
  ComponentSFCRuntimeHost,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  RComponentSFC,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/model/render/sfc/sfc-shadcn-render.type'
import {
  VUE_SHADCN_SFC_ADAPTER_ID,
  VueShadcnSFCAdapter,
} from '@/model/render/sfc/vue-shadcn-sfc-adapter'
import VueShadcnShell from '@/ui/layout/VueShadcnShell.vue'
import SFC_RuntimeRenderer from '@/ui/render/sfc/SFC_RuntimeRenderer.vue'

const SOURCE = `<script setup lang="ts">
defineProps<{ rows: Array<{ id: number, status: string }> }>()
</script>

<template>
  <Table id="telegraph" :rows="rows" row-key="id" paging="virtual">
    <Column key="status" title="Status">
      <Text
        :value="value"
        editable
        edit-on="click"
        @edited="emit('edited', {
          id: rowKey,
          patch: { [columnKey]: event('value') },
        })"
      />
    </Column>
  </Table>
</template>`

describe('shadcn SFC Editable integration', () => {
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
    Endge.program.clear()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens the primitive editor in a virtualized cell and publishes edited on commit', async () => {
    const mounted = await mountRuntimeTable()
    const display = mounted.root.querySelector<HTMLElement>('.endge-shadcn-text')
    expect(display?.textContent).toBe('RUN')

    display?.click()
    await nextTick()
    await nextTick()

    const editor = mounted.root.querySelector<HTMLInputElement>('.endge-sfc-editable-input')
    expect(editor).not.toBeNull()
    expect(editor?.value).toBe('RUN')

    editor!.value = 'STOP'
    editor!.dispatchEvent(new Event('input', { bubbles: true }))
    editor!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    await Promise.resolve()

    expect(mounted.received).toEqual([{ id: 15, patch: { status: 'STOP' } }])
    mounted.unmount()
  })
})

async function mountRuntimeTable() {
  const compiled = compileComponentSFC(SOURCE)
  if (!compiled.ir) {
    throw new Error(`Editable table source failed to compile: ${JSON.stringify(compiled.diagnostics)}`)
  }

  const model = RComponentSFC.fromPlain({
    id: 91,
    identity: 'shadcn-editable-table',
    name: 'Shadcn editable table',
    source: SOURCE,
  })
  const payload: ComponentSFCProgramPayload = {
    sourceParts: compiled.sourceParts,
    sections: compiled.sections,
    contract: compiled.contract,
    dependencies: compiled.dependencies,
    runtimeDependencies: compiled.runtimeDependencies,
    previewProps: compiled.previewProps,
    previewOptions: compiled.previewOptions,
    ast: compiled.ast,
    ir: compiled.ir,
  }
  const artifact: ProgramArtifact<ComponentSFCProgramPayload> = {
    ref: { entityType: 'component-sfc', id: model.id, identity: model.identity },
    sourceHash: 'test',
    compilerVersion: 'test',
    status: 'valid',
    diagnostics: [],
    dependencies: [],
    capabilities: ['compilable', 'executable', 'renderable'],
    metadata: { self: {}, nodes: [] },
    payload,
  }
  const host = ComponentSFCRuntimeHost.createRuntime({
    id: 'shadcn-editable-runtime',
    model,
    artifactReader: { getArtifact: <T>() => artifact as unknown as ProgramArtifact<T> },
  })
  const received: unknown[] = []
  host.onEventPort('edited', occurrence => received.push(occurrence.payload))

  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({
    render: () => h(VueShadcnShell, { project: 'test', env: 'test' }, {
      default: () => h(SFC_RuntimeRenderer, {
        host,
        input: { kind: 'local', props: { rows: [{ id: 15, status: 'RUN' }] } },
      }),
    }),
  })
  app.mount(root)
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()

  return {
    root,
    received,
    unmount: () => {
      app.unmount()
      host.destroy()
      root.remove()
    },
  }
}
