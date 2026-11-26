import { reactive } from 'vue'
import { getWorkSettings, updateWorkSettings } from '../api/settings.js'
import { prepareWorkSettings, workSettingsForm } from '../utils/workSettings.js'

export function createSettingsState({ userId, getToken, onUnauthorized }) {
  const state = reactive({
    status: 'loading', form: null, saving: false, saved: false,
    loadError: '', saveError: '', fieldErrors: {},
  })
  let savedSettings
  let controller
  let disposed = false

  async function request(perform, onError) {
    const token = getToken()
    if (!token) {
      await onUnauthorized()
      return false
    }

    controller = new AbortController()
    const { signal } = controller
    try {
      const settings = await perform({ userId, token, signal })
      if (signal.aborted || getToken() !== token) return false
      savedSettings = settings
      state.form = workSettingsForm(settings)
      return true
    } catch (error) {
      if (signal.aborted || getToken() !== token) return false
      if (error.status === 401 || error.status === 403) await onUnauthorized()
      else onError(error.message)
      return false
    } finally {
      controller = undefined
    }
  }

  async function load() {
    if (disposed || controller || state.status === 'ready') return
    state.status = 'loading'
    state.loadError = ''
    if (await request(getWorkSettings, message => {
      state.status = 'error'
      state.loadError = message
    })) state.status = 'ready'
  }

  function clearFeedback() {
    state.saved = false
    state.saveError = ''
    state.fieldErrors = {}
  }

  async function save() {
    if (disposed || controller || state.saving || state.status !== 'ready') return false
    clearFeedback()
    const { body, errors } = prepareWorkSettings(state.form, savedSettings)
    state.fieldErrors = errors
    if (Object.keys(errors).length) return false

    state.saving = true
    try {
      state.saved = await request(options => updateWorkSettings({ ...options, body }), message => {
        state.saveError = message
      })
      return state.saved
    } finally {
      state.saving = false
    }
  }

  return {
    state, load, save, clearFeedback,
    dispose() {
      disposed = true
      controller?.abort()
    },
  }
}
