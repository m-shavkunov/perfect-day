<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavigation from '../components/AppNavigation.vue'
import { auth, signOut } from '../state/auth.js'
import { createTasksState } from '../state/tasks.js'
import { maxTaskDuration, prepareTask, taskFormValues, taskPriorities, taskStatuses, taskTypes } from '../utils/tasks.js'

const router = useRouter()
const route = useRoute()
const { state, load, create, update, remove, dispose } = createTasksState({
  userId: auth.user.id,
  getToken: () => auth.token,
  onUnauthorized: () => {
    signOut()
    auth.notice = 'Сессия истекла. Войдите снова, чтобы открыть список задач.'
    return router.replace({ name: 'login' })
  },
})

const filter = ref('')
const form = reactive(taskFormValues())
const errors = ref({})
const editing = ref(null)
const formOpen = ref(false)
const errorTarget = ref('list')
const formElement = ref(null)
const formToggle = ref(null)
const titleInput = ref(null)
const shownTasks = computed(() => filter.value ? state.items.filter(task => task.status === filter.value) : state.items)
const failedDeleteTask = computed(() => state.items.find(task => task.id === state.failedDeleteId))
const deadlineFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

onMounted(() => {
  load()
  if (route.query.new === '1') toggleForm()
})
onBeforeUnmount(dispose)

async function toggleForm() {
  formOpen.value = !formOpen.value
  if (formOpen.value) {
    await nextTick()
    titleInput.value?.focus()
  }
}

function resetForm() {
  editing.value = null
  errors.value = {}
  Object.assign(form, taskFormValues())
}

async function editTask(task) {
  if (state.busy) return
  editing.value = task
  errors.value = {}
  state.error = ''
  state.message = ''
  Object.assign(form, taskFormValues(task))
  formOpen.value = true
  await nextTick()
  titleInput.value?.focus()
}

async function cancelEdit() {
  resetForm()
  state.error = ''
  state.message = ''
  await nextTick()
  titleInput.value?.focus()
}

async function saveTask() {
  if (state.busy || state.listStatus !== 'success') return
  const original = editing.value
  const prepared = prepareTask(form, original)
  if (formElement.value.elements.namedItem('deadline').validity.badInput) {
    prepared.errors.deadline = 'Введите корректные дату и время.'
  }
  errors.value = prepared.errors
  if (Object.keys(errors.value).length) {
    state.message = ''
    state.error = ''
    await nextTick()
    formElement.value?.querySelector('[aria-invalid="true"]')?.focus()
    return
  }
  errorTarget.value = 'form'
  state.error = ''
  const saved = original
    ? !Object.keys(prepared.body).length || await update(original.id, prepared.body)
    : await create(prepared.body)
  if (!saved) return

  if (!original && filter.value && filter.value !== 'planned') filter.value = ''
  resetForm()
  formOpen.value = false
  await nextTick()
  if (formToggle.value?.offsetParent) formToggle.value.focus()
  else titleInput.value?.focus()
}

async function changeStatus(task) {
  if (state.busy) return
  errorTarget.value = 'list'
  const status = task.status === 'done' ? 'planned' : 'done'
  const changed = await update(task.id, { status })
  if (changed && editing.value?.id === task.id) {
    editing.value = state.items.find(item => item.id === task.id)
    form.status = editing.value.status
  }
}

async function deleteTask(task) {
  if (state.busy || !window.confirm(`Удалить задачу «${task.title}»?`)) return
  errorTarget.value = 'list'
  if (await remove(task.id) && editing.value?.id === task.id) resetForm()
}

async function cancelFailedDeletion() {
  const task = failedDeleteTask.value
  if (!task || task.status !== 'planned' || state.busy) return
  errorTarget.value = 'list'
  if (await update(task.id, { status: 'cancelled' })) {
    if (editing.value?.id === task.id) resetForm()
    state.message = 'Задача отменена. Она останется в истории и не попадёт в новые расписания.'
  }
}
</script>

<template>
  <section class="tasks-page" aria-labelledby="tasks-title">
    <div class="tasks-layout">
      <div class="tasks-sidebar">
        <AppNavigation class="tasks-navigation" />
        <button
          ref="formToggle" class="form-toggle" type="button" :aria-expanded="formOpen"
          aria-controls="task-form-panel" @click="toggleForm"
        >{{ formOpen ? 'Свернуть форму' : editing ? 'Продолжить редактирование' : 'Добавить задачу' }}</button>

        <section
          id="task-form-panel" class="task-form-panel glass-panel" :class="{ 'task-form-panel--open': formOpen }"
          aria-labelledby="task-form-title" tabindex="0"
        >
          <h2 id="task-form-title">{{ editing ? 'Редактировать задачу' : 'Добавить задачу' }}</h2>
          <form ref="formElement" novalidate @submit.prevent="saveTask">
            <fieldset :disabled="state.busy">
              <div class="task-field">
                <label for="task-title">Название задачи</label>
                <input
                  id="task-title" ref="titleInput" v-model="form.title" name="title" required
                  :aria-invalid="Boolean(errors.title)" :aria-describedby="errors.title ? 'task-title-error' : undefined"
                  @input="delete errors.title"
                />
                <span v-if="errors.title" id="task-title-error" class="field-error">{{ errors.title }}</span>
              </div>
              <div class="form-pair">
                <div class="task-field">
                  <label for="task-type">Тип задачи</label>
                  <select
                    id="task-type" v-model="form.type" name="type" required
                    :aria-invalid="Boolean(errors.type)" :aria-describedby="errors.type ? 'task-type-error' : undefined"
                    @change="delete errors.type"
                  >
                    <option value="" disabled>Выберите тип</option>
                    <option v-for="(label, value) in taskTypes" :key="value" :value="value">{{ label }}</option>
                  </select>
                  <span v-if="errors.type" id="task-type-error" class="field-error">{{ errors.type }}</span>
                </div>
                <div class="task-field">
                  <label for="task-duration">Длительность, мин</label>
                  <input
                    id="task-duration" v-model="form.duration_min" name="duration_min" type="number"
                    min="1" :max="maxTaskDuration" step="1" required
                    :aria-invalid="Boolean(errors.duration_min)" :aria-describedby="errors.duration_min ? 'task-duration-error' : undefined"
                    @input="delete errors.duration_min"
                  />
                  <span v-if="errors.duration_min" id="task-duration-error" class="field-error">{{ errors.duration_min }}</span>
                </div>
              </div>
              <div class="form-pair">
                <div class="task-field">
                  <label for="task-priority">Приоритет</label>
                  <select id="task-priority" v-model="form.priority" name="priority">
                    <option v-for="(label, value) in taskPriorities" :key="value" :value="value">{{ label }}</option>
                  </select>
                </div>
                <div v-if="editing" class="task-field">
                  <label for="task-status">Статус</label>
                  <select id="task-status" v-model="form.status" name="status">
                    <option v-for="(label, value) in taskStatuses" :key="value" :value="value">{{ label }}</option>
                  </select>
                </div>
              </div>
              <div class="task-field">
                <label for="task-deadline">Срок <span class="optional">(необязательно)</span></label>
                <input
                  id="task-deadline" v-model="form.deadline" name="deadline" type="datetime-local"
                  :aria-invalid="Boolean(errors.deadline)" :aria-describedby="errors.deadline ? 'task-deadline-error' : undefined"
                  @input="delete errors.deadline"
                />
                <span v-if="errors.deadline" id="task-deadline-error" class="field-error">{{ errors.deadline }}</span>
              </div>
              <div class="task-field">
                <label for="task-description">Описание <span class="optional">(необязательно)</span></label>
                <textarea id="task-description" v-model="form.description" name="description" rows="3"></textarea>
              </div>
              <p v-if="state.error && errorTarget === 'form'" class="feedback feedback--error" role="alert">{{ state.error }}</p>
              <div class="form-actions">
                <button type="submit" :disabled="state.listStatus !== 'success'">
                  {{ state.busy ? 'Подождите…' : editing ? 'Сохранить изменения' : 'Создать задачу' }}
                </button>
                <button v-if="editing" class="secondary" type="button" @click="cancelEdit">Отмена</button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>

      <section class="task-list-panel glass-panel" aria-labelledby="tasks-title" :aria-busy="state.listStatus === 'loading'">
        <h1 id="tasks-title">Список задач</h1>
        <div class="task-filter">
          <label for="task-filter">Статус</label>
          <select id="task-filter" v-model="filter">
            <option value="">Все задачи</option>
            <option v-for="(label, value) in taskStatuses" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
        <div v-if="state.error && errorTarget === 'list'" class="feedback feedback--error task-delete-feedback" role="alert">
          <p>{{ state.error }}</p>
          <template v-if="failedDeleteTask?.status === 'planned'">
            <p>Можно отменить задачу «{{ failedDeleteTask.title }}». Она останется в списке со статусом «Отменено» и не попадёт в новые расписания.</p>
            <button type="button" :disabled="state.busy" @click="cancelFailedDeletion">Отменить задачу</button>
          </template>
        </div>
        <p v-if="state.message" class="feedback" role="status">{{ state.message }}</p>
        <p v-if="state.listStatus === 'loading'" class="feedback" role="status">Загрузка задач…</p>
        <div v-else-if="state.listStatus === 'error'" class="feedback feedback--error">
          <p role="alert">{{ state.listError }}</p>
          <button type="button" @click="load">Повторить</button>
        </div>
        <p v-else-if="!shownTasks.length" class="feedback" role="status">
          {{ state.items.length ? 'Задач с таким статусом нет.' : 'Задач пока нет.' }}
        </p>
        <ul v-else class="task-list" tabindex="0" aria-label="Задачи выбранного статуса">
          <li v-for="task in shownTasks" :key="task.id" class="task-card" :class="{ 'task-card--done': task.status === 'done', 'task-card--cancelled': task.status === 'cancelled' }">
            <div class="task-info">
              <h2>{{ task.title }}</h2>
              <p v-if="task.description" class="task-description">{{ task.description }}</p>
              <ul class="task-details" aria-label="Параметры задачи">
                <li>{{ taskTypes[task.type] }}</li>
                <li>{{ task.duration_min }} мин</li>
                <li>Приоритет: {{ taskPriorities[task.priority].toLowerCase() }}</li>
                <li :class="{ 'task-status--done': task.status === 'done', 'task-status--cancelled': task.status === 'cancelled' }">
                  <span v-if="task.status === 'done'" aria-hidden="true">✓ </span>
                  <span v-else-if="task.status === 'cancelled'" aria-hidden="true">× </span>
                  {{ taskStatuses[task.status] }}
                </li>
                <li v-if="task.deadline">Срок: <time :datetime="task.deadline">{{ deadlineFormat.format(new Date(task.deadline)) }}</time></li>
              </ul>
            </div>
            <div class="card-actions" role="group" :aria-label="'Действия для задачи «' + task.title + '»'">
              <button type="button" :disabled="state.busy" @click="editTask(task)">Редактировать</button>
              <button type="button" :disabled="state.busy" @click="deleteTask(task)">Удалить</button>
              <button v-if="task.status !== 'cancelled'" type="button" :disabled="state.busy" @click="changeStatus(task)">
                {{ task.status === 'done' ? 'Вернуть в план' : 'Выполнить' }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.tasks-page {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100svh;
  background: linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)), #fff;
  color: #fff;
  font: 20px/1.3 'Times New Roman', serif;
  --panel-green: #4e624a;
  --control-green: #40523d;
}
.tasks-page::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: url('../assets/leaves.jpg') center / cover no-repeat;
  opacity: 0.6;
  pointer-events: none;
  content: '';
}
.tasks-layout {
  display: grid;
  grid-template-columns: minmax(0, 476fr) minmax(0, 869fr);
  gap: 34px;
  max-width: 1440px;
  margin: 0 auto;
  padding: 31px 31px 0 30px;
}
.glass-panel { background: rgb(138 140 137 / 20%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%); }
.tasks-navigation {
  margin: 30px auto var(--navigation-content-gap);
}
button, input, select, textarea {
  min-width: 0;
  min-height: 44px;
  border: 0;
  border-radius: 0;
  background: var(--control-green);
  color: inherit;
  font: inherit;
}
button { padding: 9px 12px; text-align: center; cursor: pointer; }
button:disabled { opacity: 0.75; cursor: not-allowed; }
button:not(:disabled):hover { background: #354730; }
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
.form-toggle { display: none; }
.task-form-panel {
  min-height: max(680px, calc(100svh - 61px - var(--app-navigation-height) - var(--navigation-content-gap)));
  padding: 30px clamp(20px, 2.3vw, 33px);
}
.task-form-panel h2, .task-list-panel h1 {
  margin: 0;
  font-size: clamp(28px, 2.78vw, 40px);
  font-weight: 400;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
}
.task-form-panel h2 { margin-bottom: 30px; }
fieldset { display: grid; gap: 16px; min-inline-size: 0; margin: 0; padding: 0; border: 0; }
.form-pair { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: 12px; }
.task-field { display: grid; align-content: start; gap: 6px; min-width: 0; }
.task-field label, .optional { font-size: 18px; }
.optional { color: #f1f5ec; }
.task-field :is(input, select, textarea), .task-filter select {
  width: 100%;
  max-width: 100%;
  padding: 9px 11px;
  border: 1px solid rgb(255 255 255 / 45%);
  background: var(--panel-green);
  color-scheme: dark;
}
.task-field textarea { resize: vertical; }
.task-field [aria-invalid='true'] { border-color: #ffc9bd; }
.field-error { padding: 5px 8px; background: #693d35; font-size: 17px; }
.form-actions { display: grid; gap: 10px; justify-items: center; margin-top: 14px; }
.form-actions button {
  width: min(100%, 291px);
  min-height: 64px;
  background: var(--panel-green);
  font-size: clamp(20px, 2vw, 29px);
}
.form-actions .secondary { min-height: 44px; background: var(--control-green); font-size: 18px; }
.task-list-panel {
  min-width: 0;
  min-height: calc(100svh - 31px);
  padding: 30px clamp(20px, 2.1vw, 30px) 40px;
}
.task-list-panel h1 {
  display: grid;
  place-items: center;
  min-height: 85px;
  padding: 10px;
  background: var(--panel-green);
}
.task-filter {
  display: grid;
  grid-template-columns: minmax(0, 205fr) minmax(0, 575fr);
  align-items: center;
  gap: 30px;
  margin: 34px 0 44px;
  font-size: clamp(23px, 2.4vw, 34px);
}
.task-filter label { justify-self: center; }
.task-filter select { min-height: 75px; }
.feedback { margin: 0 0 16px; padding: 16px; background: var(--control-green); overflow-wrap: anywhere; }
.feedback--error { background: #693d35; }
.feedback p { margin: 0 0 10px; }
.task-delete-feedback { max-height: min(35svh, 320px); overflow: auto; overscroll-behavior: contain; }
.task-list, .task-details { padding: 0; list-style: none; }
.task-list { display: grid; grid-auto-rows: max-content; gap: 28px; margin: 0; }
.task-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px 20px;
  min-height: 197px;
  padding: 24px clamp(16px, 2.45vw, 35px);
  background: var(--panel-green);
}
.task-info { min-width: 0; overflow-wrap: anywhere; }
.task-card--done { background: #3f513d; box-shadow: inset 4px 0 #c7d8b8; }
.task-card--done .task-info h2 { text-decoration: line-through; text-decoration-thickness: 2px; text-decoration-color: #dbe7d1; }
.task-card--cancelled { background: #414840; box-shadow: inset 4px 0 #b7beb4; }
.task-card--cancelled .task-info h2 { color: #d5dbcf; text-decoration: line-through; text-decoration-thickness: 1px; text-decoration-color: #aeb8a5; }
.task-info h2 { margin: 0; font-size: clamp(24px, 2.5vw, 36px); font-weight: 400; line-height: 1.15; }
.task-description { margin: 10px 0 0; font-size: 18px; white-space: pre-wrap; }
.task-details { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; font-size: 17px; }
.task-details li { max-width: 100%; padding: 4px 8px; background: var(--control-green); }
.task-details .task-status--done { background: #dfead4; color: #283f28; font-weight: 700; }
.task-details .task-status--cancelled { background: #d4d8cf; color: #363c31; font-weight: 700; }
.card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.card-actions button { min-height: 56px; font-size: clamp(17px, 1.45vw, 21px); }
.task-form-panel:focus-visible, .task-list:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }

@media (min-width: 901px) {
  .tasks-layout { height: 100svh; grid-template-rows: minmax(0, 1fr); }
  .tasks-sidebar { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .task-form-panel { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .task-list-panel { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
  .task-list-panel h1, .task-filter, .feedback { flex: none; }
  .task-list { flex: 1; min-height: 0; align-content: start; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
}

@media (max-width: 1220px) {
  .task-card { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  .form-pair { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 900px) {
  .tasks-layout { grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 24px 16px; }
  .tasks-navigation { margin: 0 0 var(--navigation-content-gap); }
  .form-toggle { display: block; width: 100%; background: var(--panel-green); }
  .task-form-panel { display: none; min-height: 0; margin-top: 12px; padding: 20px; }
  .task-form-panel--open { display: block; }
  .form-pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .task-list-panel { min-height: 0; padding: 16px; }
  .task-list-panel h1 { min-height: 58px; }
  .task-filter { margin: 16px 0 20px; gap: 12px; }
  .task-filter select { min-height: 50px; }
  .task-list { gap: 14px; max-height: clamp(360px, 65svh, 600px); overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
  .card-actions button { min-height: 44px; }
}
@media (max-width: 420px) {
  .form-pair { grid-template-columns: minmax(0, 1fr); }
  .task-filter { grid-template-columns: auto minmax(0, 1fr); font-size: 20px; }
  .task-card { padding: 16px; }
}
</style>
