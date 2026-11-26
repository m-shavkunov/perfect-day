<script setup>
import { ref, useId, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import menuIcon from '../assets/mobile-menu.png'

const route = useRoute()
const menuId = useId()
const menuOpen = ref(false)
const menuToggle = ref(null)

watch(() => route.name, () => { menuOpen.value = false })

function closeMenu() {
  if (!menuOpen.value || !menuToggle.value?.offsetParent) return
  menuOpen.value = false
  menuToggle.value.focus()
}

const sections = [
  { name: 'dashboard', label: 'Дашборд' },
  { name: 'tasks', label: 'Задачи' },
  { name: 'schedule', label: 'Расписание' },
  { name: 'profile', label: 'Профиль' },
]
</script>

<template>
  <nav class="app-navigation" aria-label="Разделы приложения" @keydown.esc="closeMenu">
    <div class="app-navigation__header">
      <button
        ref="menuToggle" class="app-navigation__toggle" type="button" aria-label="Меню приложения"
        :aria-expanded="menuOpen" :aria-controls="menuId" @click="menuOpen = !menuOpen"
      >
        <img :src="menuIcon" alt="" width="55" height="55" />
      </button>
      <span>Идеальный день</span>
    </div>
    <div :id="menuId" class="app-navigation__links" :class="{ 'app-navigation__links--open': menuOpen }">
      <RouterLink
        v-for="section in sections" :key="section.name" :to="{ name: section.name }"
        class="app-navigation__link" exact-active-class="app-navigation__link--current"
        @click="section.name === route.name && closeMenu()"
      >{{ section.label }}</RouterLink>
    </div>
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
.app-navigation__links { display: contents; }
.app-navigation__header { display: none; }
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
  font-weight: 700;
}
.app-navigation__link--current:hover { background: #e0e8d6; }
.app-navigation__link:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
@media (max-width: 1200px) {
  .app-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .app-navigation { position: relative; z-index: 2; display: block; width: 100%; }
  .app-navigation__link { font-size: 20px; }
  .app-navigation__header {
    display: grid;
    grid-template-columns: 65px minmax(0, 1fr) 65px;
    align-items: center;
    min-height: var(--app-navigation-height);
    background: #4e624a;
    color: #fff;
    font: clamp(23px, 7vw, 30px)/1.05 'Times New Roman', serif;
    text-align: center;
  }
  .app-navigation__toggle {
    display: grid;
    place-items: center;
    width: 55px;
    height: 55px;
    margin-inline-start: 10px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .app-navigation__toggle img { display: block; }
  .app-navigation__toggle:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
  .app-navigation__links {
    position: absolute;
    inset: 100% 0 auto;
    display: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 8px;
    background: #354730;
  }
  .app-navigation__links--open { display: grid; }
}
</style>
