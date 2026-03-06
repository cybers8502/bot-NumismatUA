'use strict';

const API_BASE = process.env.API_BASE_URL;
const GRAPHQL_URL = API_BASE.replace(/\/wp-json\/coins\/v1\/?$/, '/graphql');

function basicAuthHeader() {
  const credentials = Buffer.from(
    `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`,
  ).toString('base64');
  return `Basic ${credentials}`;
}

async function gql(query, variables = {}, extraHeaders = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

async function searchCoins(query) {
  const data = await gql(
    `query SearchCoins($search: String!) {
      coins(where: { search: $search }, first: 5) {
        nodes {
          databaseId
          title
          featuredImage {
            node {
              sourceUrl(size: MEDIUM)
            }
          }
        }
      }
    }`,
    { search: query },
  );
  return data.coins.nodes.map((c) => ({
    id: c.databaseId,
    title: { rendered: c.title },
    photo: c.featuredImage?.node?.sourceUrl ?? null,
  }));
}

async function getPriceHistory(coinId) {
  const data = await gql(
    `query GetPriceHistory($id: ID!) {
      coin(id: $id, idType: DATABASE_ID) {
        priceHistory {
          date
          price
          source
        }
      }
    }`,
    { id: String(coinId) },
  );
  return data.coin?.priceHistory ?? [];
}

async function getCollection() {
  const data = await gql(
    `query {
      myCollection {
        coinId
        quantity
        purchasePrice
      }
    }`,
    {},
    { Authorization: basicAuthHeader() },
  );
  return data.myCollection.map((item) => ({
    coin_id: item.coinId,
    quantity: item.quantity,
    paid: item.purchasePrice ?? 0,
  }));
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