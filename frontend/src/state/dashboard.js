import { computed, reactive } from 'vue'
import { getBiorhythms, getBiorhythmPeriod, getCriticalDays } from '../api/biorhythms.js'
import { getRecommendations } from '../api/recommendations.js'
import { getPeriodRange, localDateString } from '../utils/dates.js'

const resourceNames = ['daily', 'forecast', 'criticalDays', 'recommendations']

export function createDashboardState({ getToken, onUnauthorized, initialDate = localDateString() }) {
  getPeriodRange(initialDate, 'day')
  const state = reactive({
    selectedDate: initialDate,
    selectedPeriod: 'day',
    ...Object.fromEntries(resourceNames.map((name) => [name, { data: null, status: 'idle', error: '' }])),
  })
  const dateRange = computed(() => getPeriodRange(state.selectedDate, state.selectedPeriod))
  const isLoading = computed(() => resourceNames.some((name) => state[name].status === 'loading'))
  const hasErrors = computed(() => resourceNames.some((name) => state[name].status === 'error'))
  const requests = new Map()
  let disposed = false

  function dispose() {
    disposed = true
    for (const { controller } of requests.values()) controller.abort()
    requests.clear()
    for (const name of resourceNames) {
      state[name].data = null
      state[name].error = ''
      state[name].status = 'idle'
    }
  }

  async function loadResource(name) {
    if (disposed) return
    requests.get(name)?.controller.abort()
    const request = { controller: new AbortController(), token: getToken() }
    requests.set(name, request)
    const resource = state[name]
    resource.data = null
    resource.error = ''
    resource.status = 'loading'
    const isCurrent = () => !disposed && requests.get(name) === request && getToken() === request.token

    try {
      if (!request.token) {
        dispose()
        await onUnauthorized()
        return
      }
      const options = { token: request.token, signal: request.controller.signal }
      const targetDate = state.selectedDate
      const { startDate, endDate } = dateRange.value
      const loaders = {
        daily: () => getBiorhythms({ targetDate, ...options }),
        forecast: () => getBiorhythmPeriod({ startDate, endDate, ...options }),
        criticalDays: () => getCriticalDays({ startDate, endDate, ...options }),
        recommendations: () => getRecommendations({ targetDate, ...options }),
      }
      const data = await loaders[name]()
      if (!isCurrent()) return
      resource.data = data
      resource.status = 'success'
    } catch (error) {
      if (!isCurrent() || request.controller.signal.aborted) return
      if (error.status === 401 || error.status === 403) {
        dispose()
        await onUnauthorized()
        return
      }
      resource.error = error.message || 'Не удалось загрузить данные. Попробуйте ещё раз.'
      resource.status = 'error'
    } finally {
      if (requests.get(name) === request) requests.delete(name)
    }
  }

  function load(names = resourceNames) {
    return Promise.all(names.map(loadResource))
  }

  function setDate(date) {
    getPeriodRange(date, state.selectedPeriod)
    if (date === state.selectedDate) return Promise.resolve()
    state.selectedDate = date
    return load()
  }

  function setPeriod(period) {
    getPeriodRange(state.selectedDate, period)
    if (period === state.selectedPeriod) return Promise.resolve()
    state.selectedPeriod = period
    return load(['forecast', 'criticalDays'])
  }

  function retryFailed() {
    return load(resourceNames.filter((name) => state[name].status === 'error'))
  }

  return { state, dateRange, isLoading, hasErrors, load, setDate, setPeriod, retryFailed, dispose }
}
