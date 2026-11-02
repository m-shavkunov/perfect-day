<script setup>
import { nextTick, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { auth, signIn } from '../state/auth.js'

const router = useRouter()
const formElement = ref(null)
const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const touched = reactive({ email: false, password: false })
const submitted = ref(false)
const notice = ref('')
const isSubmitting = ref(false)
const fields = [
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'username' },
  { name: 'password', label: 'Пароль', type: 'password', autocomplete: 'current-password' },
]

function validateField(name) {
  if (name === 'email') {
    const email = form.email.trim()
    errors.email = !email
      ? 'Введите email.'
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? ''
        : 'Введите корректный email, например name@example.com.'
  } else {
    errors.password = form.password ? '' : 'Введите пароль.'
  }
}

function handleBlur(name) {
  touched[name] = true
  validateField(name)
}

function handleInput(name) {
  notice.value = ''
  auth.notice = ''
  if (submitted.value || touched[name]) validateField(name)
}

async function submit() {
  if (isSubmitting.value) return
  notice.value = ''
  auth.notice = ''
  submitted.value = true
  fields.forEach(({ name }) => validateField(name))

  if (Object.values(errors).some(Boolean)) {
    await nextTick()
    formElement.value.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  isSubmitting.value = true
  try {
    await signIn({ email: form.email.trim(), password: form.password })
    form.password = ''
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    notice.value = error.message
  } finally {
    isSubmitting.value = false
  }
}

function showRecoveryNotice() {
  notice.value = 'Восстановление пароля пока недоступно.'
}
</script>

<template>
  <section class="login-page" aria-labelledby="login-title">
    <div class="login-panel">
      <h1 id="login-title">Вход</h1>
      <form ref="formElement" class="login-form" :aria-busy="isSubmitting" novalidate @submit.prevent="submit">
        <div
          v-for="field in fields"
          :key="field.name"
          class="login-field"
          :class="`login-field--${field.name}`"
        >
          <label class="field-label" :for="`login-${field.name}`">{{ field.label }}</label>
          <input
            :id="`login-${field.name}`"
            v-model="form[field.name]"
            :name="field.name"
            :type="field.type"
            :autocomplete="field.autocomplete"
            :placeholder="field.label"
            :maxlength="field.name === 'email' ? 254 : undefined"
            :aria-invalid="Boolean(errors[field.name])"
            :aria-describedby="errors[field.name] ? `login-${field.name}-error` : undefined"
            :autocapitalize="field.name === 'email' ? 'none' : undefined"
            :spellcheck="false"
            :disabled="isSubmitting"
            required
            @blur="handleBlur(field.name)"
            @input="handleInput(field.name)"
          />
          <p
            v-if="errors[field.name]"
            :id="`login-${field.name}-error`"
            class="field-error"
            aria-live="polite"
          >
            {{ errors[field.name] }}
          </p>
        </div>
        <button class="login-recovery" type="button" :disabled="isSubmitting" @click="showRecoveryNotice">Забыли пароль?</button>
        <button class="login-submit" type="submit" :disabled="isSubmitting">{{ isSubmitting ? 'Входим…' : 'Войти' }}</button>
        <p v-if="notice" class="login-notice" role="alert">{{ notice }}</p>
        <p v-else-if="auth.notice" class="login-notice" role="status">{{ auth.notice }}</p>
      </form>
      <p class="login-register">Ещё нет аккаунта? <RouterLink to="/register">Зарегистрироваться</RouterLink></p>
    </div>
  </section>
</template>

<style scoped>
.login-page {
  --page-top: clamp(24px, 4.097223vw, 59px);
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100svh;
  padding: var(--page-top) clamp(16px, 5.486112vw, 79px) 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)), #fff;
  color: #fff;
  font-family: 'Times New Roman', serif;
  line-height: normal;
}

.login-page::before {
  content: '';
  position: fixed;
  inset: 0 auto auto 0;
  width: 100vw;
  height: 100svh;
  z-index: -1;
  background: url('../assets/leaves.jpg') center / cover no-repeat;
  opacity: 0.6;
  pointer-events: none;
}

.login-panel {
  width: min(100%, 1282px);
  min-height: calc(100svh - var(--page-top));
  padding: 21px clamp(20px, 7.847223vw, 113px) 40px;
  background: rgb(138 140 137 / 20%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  text-align: center;
}

h1 {
  margin: 0;
  font-size: clamp(30px, 3.333334vw, 48px);
  font-weight: 400;
  line-height: 55px;
}

.login-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin-top: clamp(48px, 11.944445vw, 172px);
}

.login-field { min-width: 0; }
.login-field--password { margin-top: clamp(36px, 7.361112vw, 106px); }
.field-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

input {
  display: block;
  width: 100%;
  height: 57px;
  padding: 6px 16px 5px;
  border: 0;
  border-radius: 0;
  background: #4e624a;
  color: #fff;
  font: inherit;
  font-size: clamp(22px, 2.777778vw, 40px);
  line-height: 46px;
  text-align: center;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

input::placeholder { color: #fff; opacity: 1; }
#login-email::placeholder { color: rgb(255 255 255 / 87%); }
input:focus { background-color: #3f533b; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
input[aria-invalid='true'] { box-shadow: inset 0 0 0 1px #ffc9bd; }
.field-error {
  margin: 8px 0 0;
  padding: 6px;
  color: #fff0ec;
  background: #693d35;
  font-family: Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}

button { color: #fff; font: inherit; font-size: clamp(22px, 2.777778vw, 40px); cursor: pointer; }
.login-recovery {
  justify-self: center;
  max-width: 100%;
  margin-top: clamp(20px, 2.569445vw, 37px);
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 46px;
  text-underline-offset: 6px;
}

.login-submit {
  justify-self: center;
  width: 381px;
  max-width: 100%;
  min-height: 102px;
  margin-top: clamp(56px, 9.583334vw, 138px);
  padding: 16px;
  border: 0;
  border-radius: 0;
  background: #4e624a;
  line-height: 46px;
  transition: background-color 160ms ease;
}

.login-submit:active { background: #344630; }
button:disabled { opacity: 0.65; cursor: wait; }


.login-register { margin: 24px 0 0; font-size: 18px; line-height: 1.4; }
.login-register a { color: #fff; text-underline-offset: 4px; }
.login-notice {
  margin: 24px 0 0;
  padding: 12px;
  background: #3f533b;
  font-family: Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (hover: hover) {
  input:hover { background-color: #5b7055; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%); }
  input:focus { background-color: #3f533b; }
  input[aria-invalid='true'] { box-shadow: inset 0 0 0 1px #ffc9bd; }
  .login-submit:hover { background: #3f533b; }
  .login-submit:active { background: #344630; }


  .login-recovery:hover { text-decoration: underline; }
}

@media (max-width: 600px) {
  .login-page { padding: 24px 16px; }
  .login-panel { min-height: calc(100svh - 48px); padding: 28px 20px; }
  h1 { line-height: 1.2; }
  .login-form { margin-top: 48px; }
  .login-field--password { margin-top: 32px; }
  input { height: 48px; padding: 0 12px; line-height: 1.2; }
  .login-recovery { margin-top: 24px; line-height: 1.2; }
  .login-submit { min-height: 64px; margin-top: 56px; line-height: 1.2; }
}

@media (prefers-reduced-motion: reduce) {
  input, .login-submit { transition: none; }
}
</style>



