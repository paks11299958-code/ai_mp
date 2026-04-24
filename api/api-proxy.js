const { GoogleAuth } = require('google-auth-library');

const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const PROXY_HEADER = process.env.PROXY_HEADER;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    parts.push(escapeRegex(pattern.substring(lastIndex, match.index)));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));

  return { regex: new RegExp(`^${parts.join('')}$`), params };
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((name, i) => { params[name] = match[i + 1]; });
  return params;
}

const API_CLIENT_MAP = [
  {
    name: 'VertexGenAi:generateContent',
    patternForProxy: 'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent',
    getApiEndpoint: (ctx, p) => `https://aiplatform.clients6.google.com/${p.version}/projects/${ctx.projectId}/locations/${ctx.region}/publishers/google/models/${p.model}:generateContent`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'VertexGenAi:predict',
    patternForProxy: 'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict',
    getApiEndpoint: (ctx, p) => `https://aiplatform.clients6.google.com/${p.version}/projects/${ctx.projectId}/locations/${ctx.region}/publishers/google/models/${p.model}:predict`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'VertexGenAi:streamGenerateContent',
    patternForProxy: 'https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent',
    getApiEndpoint: (ctx, p) => `https://aiplatform.clients6.google.com/${p.version}/projects/${ctx.projectId}/locations/${ctx.region}/publishers/google/models/${p.model}:streamGenerateContent`,
    isStreaming: true,
    transformFn: (response) => {
      let normalized = response.trim();
      while (normalized.startsWith(',') || normalized.startsWith('[')) normalized = normalized.substring(1).trim();
      while (normalized.endsWith(',') || normalized.endsWith(']')) normalized = normalized.substring(0, normalized.length - 1).trim();
      if (!normalized.length) return { result: null, inProgress: false };
      if (!normalized.endsWith('}')) return { result: normalized, inProgress: true };
      try {
        return { result: `data: ${JSON.stringify(JSON.parse(normalized))}\n\n`, inProgress: false };
      } catch (e) {
        throw new Error(`Failed to parse response: ${e}`);
      }
    },
  },
  {
    name: 'ReasoningEngine:query',
    patternForProxy: 'https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:query',
    getApiEndpoint: (ctx, p) => `https://${p.endpoint_location}-aiplatform.clients6.google.com/v1beta1/projects/${p.project_id}/locations/${p.location_id}/reasoningEngines/${p.engine_id}:query`,
    isStreaming: false,
    transformFn: null,
  },
  {
    name: 'ReasoningEngine:streamQuery',
    patternForProxy: 'https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:streamQuery',
    getApiEndpoint: (ctx, p) => `https://${p.endpoint_location}-aiplatform.clients6.google.com/v1beta1/projects/${p.project_id}/locations/${p.location_id}/reasoningEngines/${p.engine_id}:streamQuery`,
    isStreaming: true,
    transformFn: null,
  },
].map(client => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

const authConfig = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? { credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) }
  : {};

const auth = new GoogleAuth({
  ...authConfig,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required');
  }

  let extractedParams = null;
  const apiClient = API_CLIENT_MAP.find(p => {
    extractedParams = extractParams(p.patternInfo, originalUrl);
    return extractedParams !== null;
  });

  if (!apiClient) {
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  try {
    const accessToken = await getAccessToken();
    const apiUrl = apiClient.getApiEndpoint(
      { projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION },
      extractedParams
    );

    const apiHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
      'Content-Type': 'application/json',
    };

    const apiResponse = await fetch(apiUrl, {
      method: method || 'POST',
      headers: { ...apiHeaders, ...headers },
      body: body || undefined,
    });

    if (apiClient.isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Connection', 'keep-alive');

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder();
      let deltaChunk = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!apiClient.transformFn) {
          res.write(Buffer.from(value));
        } else {
          deltaChunk += decoder.decode(value, { stream: true });
          const { result, inProgress } = apiClient.transformFn(deltaChunk);
          if (result && !inProgress) {
            deltaChunk = '';
            res.write(Buffer.from(result));
          }
        }
      }
      res.end();
    } else {
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error('[Vercel Proxy] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
