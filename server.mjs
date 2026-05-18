import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
let googleTokens = null;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function extractOpenAIText(response) {
  return response.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n\n") || "";
}

function collectTextValues(value, bucket = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextValues(item, bucket));
    return bucket;
  }

  if (!value || typeof value !== "object") {
    return bucket;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue === "string" && key === "text") {
      bucket.push(nestedValue);
    } else {
      collectTextValues(nestedValue, bucket);
    }
  }

  return bucket;
}

function extractGeminiText(response) {
  const directOutputText = response.outputs
    ?.filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n\n");

  if (directOutputText) {
    return directOutputText;
  }

  const nestedOutputText = response.outputs
    ?.flatMap((item) => item?.content || [])
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n\n");

  if (nestedOutputText) {
    return nestedOutputText;
  }

  const textCandidates = collectTextValues(response)
    .filter((text) => text.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  return textCandidates[0] || null;
}

async function startOpenAIResearch(prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "o4-mini-deep-research",
      input: prompt,
      background: true,
      tools: [{ type: "web_search_preview" }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI start failed: ${response.status}`);
  }

  return response.json();
}

async function getOpenAIResearch(id) {
  const response = await fetch(`https://api.openai.com/v1/responses/${id}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI status failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    report: data.status === "completed" ? extractOpenAIText(data) : null,
    raw: data,
  };
}

async function startGeminiResearch(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      input: prompt,
      agent: "deep-research-pro-preview-12-2025",
      background: true,
      tools: [{ type: "google_search" }],
      agent_config: {
        type: "deep-research",
        thinking_summaries: "auto",
        visualization: "off",
        collaborative_planning: false,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini start failed: ${response.status}`);
  }

  return response.json();
}

async function getGeminiResearch(id) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions/${id}`, {
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
      "Api-Revision": "2026-05-20",
    },
  });

  if (!response.ok) {
    throw new Error(`Gemini status failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    report: extractGeminiText(data),
    raw: data,
  };
}

function googleAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  googleTokens = await response.json();
}

async function refreshGoogleAccessToken() {
  if (!googleTokens?.refresh_token) {
    throw new Error("Missing Google refresh token");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: googleTokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  const refreshed = await response.json();
  googleTokens = {
    ...googleTokens,
    ...refreshed,
  };
}

async function googleRequest(url, options = {}) {
  if (!googleTokens?.access_token) {
    throw new Error("Google authorization required");
  }

  let response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${googleTokens.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && googleTokens.refresh_token) {
    await refreshGoogleAccessToken();
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${googleTokens.access_token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  }

  return response;
}

async function createGoogleDoc(title, content) {
  const createResponse = await googleRequest("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    body: JSON.stringify({ title }),
  });

  if (!createResponse.ok) {
    throw new Error(`Google Docs create failed: ${createResponse.status}`);
  }

  const document = await createResponse.json();
  const updateResponse = await googleRequest(`https://docs.googleapis.com/v1/documents/${document.documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Google Docs update failed: ${updateResponse.status}`);
  }

  return {
    documentId: document.documentId,
    url: `https://docs.google.com/document/d/${document.documentId}/edit`,
  };
}

function buildRawEmail({ to, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const message = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    `Subject: ${encodedSubject}`,
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sendGmail({ to, subject, body }) {
  const response = await googleRequest("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: buildRawEmail({ to, subject, body }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail send failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        openaiConfigured: Boolean(OPENAI_API_KEY),
        geminiConfigured: Boolean(GEMINI_API_KEY),
        googleConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
        googleAuthorized: Boolean(googleTokens?.access_token),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/auth/google/start") {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        sendJson(res, 400, { error: "Missing Google OAuth configuration" });
        return;
      }

      res.writeHead(302, { Location: googleAuthUrl() });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/auth/google/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        sendJson(res, 400, { error: "Missing authorization code" });
        return;
      }

      await exchangeGoogleCode(code);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Google authorization complete</h1><p>You can close this window.</p>");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research/start") {
      const body = await readJson(req);
      const { provider, prompt } = body;

      if (!provider || !prompt) {
        sendJson(res, 400, { error: "provider and prompt are required" });
        return;
      }

      const run = provider === "gemini"
        ? await startGeminiResearch(prompt)
        : await startOpenAIResearch(prompt);

      sendJson(res, 202, {
        provider,
        id: run.id,
        status: run.status ?? "queued",
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/research/")) {
      const [, , , provider, id] = url.pathname.split("/");
      const result = provider === "gemini"
        ? await getGeminiResearch(id)
        : await getOpenAIResearch(id);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/docs") {
      const body = await readJson(req);
      const { title, content } = body;

      if (!title || !content) {
        sendJson(res, 400, { error: "title and content are required" });
        return;
      }

      const doc = await createGoogleDoc(title, content);
      sendJson(res, 201, doc);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/email") {
      const body = await readJson(req);
      const { to, subject, body: messageBody } = body;

      if (!to || !subject || !messageBody) {
        sendJson(res, 400, { error: "to, subject and body are required" });
        return;
      }

      const message = await sendGmail({
        to,
        subject,
        body: messageBody,
      });
      sendJson(res, 201, {
        id: message.id,
        threadId: message.threadId,
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Research API listening on http://localhost:${PORT}`);
});
