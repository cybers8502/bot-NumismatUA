'use strict';

function getGraphqlUrl() {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error('API_BASE_URL environment variable is not set');
  return url;
}

function bearerHeader(authToken) {
  return `Bearer ${authToken}`;
}

// --- Anonymous app token -----------------------------------------------
// wp-coins requires an X-App-Token header on every /graphql request that
// isn't already authenticated (anti-scraping gate, see Security\ApiGuardService
// in the wp-coins theme repo). Fetched once, cached in memory, refreshed on 401.

const APP_TOKEN_EXPIRY_BUFFER_MS = 60_000;

let cachedAppToken = null; // { token, expiresAt }
let appTokenPromise = null;

function getAppTokenUrl() {
  return getGraphqlUrl().replace(
    /\/graphql\/?$/,
    '/wp-json/coins/v1/app-token',
  );
}

async function fetchAppToken() {
  const res = await fetch(getAppTokenUrl());

  if (!res.ok) {
    throw new Error(`Failed to fetch app token: HTTP ${res.status}`);
  }

  const { token, expires_in } = await res.json();
  cachedAppToken = {
    token,
    expiresAt: Date.now() + expires_in * 1000 - APP_TOKEN_EXPIRY_BUFFER_MS,
  };

  return cachedAppToken.token;
}

async function getAppToken() {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return cachedAppToken.token;
  }

  if (!appTokenPromise) {
    appTokenPromise = fetchAppToken().finally(() => {
      appTokenPromise = null;
    });
  }

  return appTokenPromise;
}

// --- GraphQL client -------------------------------------------------------

async function gql(query, variables = {}, extraHeaders = {}, _isRetry = false) {
  const url = getGraphqlUrl();
  const appToken = await getAppToken();

  console.log('[api] GraphQL request →', url, JSON.stringify(variables));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Token': appToken,
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });

  const rawText = await res.text();
  console.log('[api] GraphQL response status:', res.status);

  if (res.status === 401 && !_isRetry) {
    console.log('[api] App token rejected, refreshing and retrying once');
    cachedAppToken = null;
    return gql(query, variables, extraHeaders, true);
  }

  if (!res.ok) {
    console.error('[api] HTTP error body:', rawText);
    throw new Error(`HTTP ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
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
          shortTitle
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
          url
        }
      }
    }`,
    { id: String(coinId) },
  );
  return data.coin?.gallery ?? [];
}

async function getCoinDetails(coinId) {
  const data = await gql(
    `query GetCoinDetails($id: ID!) {
      coin(id: $id, idType: DATABASE_ID) {
        databaseId
        title
        shortTitle
        coinTypes            { nodes { name } }
        coinSeriesList       { nodes { name } }
        coinDenominations    { nodes { name } }
        coinMaterials        { nodes { name } }
        coinQualities        { nodes { name } }
        coinEdges            { nodes { name } }
        coinDiameters        { nodes { name } }
        coinMintagesDeclared { nodes { name } }
        coinMintagesActual   { nodes { name } }
        coinColors           { nodes { name } }
        coinPackagings       { nodes { name } }
      }
    }`,
    { id: String(coinId) },
  );
  return data.coin;
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
        coinTitle
        quantity
        purchasePrice
      }
    }`,
    {},
    { Authorization: bearerHeader(authToken) },
  );
  return data.myCollection.map((item) => ({
    coin_id: item.coinId,
    title: item.coinTitle || `Монета #${item.coinId}`,
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
  getCoinDetails,
  loginUser,
  logoutUser,
  refreshAuthToken,
  getCollection,
  addToCollection,
};
