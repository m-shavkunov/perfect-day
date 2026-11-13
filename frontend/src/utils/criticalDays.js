import { chartMetrics } from './chart.js'

export function groupCriticalDays(items) {
  const days = new Map()
  for (const item of items) {
    const metric = chartMetrics.find(metric => metric.id === item.biorhythm)
    const rising = item.direction === 'negative_to_positive'
    const entry = {
      ...item,
      label: metric.label,
      transition: rising ? '− → +' : '+ → −',
      directionLabel: rising ? 'из отрицательных значений в положительные' : 'из положительных значений в отрицательные',
    }
    if (!days.has(item.date)) days.set(item.date, [])
    days.get(item.date).push(entry)
  }
  return [...days].sort(([left], [right]) => left.localeCompare(right))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((left, right) => chartMetrics.findIndex(metric => metric.id === left.biorhythm)
        - chartMetrics.findIndex(metric => metric.id === right.biorhythm)),
    }))
}

export function describeCriticalEntries(entries) {
  return entries.map(entry => `${entry.label}: ${entry.directionLabel}`).join('; ')
}

export function getCriticalMarkers(layout, items) {
  return items.flatMap(item => {
    const series = layout.series.find(series => series.id === item.biorhythm)
    const point = series?.points.find(point => point.date === item.date)
    return point ? [{ ...item, x: point.x, y: point.y, color: series.color }] : []
  })
}
