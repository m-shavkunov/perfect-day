const percentageFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'percent',
  signDisplay: 'exceptZero',
  maximumFractionDigits: 2,
})

export function formatPercentage(value) {
  return percentageFormatter.format(value / 100).replace('-', '−')
}
