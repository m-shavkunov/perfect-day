import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createChartLayout, getNearestChartIndex } from '../src/utils/chart.js'

const item = (date, physical = -100, emotional = 0, intellectual = 100) => ({ date, physical, emotional, intellectual })

test('chart uses the API percentages on a fixed −100…+100 scale at any size', () => {
  for (const [width, height] of [[240, 160], [640, 300]]) {
    const layout = createChartLayout([item('2026-11-08')], width, height)
    assert.equal(layout.series[0].points[0].y, layout.bottom)
    assert.equal(layout.series[1].points[0].y, (layout.top + layout.bottom) / 2)
    assert.equal(layout.series[2].points[0].y, layout.top)
    for (const series of layout.series) {
      assert.equal(series.points[0].x, (layout.left + layout.right) / 2)
      assert.equal(series.points.length, 1)
    }
    assert.deepEqual(layout.yTicks.map(tick => tick.value), [100, 50, 0, -50, -100])
    assert.equal(getNearestChartIndex(-1000, layout), 0)
    assert.equal(getNearestChartIndex(1000, layout), 0)
  }
})

test('monthly chart preserves every API day and exact values, while keeping date labels apart', () => {
  for (const count of [28, 29, 30, 31]) {
    const items = Array.from({ length: count }, (_, index) => item(`2026-01-${String(index + 1).padStart(2, '0')}`, 12.34, -56.78, 0))
    const layout = createChartLayout(items, 240, 200)
    assert.deepEqual(layout.points.map(point => point.date), items.map(point => point.date))
    assert.equal(layout.points[0].x, layout.left)
    assert.equal(layout.points.at(-1).x, layout.right)
    assert.equal(layout.points[0].physical, 12.34)
    assert.equal(layout.points.at(-1).emotional, -56.78)
    assert.equal(layout.xTicks[0].date, items[0].date)
    assert.equal(layout.xTicks.at(-1).date, items.at(-1).date)
    for (let index = 1; index < layout.xTicks.length; index++) {
      assert.ok(layout.xTicks[index].x - layout.xTicks[index - 1].x >= 60)
    }
    for (const series of layout.series) assert.equal(series.points.length, count)
  }
})

test('clicking at each plotted day selects its date, including both edges and out-of-bounds clicks', () => {
  const layout = createChartLayout([
    item('2026-12-30'), item('2026-12-31'), item('2027-01-01'), item('2027-01-02'),
  ], 640, 200)
  for (let index = 0; index < layout.points.length; index++) {
    assert.equal(getNearestChartIndex(layout.points[index].x, layout), index)
  }
  assert.equal(getNearestChartIndex(-100, layout), 0)
  assert.equal(getNearestChartIndex(1000, layout), 3)
  assert.equal(getNearestChartIndex((layout.points[1].x + layout.points[2].x) / 2 + 1, layout), 2)
})

test('empty chart data does not produce fabricated points, labels or selected dates', () => {
  const layout = createChartLayout([], 240, 200)
  assert.deepEqual(layout.points, [])
  assert.deepEqual(layout.xTicks, [])
  assert.ok(layout.series.every(series => series.points.length === 0))
  assert.equal(getNearestChartIndex(100, layout), -1)
})
