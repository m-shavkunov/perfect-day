<script setup>
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { registrationDraft } from '../state/registration'

const router = useRouter()
const formElement = ref(null)
const form = reactive({ ...registrationDraft, confirmPassword: '' })
const errors = reactive({})
const submitted = ref(false)
const touched = reactive({})
const fields = [
  { name: 'lastName', label: 'Фамилия', type: 'text', autocomplete: 'family-name' },
  { name: 'firstName', label: 'Имя', type: 'text', autocomplete: 'given-name' },
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
  { name: 'password', label: 'Пароль', type: 'password', autocomplete: 'new-password' },
  { name: 'confirmPassword', label: 'Повторите пароль', type: 'password', autocomplete: 'new-password' },
]

function validateField(name) {
  const value = form[name]
  let message = ''

  if (!value.trim()) {
    message = 'Заполните это поле.'
  } else if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    message = 'Введите корректный email, например name@example.com.'
  } else if (name === 'password' && Array.from(value).length < 8) {
    message = 'Пароль должен содержать не менее 8 символов.'
  } else if (name === 'confirmPassword' && value !== form.password) {
    message = 'Пароли не совпадают.'
  }

  errors[name] = message
}

function handleBlur(name) {
  touched[name] = true
  validateField(name)
}

function handleInput(name) {
  if (submitted.value || touched[name]) validateField(name)
  if (name === 'password' && (submitted.value || touched.confirmPassword)) {
    validateField('confirmPassword')
  }
}

async function submit() {
  submitted.value = true
  fields.forEach(({ name }) => validateField(name))

  if (Object.values(errors).some(Boolean)) {
    await nextTick()
    formElement.value.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  Object.assign(registrationDraft, {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    password: form.password,
  })
  await router.push({ name: 'onboarding' })
}
</script>

<template>
  <section class="registration-page" aria-labelledby="registration-title">
    <div class="registration-panel">
      <h1 id="registration-title">Регистрация</h1>
      <form ref="formElement" class="registration-form" novalidate @submit.prevent="submit">
        <div v-for="field in fields" :key="field.name" class="registration-field">
          <label class="field-label" :for="field.name">{{ field.label }}</label>
          <input
            :id="field.name"
            v-model="form[field.name]"
            :name="field.name"
            :type="field.type"
            :autocomplete="field.autocomplete"
            :placeholder="field.label"
            :aria-invalid="Boolean(errors[field.name])"
            :aria-describedby="errors[field.name] ? `${field.name}-error` : undefined"
            :maxlength="field.type === 'password' ? undefined : 254"
            required
            @blur="handleBlur(field.name)"
            @input="handleInput(field.name)"
          />
          <p v-if="errors[field.name]" :id="`${field.name}-error`" class="field-error" aria-live="polite">
            {{ errors[field.name] }}
          </p>
        </div>
        <button class="registration-submit" type="submit">Зарегистрироваться</button>
      </form>
      <p class="registration-login">Уже есть аккаунт? <RouterLink to="/login">Войти</RouterLink></p>
    </div>
  </section>
</template>

<style scoped>
.registration-page {
  --page-top: clamp(24px, calc(100vw * 59 / 1440), 59px);
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  width: 100%;
  padding: var(--page-top) clamp(16px, 5.486112vw, 79px) 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background:
    linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)),
    #fff;
  color: #fff;
  font-family: 'Times New Roman', serif;
  line-height: normal;
}

.registration-page::before {
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

.registration-panel {
  width: min(100%, 1282px);
  min-height: calc(100svh - var(--page-top));
  padding: 15px clamp(20px, 7.847223vw, 113px) 8px;
  background: rgb(138 140 137 / 20%);
  /* Approximate Figma's glass effect without changing the panel's bounds. */
  backdrop-filter: blur(1px);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  text-align: center;
}

h1 {
  font-size: clamp(30px, 3.333334vw, 48px);
  font-weight: 400;
  line-height: 1.1458333333;
  margin: 0 0 clamp(36px, 5.763889vw, 83px);
}
.registration-form { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(24px, 5vw, 72px); }
.registration-field { min-width: 0; }
.field-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
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
  line-height: 1.15;
  text-align: center;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}
input::placeholder { color: #fff; opacity: 1; }
#lastName::placeholder { color: rgb(255 255 255 / 87%); }
#firstName { padding-top: 0; padding-bottom: 11px; }
#email, #confirmPassword { padding-top: 2px; padding-bottom: 9px; }
@media (hover: hover) {
  input:hover { background-color: #5b7055; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%); }
}
input:focus { background-color: #3f533b; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
input[aria-invalid='true'] { box-shadow: inset 0 0 0 1px #ffc9bd; }
.field-error { margin: 8px 0 0; color: #fff0ec; font-family: Arial, sans-serif; font-size: 15px; padding: 6px; background: #693d35; }
.registration-submit {
  justify-self: center;
  width: 381px;
  min-height: 102px;
  max-width: 100%;
  margin-top: 11px;
  padding: 16px;
  border: 1px solid transparent;
  border-radius: 0;
  color: #fff;
  background: #4e624a;
  font: inherit;
  font-size: clamp(22px, 2.777778vw, 40px);
  line-height: 1.15;
  cursor: pointer;
  transition: background-color 160ms ease;
}
.registration-submit:hover { background: #3f533b; }
.registration-submit:active { background: #344630; }
.registration-login { margin: 24px 0 0; font-size: 18px; line-height: 22px; }
a { color: #fff; text-underline-offset: 4px; }
@media (max-width: 600px) {
  .registration-page { padding: 24px 16px; }
  .registration-panel { min-height: calc(100svh - 48px); padding: 28px 20px; }
  h1 { margin-bottom: 36px; }
  .registration-form { gap: 24px; }
  input { height: 48px; }
  input, #firstName, #email, #confirmPassword { padding: 0 12px; }
  .registration-submit { min-height: 64px; margin-top: 0; padding: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  input, .registration-submit { transition: none; }
}
</style>

