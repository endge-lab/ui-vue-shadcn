import type { RuntimeBoundaryPatch } from '@endge/core'
import type { InjectionKey } from 'vue'

/** Controller render-boundary, который умеет применить runtime patch локально. */
export interface SFCVueBoundaryController {
  applyPatch: (patch: RuntimeBoundaryPatch) => boolean | Promise<boolean>
}

/** Registry runtime boundaries внутри одного SFC render root. */
export interface SFCVueBoundaryRegistry {
  register: (boundaryId: string, controller: SFCVueBoundaryController) => VoidFunction
  applyPatch: (patch: RuntimeBoundaryPatch) => Promise<boolean>
}

/** Vue injection key registry текущего SFC render root. */
export const SFCVueBoundaryRegistryKey: InjectionKey<SFCVueBoundaryRegistry>
  = Symbol('SFCVueBoundaryRegistry')

/** Создает локальный registry boundary controllers для одного render root. */
export function createSFCVueBoundaryRegistry(): SFCVueBoundaryRegistry {
  const controllers = new Map<string, SFCVueBoundaryController>()

  return {
    register(boundaryId, controller) {
      controllers.set(boundaryId, controller)
      return () => {
        if (controllers.get(boundaryId) === controller) {
          controllers.delete(boundaryId)
        }
      }
    },

    async applyPatch(patch) {
      const controller = controllers.get(patch.boundaryId)
      if (!controller) {
        return false
      }

      return await controller.applyPatch(patch)
    },
  }
}
