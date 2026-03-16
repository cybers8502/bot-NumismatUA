'use strict';

function getGraphqlUrl() {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error('API_BASE_URL environment variable is not set');
  return url;
}

function bearerHeader(authToken) {
  return `Bearer ${authToken}`;
}

async function gql(query, variables = {}, extraHeaders = {}) {
  const url = getGraphqlUrl();
  console.log('[api] GraphQL request →', url, JSON.stringify(variables));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ query, variables }),
  });

  const rawText = await res.text();
  console.log('[api] GraphQL response status:', res.status);

  if (!res.ok) {
    console.error('[api] HTTP error body:', rawText);
    throw new Error(`HTTP ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch (e) {
    console.error('[api] Failed to parse JSON:', rawText);
    throw new Error('Invalid JSON response');
  }

  if (json.errors) {
    console.error('[api] GraphQL errors:', JSON.stringify(json.errors));
    throw new Error(json.errors[0].message);
  }

  console.log('[api] GraphQL data keys:', Object.keys(json.data ?? {}));
  return json.data;
}

async function searchCoins(query) {
  const data = await gql(
    `query SearchCoins($search: String!) {
      coins(where: { search: $search }) {
        nodes {
          databaseId
          title
        }
      }
    }`,
    { search: query },
  );
  return data.coins.nodes.map((c) => ({
    id: c.databaseId,
    title: { rendered: c.title },
    photo: null,
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

/**
 * Authenticates with WordPress via GraphQL mutation.
 * Returns { authToken, refreshToken } on success, throws on failure.
 */
async function getCoinGallery(coinId) {
  const data = await gql(
    `query GetCoin($id: ID!) {
      coin(id: $id, idType: DATABASE_ID) {
        gallery {
          medium
        }
      }
    }`,
    { id: String(coinId) },
  );
  return data.coin?.gallery ?? [];
}

async function loginUser(username, password) {
  const data = await gql(
    `mutation Login($username: String!, $password: String!) {
      login(input: { username: $username, password: $password }) {
        authToken
        refreshToken
      }
    }`,
    { username, password },
  );
  return data.login;
}

async function logoutUser(authToken) {
  await gql(
    `mutation { logout(input: {}) { success } }`,
    {},
    { Authorization: bearerHeader(authToken) },
  );
}

async function refreshAuthToken(refreshToken) {
  const data = await gql(
    `mutation RefreshToken($token: String!) {
      refreshJwtAuthToken(input: { jwtRefreshToken: $token }) {
        authToken
      }
    }`,
    { token: refreshToken },
  );
  return data.refreshJwtAuthToken.authToken;
}

async function getCollection(authToken) {
  const data = await gql(
    `query {
      myCollection {
        coinId
        quantity
        purchasePrice
      }
    }`,
    {},
    { Authorization: bearerHeader(authToken) },
  );
  return data.myCollection.map((item) => ({
    coin_id: item.coinId,
    quantity: item.quantity,
    paid: item.purchasePrice ?? 0,
  }));
}

async function addToCollection(coinId, authToken) {
  await gql(
    `mutation AddToCollection($coinId: Int!) {
      addToCollection(input: { coinId: $coinId }) {
        success
      }
    }`,
    { coinId: Number(coinId) },
    { Authorization: bearerHeader(authToken) },
  );
}

module.exports = {
  searchCoins,
  getPriceHistory,
  getCoinGallery,
  loginUser,
  logoutUser,
  refreshAuthToken,
  getCollection,
  addToCollection,
};
