import type { EndgeRuntimeContextSnapshot } from '@endge/core'
import { Endge } from '@endge/core'
import { beforeEach, vi } from 'vitest'

const TEST_RUNTIME_CONTEXT: EndgeRuntimeContextSnapshot = {
  workspace: null,
  tenant: null,
  project: null,
  environment: null,
  user: null,
  locale: 'ru',
  theme: 'light',
  timezone: 'local',
  config: Object.freeze({}) as EndgeRuntimeContextSnapshot['config'],
  input: {
    keyboard: {
      platform: 'unknown',
      modifiers: {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        mod: false,
        altGraph: false,
      },
      held: {
        key: [],
        code: [],
      },
    },
  },
}

/** Изолирует unit-тесты render adapter от обязательного boot приложения. */
beforeEach(() => {
  vi.spyOn(Endge.context, 'runtimeSnapshot').mockReturnValue(TEST_RUNTIME_CONTEXT)
})
