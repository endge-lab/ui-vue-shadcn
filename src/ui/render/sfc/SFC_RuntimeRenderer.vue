<script setup lang="ts">
import type { SFCVueRuntimeRendererProps } from '@/services/render/sfc/sfc-shadcn-render.type'
import { onBeforeUnmount, provide, ref, shallowRef, watch } from 'vue'
import { SFCVueRuntimeBridge } from '@/services/render/sfc/SFCVueRuntimeBridge'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'
import {
  createSFCVueBoundaryRegistry,
  SFCVueBoundaryRegistryKey,
} from '@/ui/render/sfc/SFCRender_BoundaryRegistry'

const props = defineProps<SFCVueRuntimeRendererProps>()

const renderProps = shallowRef<Record<string, unknown>>({})
const renderVersion = ref(0)
const boundaryRegistry = createSFCVueBoundaryRegistry()

provide(SFCVueBoundaryRegistryKey, boundaryRegistry)

let bridge: SFCVueRuntimeBridge | null = null
let bridgeHost: SFCVueRuntimeRendererProps['host'] = null

watch(
  () => [props.host, props.input] as const,
  ([host, input]) => {
    if (bridge && host === bridgeHost) {
      bridge.updateInput(input)
      return
    }

    destroyBridge()

    if (!host) {
      renderProps.value = {}
      renderVersion.value++
      return
    }

    bridge = new SFCVueRuntimeBridge({
      host,
      input,
      onUpdate: (nextProps) => {
        renderProps.value = nextProps
        renderVersion.value++
      },
      onBoundaryPatch: async (patch) => {
        return await boundaryRegistry.applyPatch(patch)
      },
    })
    bridgeHost = host
    bridge.mount()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  destroyBridge()
})

function destroyBridge(): void {
  bridge?.destroy()
  bridge = null
  bridgeHost = null
}
</script>

<template>
  <SFC_Renderer
    :ir="host?.getIr() ?? null"
    :props="renderProps"
    :render-version="renderVersion"
    :host="host"
    :inspection="inspection ?? null"
  />
</template>
