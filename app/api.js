'use strict';

const GRAPHQL_URL = process.env.API_BASE_URL;
if (!GRAPHQL_URL) throw new Error('API_BASE_URL environment variable is not set');

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

module.exports = { searchCoins, getPriceHistory, getCollection };