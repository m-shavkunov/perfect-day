export const chartMetrics = [
  { id: 'physical', label: 'Физический', shortLabel: 'Физ.', color: '#ffdb8a', dash: '' },
  { id: 'emotional', label: 'Эмоциональный', shortLabel: 'Эмоц.', color: '#ffb6d4', dash: '8 5' },
  { id: 'intellectual', label: 'Интеллектуальный', shortLabel: 'Интел.', color: '#a8e4ff', dash: '2 5' },
]

export function createChartLayout(items, width, height) {
  const left = 49
  const right = width - 22
  const top = 16
  const bottom = height - 30
  const points = items.map((item, index) => ({
    ...item,
    x: items.length === 1 ? (left + right) / 2 : left + index * (right - left) / (items.length - 1),
  }))
  const y = value => top + (100 - value) / 200 * (bottom - top)
  const tickCount = Math.min(items.length, Math.max(2, Math.floor((right - left) / 62) + 1))
  const tickIndexes = Array.from({ length: tickCount }, (_, index) =>
    tickCount === 1 ? 0 : Math.round(index * (items.length - 1) / (tickCount - 1)))

  return {
    left, right, top, bottom, points,
    yTicks: [100, 50, 0, -50, -100].map(value => ({ value, y: y(value) })),
    xTicks: tickIndexes.map(index => points[index]),
    series: chartMetrics.map(metric => ({
      ...metric,
      points: points.map(item => ({ date: item.date, x: item.x, y: y(item[metric.id]) })),
    })),
  }
}

export function getNearestChartIndex(x, layout) {
  if (!layout.points.length) return -1
  if (layout.points.length === 1) return 0
  return Math.max(0, Math.min(layout.points.length - 1,
    Math.round((x - layout.left) / (layout.right - layout.left) * (layout.points.length - 1))))
}
