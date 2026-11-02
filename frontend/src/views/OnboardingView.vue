<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { registrationDraft } from '../state/registration'
import { registerAccount } from '../api/auth.js'
import { auth, signIn } from '../state/auth.js'

const router = useRouter()
const formElement = ref(null)
const form = reactive({
  birthDate: registrationDraft.birthDate,
  gender: registrationDraft.gender,
  chronotype: registrationDraft.chronotype,
})
const errors = reactive({ birthDate: '', gender: '', chronotype: '' })
const touched = reactive({ birthDate: false, gender: false, chronotype: false })
const submitted = ref(false)
const notice = ref('')
const isSubmitting = ref(false)
const accountCreated = ref(false)
const genders = [
  { value: 'male', label: 'М', accessibleLabel: 'Мужской' },
  { value: 'female', label: 'Ж', accessibleLabel: 'Женский' },
]
const chronotypes = [
  { value: 'lark', label: 'Жаворонок' },
  { value: 'owl', label: 'Сова' },
  { value: 'dove', label: 'Голубь' },
]

function localToday() {
  const today = new Date()
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
}

const maxBirthDate = ref(localToday())

watch(form, () => {
  Object.assign(registrationDraft, form)
  notice.value = ''
})

function validateField(name) {
  if (name === 'birthDate') {
    maxBirthDate.value = localToday()
    errors.birthDate = !form.birthDate
      ? 'Укажите дату рождения.'
      : !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) || form.birthDate < '0001-01-01'
        ? 'Укажите корректную дату рождения.'
        : form.birthDate > maxBirthDate.value
          ? 'Дата рождения не может быть в будущем.'
          : ''
  } else if (name === 'gender') {
    errors.gender = genders.some(({ value }) => value === form.gender) ? '' : 'Выберите пол.'
  } else {
    errors.chronotype = chronotypes.some(({ value }) => value === form.chronotype) ? '' : 'Выберите хронотип.'
  }
}

function handleBlur(name) {
  touched[name] = true
  validateField(name)
}

function handleChange(name) {
  notice.value = ''
  if (submitted.value || touched[name]) validateField(name)
}

async function submit() {
  if (isSubmitting.value) return
  notice.value = ''
  submitted.value = true
  Object.keys(errors).forEach(validateField)

  if (Object.values(errors).some(Boolean)) {
    await nextTick()
    formElement.value.querySelector('input[aria-invalid="true"]')?.focus()
    return
  }

  Object.assign(registrationDraft, form)
  isSubmitting.value = true
  const credentials = { email: registrationDraft.email, password: registrationDraft.password }
  try {
    await registerAccount({ ...credentials, birthDate: form.birthDate, chronotype: form.chronotype })
    accountCreated.value = true
    try {
      await signIn(credentials)
    } catch (error) {
      auth.notice = `Аккаунт создан. Войдите с указанными email и паролем. ${error.message}`
      await router.replace({ name: 'login' })
      return
    }
    await router.replace({ name: 'dashboard' })
  } catch (error) {
    notice.value = error.message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="onboarding-page" aria-labelledby="profile-title">
    <div class="profile-panel">
      <h1 id="profile-title">Профиль</h1>
      <form ref="formElement" class="profile-form" :aria-busy="isSubmitting" novalidate @submit.prevent="submit">
        <div class="identity-field">
          <label class="visually-hidden" for="profile-first-name">Имя</label>
          <input id="profile-first-name" :value="registrationDraft.firstName" autocomplete="given-name" readonly />
        </div>
        <div class="identity-field identity-field--last-name">
          <label class="visually-hidden" for="profile-last-name">Фамилия</label>
          <input id="profile-last-name" :value="registrationDraft.lastName" autocomplete="family-name" readonly />
        </div>
        <div class="birth-date-field">
          <div class="date-control">
            <label class="visually-hidden" for="birth-date">Дата рождения</label>
            <input
              id="birth-date"
              v-model="form.birthDate"
              :class="{ 'date-input--empty': !form.birthDate }"
              type="date"
              name="birthDate"
              autocomplete="bday"
              min="0001-01-01"
              :max="maxBirthDate"
              :disabled="isSubmitting"
              :aria-invalid="Boolean(errors.birthDate)"
              :aria-describedby="errors.birthDate ? 'birth-date-error' : undefined"
              required
              @focus="maxBirthDate = localToday()"
              @input="handleChange('birthDate')"
              @blur="handleBlur('birthDate')"
            />
            <span v-if="!form.birthDate" class="date-placeholder" aria-hidden="true">Дата рождения</span>
          </div>
          <p v-if="errors.birthDate" id="birth-date-error" class="field-error" aria-live="polite">{{ errors.birthDate }}</p>
        </div>
        <fieldset class="choice-group gender-group" :aria-describedby="errors.gender ? 'gender-error' : undefined">
          <legend>Пол</legend>
          <div class="choices gender-choices">
            <label v-for="gender in genders" :key="gender.value" class="choice">
              <input
                v-model="form.gender"
                class="choice-input"
                type="radio"
                name="gender"
                :value="gender.value"
                :disabled="isSubmitting"
                :aria-label="gender.accessibleLabel"
                :aria-invalid="Boolean(errors.gender)"
                required
                @change="handleChange('gender')"
              />
              <span class="choice-label">{{ gender.label }}</span>
            </label>
          </div>
          <p v-if="errors.gender" id="gender-error" class="field-error" aria-live="polite">{{ errors.gender }}</p>
        </fieldset>
        <fieldset class="choice-group chronotype-group" :aria-describedby="errors.chronotype ? 'chronotype-error' : undefined">
          <legend>Хронотип</legend>
          <div class="choices chronotype-choices">
            <label v-for="chronotype in chronotypes" :key="chronotype.value" class="choice">
              <input
                v-model="form.chronotype"
                class="choice-input"
                type="radio"
                name="chronotype"
                :value="chronotype.value"
                :disabled="isSubmitting"
                :aria-invalid="Boolean(errors.chronotype)"
                required
                @change="handleChange('chronotype')"
              />
              <span class="choice-label">{{ chronotype.label }}</span>
            </label>
          </div>
          <p v-if="errors.chronotype" id="chronotype-error" class="field-error" aria-live="polite">{{ errors.chronotype }}</p>
        </fieldset>
        <button class="profile-submit" type="submit" :disabled="isSubmitting">{{ isSubmitting ? (accountCreated ? 'Входим…' : 'Создаём аккаунт…') : 'Продолжить' }}</button>
        <p v-if="notice" class="profile-notice" role="alert">{{ notice }}</p>
      </form>
      <RouterLink v-if="!isSubmitting" class="back-link" to="/register">Назад к регистрации</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.onboarding-page {
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
.onboarding-page::before {
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
.profile-panel {
  width: min(100%, 1282px);
  min-height: calc(100svh - var(--page-top));
  padding: 27px clamp(20px, 7.847223vw, 113px) 4px;
  background: rgb(138 140 137 / 20%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  text-align: center;
}
h1 { margin: 0; font-size: clamp(30px, 3.333334vw, 48px); font-weight: 400; line-height: 55px; }
.profile-form { display: grid; grid-template-columns: minmax(0, 1fr); margin-top: clamp(28px, 3.819445vw, 55px); }
.visually-hidden, .choice-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.identity-field, .birth-date-field { min-width: 0; }
.identity-field--last-name, .birth-date-field { margin-top: clamp(24px, 3.75vw, 54px); }
.identity-field input, .date-control input {
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
}
.date-control { position: relative; }
.date-control input { min-width: 0; transition: background-color 160ms ease, box-shadow 160ms ease; }
.date-control input:focus { background: #3f533b; }
.date-control .date-input--empty { color: transparent; }
.date-control .date-input--empty:focus { color: #fff; }
.date-input--empty::-webkit-datetime-edit { opacity: 0; }
.date-input--empty:focus::-webkit-datetime-edit { opacity: 1; }
.date-control input::-webkit-calendar-picker-indicator { opacity: 0; filter: invert(1); }
.date-control input:focus::-webkit-calendar-picker-indicator { opacity: 0.8; }
.date-placeholder { position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(22px, 2.777778vw, 40px); pointer-events: none; }
.date-control:focus-within .date-placeholder { display: none; }
.choice-group { min-width: 0; padding: 0; margin: 0; border: 0; }
.choice-group legend { text-align: center; float: left; width: 100%; padding: 0; font-size: clamp(22px, 2.777778vw, 40px); line-height: 46px; }
.choice-group legend + * { clear: both; }
.gender-group { margin-top: 21px; }
.choices { display: grid; margin-inline: auto; max-width: 100%; }
.gender-choices { grid-template-columns: repeat(2, minmax(0, 202px)); gap: 69px; width: 473px; padding-top: 20px; }
.chronotype-group { margin-top: 28px; }
.chronotype-choices { grid-template-columns: repeat(3, minmax(0, 202px)); gap: 58px; width: 722px; padding-top: 36px; }
.choice { position: relative; min-width: 0; cursor: pointer; }
.choice-label { display: grid; place-items: center; min-height: 81px; padding: 8px 0; background: #4e624a; font-size: clamp(22px, 2.777778vw, 40px); line-height: 46px; transition: background-color 160ms ease, box-shadow 160ms ease; }
.choice-input:checked + .choice-label { background: #344630; box-shadow: inset 0 0 0 2px #fff; }
.choice-input:focus-visible + .choice-label { outline: 2px solid #fff; outline-offset: 4px; }
input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
input[aria-invalid='true'] { box-shadow: inset 0 0 0 1px #ffc9bd; }
.choice-input[aria-invalid='true'] + .choice-label { box-shadow: inset 0 0 0 1px #ffc9bd; }
.profile-submit { transform: translateX(2.5px); justify-self: center; width: 313px; max-width: 100%; min-height: 91px; margin-top: 65px; padding: 16px; border: 0; border-radius: 0; background: #4e624a; color: #fff; font: inherit; font-size: clamp(22px, 2.777778vw, 40px); line-height: 46px; cursor: pointer; transition: background-color 160ms ease; }
.profile-submit:active { background: #344630; }
.profile-submit:disabled { opacity: 0.65; cursor: wait; }
.back-link { display: inline-block; margin-top: 12px; color: #fff; font-size: 16px; line-height: 18px; text-underline-offset: 4px; }
.field-error, .profile-notice { margin: 8px 0 0; padding: 6px; background: #693d35; color: #fff0ec; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.5; overflow-wrap: anywhere; }
.profile-notice { background: #3f533b; color: #fff; margin-top: 20px; padding: 12px; }
@media (hover: hover) {
  .date-control input:hover, .choice:hover .choice-label { background-color: #5b7055; }
  .date-control input:focus { background: #3f533b; }
  .choice:hover .choice-input:checked + .choice-label { background: #344630; }
  .profile-submit:hover { background: #3f533b; }
  .profile-submit:active { background: #344630; }
}
@media (max-width: 900px) {
  .gender-choices, .chronotype-choices { gap: 20px; }
  .choice-label { font-size: clamp(20px, 2.777778vw, 40px); }
}
@media (max-width: 600px) {
  .onboarding-page { padding: 24px 16px; }
  .profile-panel { min-height: calc(100svh - 48px); padding: 28px 20px; }
  h1 { line-height: 1.2; }
  .profile-form { margin-top: 32px; }
  .identity-field input, .date-control input { height: 48px; padding: 0 12px; line-height: 1.2; }
  .gender-group, .chronotype-group { margin-top: 24px; }
  .choice-group legend { line-height: 1.2; }
  .gender-choices { width: min(100%, 240px); grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: 16px; gap: 16px; }
  .chronotype-choices { grid-template-columns: minmax(0, 1fr); padding-top: 16px; gap: 12px; }
  .choice-label { min-height: 48px; padding: 10px; font-size: 22px; line-height: 1.2; }
  .profile-submit { transform: none; min-height: 64px; margin-top: 32px; line-height: 1.2; }
  .back-link { margin-top: 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .date-control input, .choice-label, .profile-submit { transition: none; }
}
</style>


