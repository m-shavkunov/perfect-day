import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import OnboardingView from '../views/OnboardingView.vue'
import DashboardView from '../views/DashboardView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import { clearRegistrationDraft, hasRegistrationDetails } from '../state/registration'
import { auth, restoreSession } from '../state/auth.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'dashboard' } },
    { path: '/login', name: 'login', component: LoginView, meta: { title: 'Вход', layout: 'auth' } },
    { path: '/register', name: 'register', component: RegisterView, meta: { title: 'Регистрация', layout: 'auth' } },
    { path: '/onboarding', name: 'onboarding', component: OnboardingView, meta: { title: 'Настройка профиля', layout: 'auth' }, beforeEnter: () => hasRegistrationDetails() || { name: 'register', replace: true } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Дашборд', layout: 'auth', requiresAuth: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView, meta: { title: 'Страница не найдена' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return

  try {
    if (await restoreSession()) return
    auth.notice = 'Войдите в аккаунт, чтобы открыть дашборд.'
  } catch (error) {
    auth.notice = `Не удалось проверить вход. ${error.message}`
  }
  return { name: 'login', replace: true }
})

router.afterEach((to, from, failure) => {
  if (failure) return
  document.title = `${to.meta.title} — Идеальный День`
  if (!['register', 'onboarding'].includes(to.name)) clearRegistrationDraft()
})

export default router



