<script setup>
import intellectual from '../assets/task-intellectual.png'
import physical from '../assets/task-physical.png'
import creative from '../assets/task-creative.png'
import routine from '../assets/task-routine.png'

defineProps({ type: String, picker: Boolean })

const icons = {
  intellectual: { src: intellectual, size: 64 },
  physical: { src: physical, size: 70 },
  creative: { src: creative, size: 64 },
  routine: { src: routine, size: 67 },
}
</script>

<template>
  <img v-if="icons[type]" :src="icons[type].src" alt="" :width="picker ? icons[type].size : 32" />
</template>

<style scoped>
img { display: block; max-width: 100%; height: auto; flex: none; }
</style>
