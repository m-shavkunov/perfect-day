import { createRouter, createWebHistory } from 'vue-router'
import { NetworkError } from '../api/client.js'
import WelcomeView from '../views/WelcomeView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import DashboardView from '../views/DashboardView.vue'
import ProfileView from '../views/ProfileView.vue'
import SettingsView from '../views/SettingsView.vue'
import TasksView from '../views/TasksView.vue'
import ScheduleView from '../views/ScheduleView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import OfflineView from '../views/OfflineView.vue'
import { clearRegistrationDraft, hasRegistrationDetails } from '../state/registration'
import { auth, restoreSession } from '../state/auth.js'
import { isOnline, sessionCheckFailed } from '../state/connection.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', name: 'welcome', component: WelcomeView, meta: { title: 'Главная', layout: 'auth' },
      beforeEnter: () => {
        if (auth.token) return { name: 'dashboard', replace: true }
        if (!isOnline.value) return { name: 'offline', query: { returnTo: '/' }, replace: true }
      },
    },
    { path: '/login', name: 'login', component: LoginView, meta: { title: 'Вход', layout: 'auth' } },
    { path: '/register', name: 'register', component: RegisterView, meta: { title: 'Регистрация', layout: 'auth' } },
    { path: '/onboarding', name: 'onboarding', component: OnboardingView, meta: { title: 'Настройка профиля', layout: 'auth' }, beforeEnter: () => hasRegistrationDetails() || { name: 'register', replace: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Дашборд', layout: 'auth', requiresAuth: true } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { title: 'Профиль', layout: 'auth', requiresAuth: true } },
    { path: '/settings', name: 'settings', component: SettingsView, meta: { title: 'Настройки рабочего дня', layout: 'auth', requiresAuth: true } },
    { path: '/tasks', name: 'tasks', component: TasksView, meta: { title: 'Список задач', layout: 'auth', requiresAuth: true } },
    { path: '/schedule', name: 'schedule', component: ScheduleView, meta: { title: 'Календарь и планирование', layout: 'auth', requiresAuth: true } },
    { path: '/offline', name: 'offline', component: OfflineView, meta: { title: 'Подключение к сети', layout: 'auth' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: 'Страница не найдена' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to, from) => {
  if (!to.meta.requiresAuth) return

  const offline = () => from.meta.requiresAuth && auth.user ? false
    : { name: 'offline', query: { returnTo: to.fullPath }, replace: true }
  if (!isOnline.value) return offline()

  try {
    const restored = await restoreSession()
    if (!isOnline.value) return offline()
    if (restored) return
    auth.notice = {
      profile: 'Войдите в аккаунт, чтобы открыть профиль.',
      settings: 'Войдите в аккаунт, чтобы открыть настройки рабочего дня.',
      tasks: 'Войдите в аккаунт, чтобы открыть список задач.',
      schedule: 'Войдите в аккаунт, чтобы открыть расписание.',
    }[to.name] || 'Войдите в аккаунт, чтобы открыть дашборд.'
  } catch (error) {
    if (from.name === 'offline') return false
    if (!isOnline.value || error instanceof NetworkError) {
      if (from.meta.requiresAuth && auth.user) sessionCheckFailed.value = true
      return offline()
    }
    auth.notice = `Не удалось проверить вход. ${error.message}`
  }
  return { name: 'login', replace: true }
})

router.afterEach((to, from, failure) => {
  if (failure) return
  sessionCheckFailed.value = false
  document.title = `${to.meta.title} — Идеальный День`
  if (!['register', 'onboarding'].includes(to.name)) clearRegistrationDraft()
})

export default router



