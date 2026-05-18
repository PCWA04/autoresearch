import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`;
const GOOGLE_TOKEN_FILE = process.env.GOOGLE_TOKEN_FILE || "./google-tokens.json";
let googleTokens = await loadGoogleTokens();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

async function loadGoogleTokens() {
  try {
    const file = await readFile(GOOGLE_TOKEN_FILE, "utf8");
    return JSON.parse(file);
  } catch {
    return null;
  }
}

async function persistGoogleTokens() {
  if (!googleTokens) {
    return;
  }

  await writeFile(GOOGLE_TOKEN_FILE, JSON.stringify(googleTokens, null, 2), "utf8");
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
  await persistGoogleTokens();
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
  await persistGoogleTokens();
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
  const rendered = renderMarkdownForDocs(content);
  const updateResponse = await googleRequest(`https://docs.googleapis.com/v1/documents/${document.documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: rendered.requests,
    }),
  });

  if (!updateResponse.ok) {
    const errorBody = await updateResponse.text();
    throw new Error(`Google Docs update failed: ${updateResponse.status} ${errorBody}`);
  }

  if (rendered.tables.length > 0) {
    await fillGoogleDocTables(document.documentId, rendered.tables);
  }

  return {
    documentId: document.documentId,
    url: `https://docs.google.com/document/d/${document.documentId}/edit`,
  };
}

function renderMarkdownForDocs(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const outputLines = [];
  const paragraphStyles = [];
  const bulletRanges = [];
  const boldRanges = [];
  const linkRanges = [];
  const tableBlocks = [];
  let cursor = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const table = readMarkdownTable(lines, index);
    if (table) {
      tableBlocks.push({
        startIndex: cursor,
        rows: table.rows,
      });
      outputLines.push("");
      cursor += 1;
      index = table.endIndex;
      continue;
    }

    const rawLine = lines[index];
    const trimmed = rawLine.trimEnd();

    if (/^---+$/.test(trimmed)) {
      outputLines.push("");
      cursor += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    const bulletMatch = trimmed.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\s*\d+\.\s+(.*)$/);

    let text = trimmed;
    let namedStyleType = "NORMAL_TEXT";
    let bulletPreset = null;

    if (headingMatch) {
      const level = headingMatch[1].length;
      text = headingMatch[2];
      namedStyleType = level === 1 ? "TITLE" : level === 2 ? "HEADING_1" : "HEADING_2";
    } else if (bulletMatch) {
      text = bulletMatch[1];
      bulletPreset = "BULLET_DISC_CIRCLE_SQUARE";
    } else if (orderedMatch) {
      text = orderedMatch[1];
      bulletPreset = "NUMBERED_DECIMAL_ALPHA_ROMAN";
    }

    const cleaned = stripInlineMarkdown(text, cursor, boldRanges, linkRanges);
    outputLines.push(cleaned);

    const endIndex = cursor + cleaned.length + 1;

    if (namedStyleType !== "NORMAL_TEXT" && cleaned.length > 0) {
      paragraphStyles.push({
        startIndex: cursor,
        endIndex,
        namedStyleType,
      });
    }

    if (bulletPreset && cleaned.length > 0) {
      bulletRanges.push({
        startIndex: cursor,
        endIndex,
        bulletPreset,
      });
    }

    cursor = endIndex;
  }

  const text = outputLines.join("\n");
  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text,
      },
    },
    ...paragraphStyles.map((range) => ({
      updateParagraphStyle: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
        paragraphStyle: {
          namedStyleType: range.namedStyleType,
        },
        fields: "namedStyleType",
      },
    })),
    ...boldRanges.map((range) => ({
      updateTextStyle: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
        textStyle: {
          bold: true,
        },
        fields: "bold",
      },
    })),
    ...linkRanges.map((range) => ({
      updateTextStyle: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
        textStyle: {
          link: {
            url: range.url,
          },
        },
        fields: "link",
      },
    })),
    ...bulletRanges.map((range) => ({
      createParagraphBullets: {
        range: {
          startIndex: range.startIndex,
          endIndex: range.endIndex,
        },
        bulletPreset: range.bulletPreset,
      },
    })),
    ...[...tableBlocks]
      .sort((a, b) => b.startIndex - a.startIndex)
      .map((table) => ({
        insertTable: {
          rows: table.rows.length,
          columns: Math.max(...table.rows.map((row) => row.length)),
          location: { index: table.startIndex },
        },
      })),
  ];

  return { text, requests, tables: tableBlocks };
}

function stripInlineMarkdown(text, lineStartIndex, boldRanges, linkRanges = []) {
  let output = "";
  let cursor = 0;
  const boldPattern = /\*\*(.+?)\*\*/g;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    output += text.slice(cursor, match.index);
    const boldText = match[1];
    const startIndex = lineStartIndex + output.length;
    output += boldText;
    const endIndex = lineStartIndex + output.length;
    boldRanges.push({ startIndex, endIndex });
    cursor = match.index + match[0].length;
  }

  output += text.slice(cursor);
  let rendered = "";
  let renderedCursor = 0;
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let linkMatch;

  while ((linkMatch = linkPattern.exec(output)) !== null) {
    rendered += output.slice(renderedCursor, linkMatch.index);
    const label = linkMatch[1];
    const startIndex = lineStartIndex + rendered.length;
    rendered += label;
    const endIndex = lineStartIndex + rendered.length;
    linkRanges.push({
      startIndex,
      endIndex,
      url: linkMatch[2],
    });
    renderedCursor = linkMatch.index + linkMatch[0].length;
  }

  rendered += output.slice(renderedCursor);

  return rendered
    .replace(/\[cite:\s*([0-9,\s]+)\]/g, "[$1]")
    .replace(/`([^`]+)`/g, "$1");
}

function readMarkdownTable(lines, startIndex) {
  const header = lines[startIndex];
  const divider = lines[startIndex + 1];

  if (!isTableRow(header) || !isDividerRow(divider)) {
    return null;
  }

  const rows = [parseTableRow(header)];
  let cursor = startIndex + 2;

  while (cursor < lines.length && isTableRow(lines[cursor])) {
    rows.push(parseTableRow(lines[cursor]));
    cursor += 1;
  }

  return {
    rows,
    endIndex: cursor - 1,
  };
}

function isTableRow(line = "") {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isDividerRow(line = "") {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

async function fillGoogleDocTables(documentId, tables) {
  const response = await googleRequest(`https://docs.googleapis.com/v1/documents/${documentId}`);
  if (!response.ok) {
    throw new Error(`Google Docs read failed: ${response.status}`);
  }

  const document = await response.json();
  const documentTables = document.body.content
    .filter((item) => item.table)
    .sort((a, b) => a.startIndex - b.startIndex);

  const requests = [];
  const styleRequests = [];

  documentTables.slice(-tables.length).forEach((item, tableIndex) => {
    const sourceTable = tables[tableIndex];
    item.table.tableRows.forEach((row, rowIndex) => {
      row.tableCells.forEach((cell, columnIndex) => {
        const rawText = sourceTable.rows[rowIndex]?.[columnIndex] || "";
        const insertionIndex = cell.content?.[0]?.paragraph?.elements?.[0]?.startIndex;

        if (rawText && insertionIndex) {
          const localBoldRanges = [];
          const localLinkRanges = [];
          const text = stripInlineMarkdown(rawText, insertionIndex, localBoldRanges, localLinkRanges);
          requests.push({
            insertText: {
              location: { index: insertionIndex },
              text,
            },
          });
          styleRequests.push(
            ...localBoldRanges.map((range) => ({
              updateTextStyle: {
                range: {
                  startIndex: range.startIndex,
                  endIndex: range.endIndex,
                },
                textStyle: {
                  bold: true,
                },
                fields: "bold",
              },
            })),
            ...localLinkRanges.map((range) => ({
              updateTextStyle: {
                range: {
                  startIndex: range.startIndex,
                  endIndex: range.endIndex,
                },
                textStyle: {
                  link: {
                    url: range.url,
                  },
                },
                fields: "link",
              },
            })),
          );
        }
      });
    });
  });

  requests.sort((a, b) => b.insertText.location.index - a.insertText.location.index);
  styleRequests.sort((a, b) => b.updateTextStyle.range.startIndex - a.updateTextStyle.range.startIndex);

  if (requests.length === 0) {
    return;
  }

  const updateResponse = await googleRequest(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [...requests, ...styleRequests] }),
  });

  if (!updateResponse.ok) {
    const errorBody = await updateResponse.text();
    throw new Error(`Google Docs table fill failed: ${updateResponse.status} ${errorBody}`);
  }
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

    if (req.method === "POST" && url.pathname === "/api/docs/from-result-file") {
      const body = await readJson(req);
      const { filePath, title } = body;

      if (!filePath) {
        sendJson(res, 400, { error: "filePath is required" });
        return;
      }

      const file = await readFile(filePath, "utf8");
      const parsed = JSON.parse(file);
      const report = parsed.report;

      if (!report) {
        sendJson(res, 400, { error: "report not found in result file" });
        return;
      }

      const doc = await createGoogleDoc(title || "Renderer 測試文件", report);
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
