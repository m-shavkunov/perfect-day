<script setup>
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div :class="route.meta.layout === 'auth' ? 'auth-shell' : 'app-shell'">
    <main :class="route.meta.layout === 'auth' ? 'auth-content' : 'page-content'">
      <RouterView />
    </main>
  </div>
</template>
