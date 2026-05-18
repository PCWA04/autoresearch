import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
      agent: "deep-research-preview-04-2026",
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
    report: data.output_text || data.output || null,
    raw: data,
  };
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
      });
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

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Research API listening on http://localhost:${PORT}`);
});
