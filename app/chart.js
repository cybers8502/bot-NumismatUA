'use strict';

const QUICKCHART_CREATE_URL = 'https://quickchart.io/chart/create';

// QuickChart's free tier rejects a chart above a couple hundred data points
// (confirmed empirically by bisection: 815 and 500 both 400 with "Maximum
// chart data exceeded", 250 succeeded, the real cutoff sits somewhere in
// 250-300 — kept well under that for margin). /chart/create still reports
// success and hands back a URL that 400s on render, so this has to be
// prevented up front, not caught after the fact. A coin with 2+ years of
// daily ua-coins.info history routinely exceeds it now, so this isn't a rare
// edge case.
const MAX_CHART_POINTS = 200;

function formatChartDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

/** Evenly thins a sorted array down to at most maxPoints, always keeping the first and last point. */
function downsample(sortedPoints, maxPoints) {
  if (sortedPoints.length <= maxPoints) return sortedPoints;

  const stride = (sortedPoints.length - 1) / (maxPoints - 1);
  const picked = [];
  for (let i = 0; i < maxPoints; i++) {
    picked.push(sortedPoints[Math.round(i * stride)]);
  }
  return picked;
}

/**
 * Builds a short-lived QuickChart.io image URL for a coin's price history.
 * Uses the /chart/create short-URL endpoint instead of encoding the config
 * into the URL itself — some coins have 200+ price points, which would
 * otherwise produce an unwieldy URL.
 *
 * Returns null if there isn't enough data to plot a line.
 */
async function buildPriceChartUrl(priceHistory) {
  if (!Array.isArray(priceHistory) || priceHistory.length < 2) {
    return null;
  }

  const sorted = priceHistory
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const plotted = downsample(sorted, MAX_CHART_POINTS);

  const chartConfig = {
    type: 'line',
    data: {
      labels: plotted.map((p) => formatChartDate(p.date)),
      datasets: [
        {
          label: 'Ціна, грн',
          data: plotted.map((p) => p.price),
          borderColor: '#2b6cb0',
          backgroundColor: 'rgba(43, 108, 176, 0.15)',
          fill: true,
          pointRadius: 0,
          tension: 0.2,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 8, autoSkip: true } } },
    },
  };

  const res = await fetch(QUICKCHART_CREATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart: chartConfig,
      width: 600,
      height: 350,
      backgroundColor: 'white',
      devicePixelRatio: 2,
    }),
  });

  if (!res.ok) {
    throw new Error(`QuickChart create failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.success || !data.url) {
    throw new Error('QuickChart create returned no url');
  }

  return data.url;
}

module.exports = { buildPriceChartUrl };
