<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import chartBaseline from '../assets/chart-baseline.svg'
import { auth, signOut } from '../state/auth.js'

const router = useRouter()
const profileDialog = ref(null)
const selectedPeriod = ref('day')
const periods = [
  { value: 'day', label: 'День', empty: 'Нет данных за день' },
  { value: 'week', label: 'Неделя', empty: 'Нет данных за неделю' },
  { value: 'month', label: 'Месяц', empty: 'Нет данных за месяц' },
]
const biorhythms = [
  { id: 'physical', label: 'Физический' },
  { id: 'emotional', label: 'Эмоциональный' },
  { id: 'intellectual', label: 'Интеллектуальный' },
]
const emptyMessage = computed(() => periods.find(({ value }) => value === selectedPeriod.value).empty)

function openProfile() {
  profileDialog.value.showModal()
}

function closeProfile() {
  profileDialog.value.close()
}

async function logout() {
  closeProfile()
  signOut()
  auth.notice = ''
  await router.replace({ name: 'login' })
}
</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title" class="visually-hidden">Дашборд</h1>
    <div class="dashboard-layout">
      <aside class="dashboard-sidebar" aria-label="Профиль и показатели на сегодня">
        <button class="profile-button" type="button" @click="openProfile">Профиль</button>
        <section class="summary-panel glass-panel" aria-labelledby="summary-title">
          <h2 id="summary-title" class="visually-hidden">Биоритмы на сегодня</h2>
          <dl class="metrics">
            <div v-for="biorhythm in biorhythms" :key="biorhythm.id" class="metric">
              <dt>{{ biorhythm.label }}:</dt>
              <dd><span aria-hidden="true">—</span><span class="visually-hidden">Нет данных</span></dd>
            </div>
          </dl>
          <p class="summary-empty">Данные пока не загружены.</p>
          <p class="recommendations-empty">Рекомендаций пока нет</p>
        </section>
      </aside>
      <section class="forecast-panel glass-panel" aria-label="Прогноз биоритмов">
        <div class="period-switch" role="group" aria-label="Период прогноза">
          <button
            v-for="period in periods"
            :key="period.value"
            type="button"
            :aria-pressed="selectedPeriod === period.value"
            @click="selectedPeriod = period.value"
          >
            {{ period.label }}
          </button>
        </div>
        <p class="visually-hidden" role="status">{{ emptyMessage }}</p>
        <div class="chart-list">
          <section
            v-for="biorhythm in biorhythms"
            :key="biorhythm.id"
            class="chart-slot"
            :aria-labelledby="`chart-${biorhythm.id}`"
          >
            <h2 :id="`chart-${biorhythm.id}`">{{ biorhythm.label }}:</h2>
            <p class="chart-empty">{{ emptyMessage }}</p>
            <div class="chart-baseline" aria-hidden="true">
              <img :src="chartBaseline" alt="" />
            </div>
          </section>
        </div>
      </section>
    </div>
    <dialog ref="profileDialog" class="profile-dialog" aria-labelledby="profile-dialog-title">
      <div class="dialog-header">
        <h2 id="profile-dialog-title">Профиль</h2>
        <button class="dialog-close" type="button" aria-label="Закрыть профиль" @click="closeProfile">×</button>
      </div>
      <dl v-if="auth.user" class="profile-details">
        <div><dt>Email</dt><dd>{{ auth.user.email }}</dd></div>
        <div><dt>Дата рождения</dt><dd>{{ auth.user.birth_date.split('-').reverse().join('.') }}</dd></div>
        <div><dt>Хронотип</dt><dd>{{ { lark: 'Жаворонок', owl: 'Сова', dove: 'Голубь' }[auth.user.chronotype] || auth.user.chronotype }}</dd></div>
      </dl>
      <div class="dialog-actions">
        <button type="button" @click="logout">Выйти из аккаунта</button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.dashboard-page {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100svh;
  background: linear-gradient(rgb(83 98 66 / 87%), rgb(83 98 66 / 87%)), #fff;
  color: #fff;
  font-family: 'Times New Roman', serif;
  line-height: normal;
}
.dashboard-page::before {
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
.dashboard-layout {
  display: grid;
  grid-template-columns: minmax(0, 476fr) minmax(0, 869fr);
  gap: 34px;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 29px 31px 0 30px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.glass-panel { background: rgb(138 140 137 / 20%); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%); }
button, .dialog-link {
  padding: 12px;
  border: 0;
  border-radius: 0;
  background: #4e624a;
  color: #fff;
  font: inherit;
  font-size: clamp(22px, 2.777778vw, 40px);
  line-height: 46px;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}
button:focus-visible, a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
button:active { background: #344630; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
.dashboard-sidebar { display: flex; flex-direction: column; min-width: 0; }
.profile-button { align-self: center; width: 312px; max-width: 100%; min-height: 85px; margin-top: 32px; }
.summary-panel { flex: 1; min-width: 0; min-height: calc(100svh - 192px); margin-top: 46px; padding: 89px 51px 32px; }
.metrics { margin: 0; font-size: clamp(22px, 2.777778vw, 40px); line-height: 46px; }
.metric { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; }
.metric dt { overflow-wrap: anywhere; }
.metric dd { margin: 0; font-size: 0.8em; }
.summary-empty { margin: 16px 0 0; font-size: 22px; line-height: 26px; }
.recommendations-empty { max-width: 302px; margin: 137px auto 0; font-size: clamp(24px, 2.777778vw, 40px); line-height: 46px; text-align: center; }
.forecast-panel { min-width: 0; min-height: calc(100svh - 29px); padding: 32px 0 40px; }
.period-switch { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 35px; margin: 0 24px 0 25px; }
.period-switch button { min-height: 85px; padding: 12px 4px; }
.period-switch button[aria-pressed='true'] { background: #344630; box-shadow: inset 0 0 0 2px #fff; }
.chart-list { padding: 0 62px 0 63px; margin-top: 99px; }
.chart-slot { min-width: 0; }
.chart-slot h2 { margin: 0; font-size: clamp(22px, 2.777778vw, 40px); font-weight: 400; line-height: 46px; overflow-wrap: anywhere; }
.chart-slot:nth-child(2) { margin-top: 99px; }
.chart-slot:nth-child(3) { margin-top: 74px; }
.chart-empty { display: grid; place-items: center; min-height: 99px; margin: 0; padding: 12px; font-size: 22px; line-height: 26px; text-align: center; }
.chart-slot:not(:first-child) .chart-empty { min-height: 100px; }
.chart-baseline { display: flex; align-items: center; justify-content: center; height: 9px; }
.chart-baseline img { flex: none; display: block; width: 744.054px; max-width: 100%; height: auto; transform: rotate(-0.69deg); }
.profile-dialog { width: min(640px, calc(100% - 32px)); max-height: calc(100svh - 48px); padding: 32px; border: 1px solid rgb(255 255 255 / 40%); color: #fff; background: #3f533b; font: inherit; }
.profile-dialog::backdrop { background: rgb(0 0 0 / 60%); }
.dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dialog-header h2 { margin: 0; font-size: 40px; font-weight: 400; }
.dialog-close { padding: 0; width: 48px; min-height: 48px; font-size: 36px; line-height: 1; }
.profile-dialog p { margin: 24px 0; font-size: 24px; line-height: 1.4; }
.profile-details { margin: 24px 0; font-size: 22px; line-height: 1.4; overflow-wrap: anywhere; }
.profile-details div + div { margin-top: 16px; }
.profile-details dt { font-weight: 700; }
.profile-details dd { margin: 4px 0 0; }
.dialog-actions { display: flex; flex-wrap: wrap; gap: 16px; }
.dialog-actions button, .dialog-link { font-size: 22px; line-height: 1.4; }
.dialog-link { display: inline-block; text-align: center; text-decoration: none; }
@media (hover: hover) {
  button:not(:disabled):hover, .dialog-link:hover { background: #5b7055; }
  .period-switch button[aria-pressed='true']:hover { background: #344630; }
  button:not(:disabled):active { background: #344630; }
}
@media (min-width: 901px) and (max-width: 1399px) {
  .summary-panel { padding-inline: 32px; }
  .metrics { font-size: clamp(22px, 2.4vw, 32px); }
}
@media (max-width: 900px) {
  .dashboard-layout { grid-template-columns: minmax(0, 1fr); padding: 24px 16px; gap: 24px; }
  .profile-button { min-height: 64px; margin-top: 0; line-height: 1.2; }
  .summary-panel { min-height: 0; margin-top: 24px; padding: 32px; }
  .metrics { line-height: 1.5; }
  .metric { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
  .recommendations-empty { max-width: none; margin-top: 32px; line-height: 1.3; }
  .forecast-panel { min-height: 0; padding: 24px 0 32px; }
  .period-switch { margin: 0 24px; gap: 12px; }
  .period-switch button { min-height: 56px; line-height: 1.2; }
  .chart-list { margin-top: 40px; padding: 0 32px; }
  .chart-slot h2 { line-height: 1.3; }
  .chart-slot:nth-child(2), .chart-slot:nth-child(3) { margin-top: 40px; }
  .chart-empty, .chart-slot:not(:first-child) .chart-empty { min-height: 80px; font-size: 20px; }
}
@media (max-width: 600px) {
  .summary-panel { padding: 24px; }
  .summary-empty { font-size: 18px; line-height: 1.4; }
  .period-switch { margin: 0 16px; gap: 8px; }
  .period-switch button { font-size: 20px; }
  .chart-list { padding: 0 24px; }
  .chart-empty, .chart-slot:not(:first-child) .chart-empty { min-height: 72px; font-size: 18px; }
  .profile-dialog { padding: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  button, .dialog-link { transition: none; }
}
</style>



