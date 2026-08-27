'use strict';

const QUICKCHART_CREATE_URL = 'https://quickchart.io/chart/create';

function formatChartDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
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

  const chartConfig = {
    type: 'line',
    data: {
      labels: sorted.map((p) => formatChartDate(p.date)),
      datasets: [
        {
          label: 'Ціна, грн',
          data: sorted.map((p) => p.price),
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
