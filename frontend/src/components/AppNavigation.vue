<script setup>
import { RouterLink } from 'vue-router'

const sections = [
  { name: 'dashboard', label: 'Дашборд' },
  { name: 'tasks', label: 'Задачи' },
  { name: 'schedule', label: 'Расписание' },
  { name: 'profile', label: 'Профиль' },
]
</script>

<template>
  <nav class="app-navigation" aria-label="Разделы приложения">
    <RouterLink
      v-for="section in sections" :key="section.name" :to="{ name: section.name }"
      class="app-navigation__link" exact-active-class="app-navigation__link--current"
    >{{ section.label }}</RouterLink>
  </nav>
</template>

<style scoped>
.app-navigation {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr 1.3fr 1fr;
  gap: 8px;
  width: min(100%, 440px);
  height: var(--app-navigation-height);
  flex: none;
}
.app-navigation__link {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 44px;
  padding: 8px 6px;
  background: #4e624a;
  color: #fff;
  font: clamp(18px, 1.5vw, 21px)/1.2 'Times New Roman', serif;
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
}
.app-navigation__link:hover { background: #354730; }
.app-navigation__link--current {
  background: #eff3e8;
  color: #283f28;
  box-shadow: inset 0 -4px #283f28;
  font-weight: 700;
}
.app-navigation__link--current:hover { background: #e0e8d6; }
.app-navigation__link:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
@media (max-width: 1200px) {
  .app-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .app-navigation { width: 100%; }
  .app-navigation__link { font-size: 20px; }
}
</style>
