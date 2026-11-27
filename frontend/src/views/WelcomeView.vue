<script setup>
import welcomeLeaf from '../assets/welcome-leaf.svg'
</script>

<template>
  <section class="start-page" aria-labelledby="start-title">
    <div class="start-panel glass-panel">
      <img class="start-mark" :src="welcomeLeaf" alt="" width="148" height="148" />
      <h1 id="start-title">Идеальный день</h1>
      <div class="start-actions">
        <RouterLink :to="{ name: 'login' }">Вход</RouterLink>
        <RouterLink :to="{ name: 'register' }">Регистрация</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.start-page {
  display: grid;
  place-items: center;
  min-height: 100svh;
  padding: 30px clamp(16px, 5.49vw, 79px);
  color: #fff;
  font-family: 'Times New Roman', serif;
  text-align: center;
}
.start-panel {
  width: min(1282px, 100%);
  min-height: min(964px, calc(100svh - 60px));
  padding: clamp(42px, 11.3svh, 116px) 16px 36px;
}
.start-mark { display: block; width: clamp(86px, 14.5svh, 148px); height: auto; margin: 0 auto clamp(24px, 4.3svh, 44px); }
h1 { font-size: clamp(30px, 3.33vw, 48px); font-weight: 400; }
.start-actions { display: grid; justify-items: center; gap: clamp(24px, 6.8svh, 70px); margin-top: clamp(52px, 13svh, 134px); }
a {
  display: grid;
  place-items: center;
  width: min(100%, 381px);
  min-height: clamp(55px, 10svh, 102px);
  padding: 8px 12px;
  background: var(--surface-action);
  color: inherit;
  font-size: clamp(24px, 2.78vw, 40px);
  text-decoration: none;
}
a:hover { background: #3f533b; }
a:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
@media (max-width: 600px) {
  .start-page { padding: clamp(24px, 7.6svh, 70px) clamp(16px, 5.83vw, 24px); }
  .start-panel { min-height: min(777px, 84.8svh); padding-top: clamp(64px, 10.6svh, 97px); }
  .start-mark { width: clamp(72px, 12.5svh, 115px); margin-bottom: 20px; }
  .start-actions { gap: 24px; margin-top: clamp(36px, 10svh, 92px); }
  a { min-height: 55px; font-size: 28px; }
}
</style>
