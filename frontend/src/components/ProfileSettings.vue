<script setup>
import { computed } from 'vue'
import fieldAsset from '../assets/profile-field.svg'
import { isDateString } from '../utils/dates.js'

const props = defineProps({
  user: { type: Object, required: true },
  form: { type: Object, required: true },
  displayName: { type: String, default: '' },
})
const emit = defineEmits(['back', 'logout', 'save', 'change'])
const birthDateLabel = computed(() => isDateString(props.user.birth_date) ? props.user.birth_date.split('-').reverse().join('.') : 'Не указано')
const chronotypes = [{ value: 'lark', label: 'Жаворонок' }, { value: 'owl', label: 'Сова' }, { value: 'dove', label: 'Голубь' }]
</script>

<template>
  <section class="profile-page" aria-labelledby="profile-page-title">
    <div class="profile-layout">
      <div class="settings-backdrop" aria-hidden="true"></div>
      <button class="back-button" type="button" @click="$emit('back')">← Назад</button>
      <h1 id="profile-page-title" class="profile-page-title">Настройки профиля и планирования</h1>
      <section class="user-panel" aria-labelledby="user-data-title">
        <h2 id="user-data-title">Данные пользователя</h2>
        <dl class="identity-fields">
          <div class="identity-row identity-row--name">
            <dt>ФИО:</dt>
            <dd class="identity-value" :title="displayName || 'ФИО не указано'">{{ displayName || 'Не указано' }}</dd>
          </div>
          <div class="identity-row identity-row--birth-date">
            <dt>Дата рождения:</dt>
            <dd class="identity-value"><time :datetime="isDateString(user.birth_date) ? user.birth_date : undefined">{{ birthDateLabel }}</time></dd>
          </div>
          <div class="identity-row identity-row--email">
            <dt>Почта:</dt>
            <dd class="identity-value identity-value--asset" :title="user.email">
              <img class="field-asset" :src="fieldAsset" alt="" aria-hidden="true" />
              <span class="email-value" :class="{ 'email-value--long': user.email?.length > 20, 'email-value--very-long': user.email?.length > 45 }" tabindex="0">{{ user.email || 'Не указано' }}</span>
            </dd>
          </div>
        </dl>
        <button class="logout-button" type="button" @click="$emit('logout')">
          <img class="field-asset" :src="fieldAsset" alt="" aria-hidden="true" />
          <span>Выйти из аккаунта</span>
        </button>
      </section>
      <form class="planning-panel" :aria-busy="form.isSaving" @submit.prevent="$emit('save')">
        <h2>Параметры планирования</h2>
        <fieldset class="chronotype-fieldset" :disabled="form.isSaving">
          <legend>Учет хронотипа:</legend>
          <div class="chronotype-options">
            <label v-for="option in chronotypes" :key="option.value">
              <input type="radio" name="profile-chronotype" :value="option.value" :checked="form.chronotype === option.value" @change="emit('change', { chronotype: option.value })" />
              <span>{{ option.label }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="priority-fieldset" :disabled="form.isSaving" aria-describedby="planning-local-note">
          <legend>Приоритет при перегрузке:</legend>
          <div class="priority-options">
            <label><input type="checkbox" :checked="form.shiftRoutineToEvening" @change="emit('change', { shiftRoutineToEvening: $event.target.checked })" /><span>Смещать рутину на вечер</span></label>
            <label><input type="checkbox" :checked="form.increaseRest" @change="emit('change', { increaseRest: $event.target.checked })" /><span>Увеличивать время отдыха</span></label>
          </div>
          <span id="planning-local-note" class="visually-hidden">Приоритеты сохраняются в этом браузере для текущего аккаунта. Планировщик задач пока не применяет эти параметры.</span>
        </fieldset>
        <div class="planning-feedback" aria-live="polite">
          <p v-if="form.error" class="planning-error" role="alert">{{ form.error }}</p>
          <p v-else-if="form.message" role="status">{{ form.message }}</p>
        </div>
        <button class="save-button" type="submit" :disabled="form.isSaving">
          <span :class="{ 'save-label--hidden': form.isSaving }" :aria-hidden="form.isSaving">Сохранить параметры планирования</span>
          <span v-if="form.isSaving">Сохраняем…</span>
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.profile-page { position: relative; isolation: isolate; width: 100%; min-height: 100svh; background: linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)), #fff; color: #fff; font-family: 'Times New Roman', serif; font-size: clamp(22px, 2.777778vw, 40px); line-height: 46px; }
.profile-page::before { content: ''; position: fixed; inset: 0; height: 100svh; z-index: -1; background: url('../assets/leaves.jpg') center / cover no-repeat; opacity: 0.6; pointer-events: none; }
.profile-layout { display: grid; grid-template-columns: minmax(0, 476fr) minmax(0, 869fr); grid-template-rows: 85px minmax(822px, 1fr); grid-template-areas: 'back title' 'user planning'; gap: 56px 34px; position: relative; isolation: isolate; width: 100%; max-width: 1440px; min-height: 100svh; margin: 0 auto; padding: 61px 31px 0 30px; }
.settings-backdrop { grid-column: 2; grid-row: 1 / 3; z-index: -1; margin-top: -32px; background: rgb(138 140 137 / 20%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%); }
button { border: 0; border-radius: 0; color: inherit; font: inherit; line-height: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
button:disabled { opacity: 0.65; cursor: wait; }
.back-button { grid-area: back; justify-self: center; width: min(312px, 100%); height: 85px; padding: 0 12px; background: #4e624a; }
.profile-page-title { grid-area: title; display: grid; place-items: center; margin: 0 29px 0 30px; padding: 0 12px; background: #4e624a; font: inherit; text-align: center; }
.user-panel { grid-area: user; display: flex; flex-direction: column; min-width: 0; margin-top: -10px; padding: 16px 32px 39px; background: rgb(138 140 137 / 20%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%); }
h2 { margin: 0; font: inherit; text-align: center; }
.user-panel h2 { transform: translateX(1.5px); white-space: nowrap; }
.identity-fields { margin: 25px 0 0; }
.identity-row { width: min(409px, 100%); }
.identity-row dt { text-align: center; }
.identity-row--name dt { transform: translateX(1px); }
.identity-row--birth-date { margin-top: 25px; }
.identity-row--email { margin-top: 26px; }
.identity-row--email dt { transform: translateX(-6px); }
.identity-value { display: grid; place-items: center; min-width: 0; width: 100%; height: 81px; margin: 13px 0 0; padding: 0 8px; background: #4e624a; text-align: center; overflow-wrap: anywhere; }
.identity-row--name .identity-value { margin-top: 6px; }
.identity-value--asset { position: relative; isolation: isolate; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); overflow: hidden; margin-left: 3px; padding-top: 13px; align-items: start; background: none; }
.field-asset { display: block; position: absolute; left: 0; top: 0; z-index: -1; }
.email-value { max-width: 100%; max-height: 100%; overflow: auto; line-height: 1.15; }
.email-value--long { font-size: max(16px, 0.75em); }
.email-value--very-long { font-size: max(16px, 0.5em); }
.email-value:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.logout-button { position: relative; isolation: isolate; flex: none; width: min(409px, 100%); height: 81px; margin: auto 0 0 3px; padding: 0 8px; overflow: hidden; background: none; }
.planning-panel { grid-area: planning; display: flex; flex-direction: column; min-width: 0; min-height: 783px; margin: 0 29px 39px 30px; padding: 16px 0 27px; background: #4e624a; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { float: left; width: 100%; padding: 0; text-align: center; }
legend + div { clear: both; }
.chronotype-fieldset { margin-top: 25px; }
.chronotype-options { display: grid; grid-template-columns: 288fr 233fr 213fr; width: 90.617284%; padding-top: 24px; }
.chronotype-options label { justify-self: center; }
.chronotype-options label:nth-child(-n+2) { transform: translateY(1px); }
label { display: flex; align-items: center; gap: 12px; cursor: pointer; }
input { flex: none; appearance: none; width: 30px; height: 30px; margin: 0; border: 1.5px solid #fff; border-radius: 3px; background: transparent; cursor: pointer; }
input:checked { background: #fff; box-shadow: inset 0 0 0 6px #4e624a; }
fieldset:disabled { opacity: 0.65; }
fieldset:disabled label, fieldset:disabled input { cursor: wait; }
.priority-fieldset { margin-top: 42px; }
.priority-options { display: grid; gap: 33px; padding: 31px 30px 0 38px; }
.planning-feedback { margin: 20px 38px 0; font-size: 20px; line-height: 1.4; overflow-wrap: anywhere; }
.planning-feedback p { margin: 0; }
.planning-error { padding: 10px; background: #693d35; }
.save-button { display: grid; place-items: center; flex: none; align-self: stretch; min-height: 91px; margin: auto 39px 0 38px; padding: 12px; background: #40523d; }
.save-button span { grid-area: 1 / 1; }
.save-label--hidden { visibility: hidden; }
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (hover: hover) { button:not(:disabled):hover { filter: brightness(1.08); } }
@media (min-width: 1001px) and (max-width: 1250px) { .user-panel { padding-inline: 20px; } .user-panel h2 { font-size: 0.9em; } label { gap: 8px; } input { width: 24px; height: 24px; } .priority-options { padding-inline: 24px; } }
@media (max-width: 1000px) {
  .profile-page { font-size: 26px; line-height: 1.4; }
  .profile-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; grid-template-areas: 'back' 'title' 'user' 'planning'; gap: 24px; padding: 24px 16px; }
  .settings-backdrop { display: none; }
  .back-button { height: 64px; }
  .profile-page-title { min-height: 76px; margin: 0; padding: 16px; }
  .user-panel { align-items: center; margin-top: 0; padding: 24px; }
  .user-panel h2 { transform: none; white-space: normal; }
  .identity-fields { width: min(409px, 100%); margin-top: 24px; }
  .identity-row dt { transform: none; }
  .identity-value { height: 72px; margin-left: 0; }
  .identity-value--asset { padding-top: 18px; }
  .logout-button { height: 72px; margin: 32px 0 0; }
  .planning-panel { min-height: 0; margin: 0; padding: 24px; }
  .chronotype-options { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px 28px; width: 100%; }
  .chronotype-options label:nth-child(-n+2) { transform: none; }
  .priority-fieldset { margin-top: 32px; }
  .priority-options { gap: 24px; padding: 24px 0 0; }
  label { min-height: 44px; gap: 12px; }
  input { width: 26px; height: 26px; }
  .planning-feedback { margin: 24px 0 0; font-size: 18px; }
  .save-button { min-height: 76px; margin: 32px 0 0; padding: 12px; }
}
@media (max-width: 600px) { .profile-page { font-size: 22px; } .chronotype-options { flex-direction: column; align-items: flex-start; } .priority-options label { align-items: flex-start; } .identity-value--asset { padding-top: 22px; } }
</style>
