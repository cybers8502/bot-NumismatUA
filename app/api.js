'use strict';

const API_BASE = process.env.API_BASE_URL;
// API_BASE_URL = https://coins.cybers.pro/wp-json/coins/v1
// WP standard REST API lives at /wp-json/wp/v2
const WP_BASE = API_BASE.replace(/\/coins\/v1\/?$/, '');

function basicAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`,
  ).toString('base64');
  return `Basic ${credentials}`;
}

async function searchCoins(query) {
  const url = `${WP_BASE}/wp/v2/coins?search=${encodeURIComponent(query)}&per_page=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getPriceHistory(coinId) {
  const url = `${API_BASE}/coins/${coinId}/price-history`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getCollection() {
  const url = `${API_BASE}/collection`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuthHeader() },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function addToCollection(coinId) {
  const url = `${API_BASE}/collection`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ coin_id: coinId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

module.exports = { searchCoins, getPriceHistory, getCollection, addToCollection };