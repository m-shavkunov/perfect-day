import { reactive } from 'vue'
import { createTask, deleteTask, getTasks, updateTask } from '../api/tasks.js'

export function createTasksState({ userId, getToken, onUnauthorized }) {
  const state = reactive({
    items: [], listStatus: 'loading', listError: '',
    busy: false, message: '', error: '', failedDeleteId: null,
  })
  let disposed = false
  let controller

  async function request(perform, accept, reject) {
    if (disposed || controller) return false
    const token = getToken()
    if (!token) {
      await onUnauthorized()
      return false
    }

    controller = new AbortController()
    const { signal } = controller
    try {
      const result = await perform({ userId, token, signal })
      if (signal.aborted || getToken() !== token) return false
      accept(result)
      return true
    } catch (error) {
      if (signal.aborted || getToken() !== token) return false
      if (error.status === 401 || error.status === 403) await onUnauthorized()
      else reject(error)
      return false
    } finally {
      controller = undefined
    }
  }

  function load() {
    if (disposed || controller) return
    state.listStatus = 'loading'
    state.listError = ''
    state.error = ''
    state.message = ''
    state.failedDeleteId = null
    return request(getTasks, (items) => {
      state.items = items.sort((left, right) => right.id - left.id)
      state.listStatus = 'success'
    }, (error) => {
      state.listStatus = 'error'
      state.listError = error.message
    })
  }

  function showChangeError(error) {
    state.error = error.status === 404 ? 'Задача недоступна. Обновите страницу, чтобы получить свежий список.' : error.message
  }

  async function change(perform, accept, message, onError = showChangeError) {
    if (disposed || controller || state.listStatus !== 'success') return false
    state.message = ''
    state.error = ''
    state.failedDeleteId = null
    state.busy = true
    try {
      return await request(perform, (result) => {
        accept(result)
        state.message = message
      }, onError)
    } finally {
      state.busy = false
    }
  }

  return {
    state,
    load,
    create: body => change(options => createTask(body, options), (task) => {
      state.items = [task, ...state.items.filter(item => item.id !== task.id)]
    }, 'Задача создана.'),
    update: (id, body) => change(options => updateTask(id, body, options), (task) => {
      state.items = state.items.map(item => item.id === id ? task : item)
    }, 'Задача обновлена.'),
    remove: id => change(options => deleteTask(id, options), () => {
      state.items = state.items.filter(item => item.id !== id)
    }, 'Задача удалена.', (error) => {
      showChangeError(error)
      if (error.status === 500) {
        state.failedDeleteId = id
        state.error = 'Сервер не смог удалить задачу. Если она включена в сохранённое расписание, удалить её сейчас нельзя.'
      }
    }),
    dispose() {
      disposed = true
      controller?.abort()
    },
  }
}
