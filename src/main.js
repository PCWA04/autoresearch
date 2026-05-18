import { seedJobs, providers } from "./data.js";

const STORAGE_KEY = "weekly-report-manager.jobs";
const APP_VERSION = "v0.6";
const API_BASE_URL = "http://localhost:8787";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadJobs() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : clone(seedJobs);
  } catch {
    return clone(seedJobs);
  }
}

function persistJobs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

let jobs = loadJobs();

const state = {
  selectedJobId: jobs[0]?.id ?? null,
  running: false,
  createOpen: false,
  runStatus: null,
  runError: null,
};

const app = document.querySelector("#app");

function getSelectedJob() {
  return jobs.find((job) => job.id === state.selectedJobId);
}

function badge(label, tone) {
  return `<span class="badge ${tone}">${label}</span>`;
}

function createId(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
  return `${base || "report"}-${Date.now()}`;
}

function enabledCount() {
  return jobs.filter((job) => job.enabled !== false).length;
}

function renderSidebar(selectedJob) {
  return `
    <aside class="sidebar">
      <div class="sidebar-head">
        <h2>報告任務</h2>
        ${badge(`${enabledCount()} 啟用中`, "success")}
      </div>
      <div class="task-list">
        ${jobs.map((job) => `
          <button class="task ${job.id === selectedJob.id ? "active" : ""}" data-job-id="${job.id}">
            <div class="task-title">
              <span>${job.name}</span>
              ${badge(job.enabled === false ? "已停用" : job.status, job.enabled === false ? "muted" : job.statusTone)}
            </div>
            <div class="meta">
              <span>${job.schedule}</span>
              <span>區間：${job.range}</span>
              <span>收件人：${job.recipient}</span>
            </div>
          </button>
        `).join("")}
      </div>
    </aside>
  `;
}

function renderProviderButtons(selectedJob) {
  return Object.entries(providers).map(([key, provider]) => `
    <button class="provider ${selectedJob.provider === key ? "active" : ""}" data-provider="${key}">
      <strong>${provider.name}</strong>
      <span>${provider.description}</span>
    </button>
  `).join("");
}

function renderEmptyState() {
  return `
    <section class="workspace empty-state">
      <h2>目前沒有週報任務</h2>
      <p>先建立一筆任務，之後就能在這裡管理排程、提示詞與輸出狀態。</p>
    </section>
  `;
}

function renderWorkspace(selectedJob) {
  const runningTone = state.running ? "running" : "success";
  const runningLabel = state.running ? "執行中" : `下次執行：${selectedJob.nextRun}`;
  const runStatusLabel = state.runStatus || (state.running ? "研究進行中" : "研究完成");
  const reportLinkLabel = selectedJob.reportTitle;

  return `
    <section class="workspace">
      <div class="section-head">
        <h2>${selectedJob.name}</h2>
        <div class="inline-actions">
          ${badge(runningLabel, runningTone)}
          <button id="toggle-job">${selectedJob.enabled === false ? "啟用" : "停用"}</button>
          <button id="delete-job">刪除</button>
        </div>
      </div>

      <div class="overview">
        <div class="metric">
          <div class="metric-label">研究提供者</div>
          <div class="metric-value">${providers[selectedJob.provider].name.replace(" Deep Research", "")}</div>
        </div>
        <div class="metric">
          <div class="metric-label">最近執行</div>
          <div class="metric-value">${state.running ? "執行中" : selectedJob.lastRun}</div>
        </div>
        <div class="metric">
          <div class="metric-label">研究耗時</div>
          <div class="metric-value">${selectedJob.duration}</div>
        </div>
        <div class="metric">
          <div class="metric-label">最近寄送</div>
          <div class="metric-value">${selectedJob.sentCount} 人</div>
        </div>
      </div>

      <div class="content">
        <article class="panel">
          <div class="section-head">
            <h2>任務設定</h2>
            <button id="save-job">儲存</button>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field full">
                <label for="edit-name">報告名稱</label>
                <input id="edit-name" value="${selectedJob.name}">
              </div>
              <div class="field">
                <label for="edit-frequency">頻率</label>
                <select id="edit-frequency">
                  ${["每週", "每月", "自訂"].map((option) => `<option ${selectedJob.frequency === option ? "selected" : ""}>${option}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="edit-schedule">執行時間</label>
                <input id="edit-schedule" value="${selectedJob.schedule}">
              </div>
              <div class="field">
                <label for="edit-range">資料區間</label>
                <select id="edit-range">
                  ${["最近 7 天", "本週", "上週", "自訂日期"].map((option) => `<option ${selectedJob.range === option ? "selected" : ""}>${option}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label for="edit-recipient">寄送對象</label>
                <input id="edit-recipient" value="${selectedJob.recipient}">
              </div>
              <div class="field full">
                <label>Deep Research 提供者</label>
                <div class="provider-row">
                  ${renderProviderButtons(selectedJob)}
                </div>
              </div>
              <div class="field full">
                <label for="edit-prompt">完整提示詞</label>
                <textarea id="edit-prompt">${selectedJob.prompt}</textarea>
              </div>
            </div>
          </div>
        </article>

        <div class="timeline">
          <article class="panel">
            <div class="section-head">
              <h2>最近一次執行</h2>
              <button id="run-now" ${state.running || selectedJob.enabled === false ? "disabled" : ""}>${state.running ? "執行中..." : "重新執行"}</button>
            </div>
            <div class="panel-body">
              <div class="timeline-item">
                <div class="dot ${state.running ? "pending" : ""}"></div>
                <div>
                  <div class="timeline-title">${runStatusLabel}</div>
                  <div class="timeline-copy">${state.runError ? state.runError : state.running ? "系統正在呼叫 Deep Research，完成後會自動整理報告。" : "已分析 126 個來源，產出完整報告與引用。"}</div>
                </div>
              </div>
              <div class="timeline-item">
                <div class="dot ${state.running ? "pending" : ""}"></div>
                <div>
                  <div class="timeline-title">Google Doc ${state.running ? "待建立" : "已建立"}</div>
                  <div class="timeline-copy">${state.running ? "研究完成後會自動建立文件。" : "文件已依標題建立並寫入報告內容。"}</div>
                </div>
              </div>
              <div class="timeline-item">
                <div class="dot ${state.running ? "pending" : ""}"></div>
                <div>
                  <div class="timeline-title">Email ${state.running ? "待寄送" : "已寄送"}</div>
                  <div class="timeline-copy">${state.running ? "文件建立後會自動寄送連結。" : `已寄送給 ${selectedJob.sentCount} 位收件人。`}</div>
                </div>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="section-head">
              <h2>輸出結果</h2>
              ${badge(state.running ? "等待中" : "已發布", state.running ? "warning" : "success")}
            </div>
            <div class="panel-body report-preview">
              <a class="report-link" href="#">${reportLinkLabel}</a>
              ${selectedJob.report ? `
                <div class="report-meta">
                  <span>最新研究結果</span>
                  <strong>${selectedJob.provider === "gemini" ? "Gemini" : "OpenAI"}</strong>
                </div>
                <div class="report-body">${escapeHtml(selectedJob.report)}</div>
              ` : ""}
              <div class="status-list">
                <div class="status-row">
                  <span>Google Doc</span>
                  <strong>${state.running ? "待建立" : "已建立"}</strong>
                </div>
                <div class="status-row">
                  <span>Email</span>
                  <strong>${state.running ? "待寄送" : "已寄送"}</strong>
                </div>
                <div class="status-row">
                  <span>保留紀錄</span>
                  <strong>30 天</strong>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  `;
}

function renderCreateDialog() {
  if (!state.createOpen) {
    return "";
  }

  return `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div class="section-head">
          <h2 id="create-title">新增週報</h2>
          <button id="close-create">關閉</button>
        </div>
        <form id="create-form" class="panel-body form-grid">
          <div class="field full">
            <label for="job-name">報告名稱</label>
            <input id="job-name" name="name" required placeholder="例如：市場情報週報">
          </div>
          <div class="field">
            <label for="job-frequency">頻率</label>
            <select id="job-frequency" name="frequency">
              <option>每週</option>
              <option>每月</option>
              <option>自訂</option>
            </select>
          </div>
          <div class="field">
            <label for="job-schedule">執行時間</label>
            <input id="job-schedule" name="schedule" required placeholder="例如：每週一 08:00">
          </div>
          <div class="field">
            <label for="job-range">資料區間</label>
            <select id="job-range" name="range">
              <option>最近 7 天</option>
              <option>本週</option>
              <option>上週</option>
              <option>自訂日期</option>
            </select>
          </div>
          <div class="field">
            <label for="job-recipient">寄送對象</label>
            <input id="job-recipient" name="recipient" type="email" required placeholder="team@company.com">
          </div>
          <div class="field full">
            <label for="job-provider">Deep Research 提供者</label>
            <select id="job-provider" name="provider">
              <option value="openai">OpenAI Deep Research</option>
              <option value="gemini">Gemini Deep Research</option>
            </select>
          </div>
          <div class="field full">
            <label for="job-prompt">完整提示詞</label>
            <textarea id="job-prompt" name="prompt" required placeholder="輸入你希望研究引擎遵循的完整提示詞"></textarea>
          </div>
          <div class="modal-actions full">
            <button type="button" id="cancel-create">取消</button>
            <button class="primary" type="submit">建立週報</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function render() {
  const selectedJob = getSelectedJob();
  app.innerHTML = `
    <div class="app">
      <header>
        <div class="brand">
          <div class="brand-mark">R</div>
          <span>週報管理工具</span>
          <span class="app-version">${APP_VERSION}</span>
        </div>
        <div class="header-actions">
          <button id="test-run" ${selectedJob?.enabled === false ? "disabled" : ""}>測試執行</button>
          <button id="open-create" class="primary">新增週報</button>
        </div>
      </header>
      <main>
        ${selectedJob ? renderSidebar(selectedJob) : ""}
        ${selectedJob ? renderWorkspace(selectedJob) : renderEmptyState()}
      </main>
    </div>
    ${renderCreateDialog()}
  `;

  document.querySelectorAll("[data-job-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedJobId = button.dataset.jobId;
      state.running = false;
      state.runStatus = null;
      state.runError = null;
      render();
    });
  });

  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      getSelectedJob().provider = button.dataset.provider;
      persistJobs();
      render();
    });
  });

  document.querySelector("#open-create").addEventListener("click", () => {
    state.createOpen = true;
    render();
  });

  if (selectedJob) {
    document.querySelector("#run-now").addEventListener("click", () => startResearch(selectedJob));
    document.querySelector("#test-run").addEventListener("click", () => startResearch(selectedJob));

    document.querySelector("#save-job").addEventListener("click", handleSave);
    document.querySelector("#toggle-job").addEventListener("click", handleToggle);
    document.querySelector("#delete-job").addEventListener("click", handleDelete);
  }

  if (state.createOpen) {
    document.querySelector("#close-create").addEventListener("click", closeCreateDialog);
    document.querySelector("#cancel-create").addEventListener("click", closeCreateDialog);
    document.querySelector("#create-form").addEventListener("submit", handleCreate);
  }
}

function closeCreateDialog() {
  state.createOpen = false;
  render();
}

function handleCreate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const name = formData.get("name").trim();
  const schedule = formData.get("schedule").trim();
  const recipient = formData.get("recipient").trim();
  const prompt = formData.get("prompt").trim();

  if (!name || !schedule || !recipient || !prompt) {
    return;
  }

  const newJob = {
    id: createId(name),
    name,
    status: "已排程",
    statusTone: "success",
    enabled: true,
    schedule,
    frequency: formData.get("frequency"),
    range: formData.get("range"),
    recipient,
    provider: formData.get("provider"),
    nextRun: "待計算",
    lastRun: "尚未執行",
    duration: "-",
    sentCount: 0,
    reportTitle: "尚未產生",
    prompt,
  };

  jobs.push(newJob);
  persistJobs();
  state.selectedJobId = newJob.id;
  state.running = false;
  state.createOpen = false;
  render();
}

function handleSave() {
  const selectedJob = getSelectedJob();
  selectedJob.name = document.querySelector("#edit-name").value.trim();
  selectedJob.frequency = document.querySelector("#edit-frequency").value;
  selectedJob.schedule = document.querySelector("#edit-schedule").value.trim();
  selectedJob.range = document.querySelector("#edit-range").value;
  selectedJob.recipient = document.querySelector("#edit-recipient").value.trim();
  selectedJob.prompt = document.querySelector("#edit-prompt").value.trim();
  persistJobs();
  render();
}

function handleToggle() {
  const selectedJob = getSelectedJob();
  selectedJob.enabled = selectedJob.enabled === false;
  selectedJob.status = selectedJob.enabled ? "已排程" : "已停用";
  selectedJob.statusTone = selectedJob.enabled ? "success" : "muted";
  persistJobs();
  render();
}

function handleDelete() {
  const selectedJob = getSelectedJob();
  jobs = jobs.filter((job) => job.id !== selectedJob.id);
  persistJobs();
  state.selectedJobId = jobs[0]?.id ?? null;
  state.running = false;
  render();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function startResearch(selectedJob) {
  state.running = true;
  state.runStatus = "建立研究任務中";
  state.runError = null;
  selectedJob.lastRun = "執行中";
  persistJobs();
  render();

  try {
    const response = await fetch(`${API_BASE_URL}/api/research/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: selectedJob.provider,
        prompt: selectedJob.prompt,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `建立任務失敗 (${response.status})`);
    }

    const run = await response.json();
    selectedJob.providerRunId = run.id;
    state.runStatus = "研究進行中";
    persistJobs();
    render();
    pollResearch(selectedJob, run.provider, run.id);
  } catch (error) {
    state.running = false;
    state.runStatus = "執行失敗";
    state.runError = error.message;
    selectedJob.lastRun = "失敗";
    persistJobs();
    render();
  }
}

async function pollResearch(selectedJob, provider, id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/research/${provider}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `查詢任務失敗 (${response.status})`);
    }

    const result = await response.json();

    if (result.status === "completed") {
      state.running = false;
      state.runStatus = "研究完成";
      selectedJob.lastRun = "成功";
      selectedJob.report = result.report || "研究完成，但沒有回傳文字內容。";
      selectedJob.reportTitle = `${selectedJob.name} - 最新報告`;
      selectedJob.duration = "已完成";
      persistJobs();
      render();
      return;
    }

    if (["failed", "cancelled", "incomplete"].includes(result.status)) {
      state.running = false;
      state.runStatus = "執行失敗";
      state.runError = `研究任務狀態：${result.status}`;
      selectedJob.lastRun = "失敗";
      persistJobs();
      render();
      return;
    }

    state.runStatus = `研究進行中 (${result.status})`;
    render();
    window.setTimeout(() => pollResearch(selectedJob, provider, id), 10000);
  } catch (error) {
    state.running = false;
    state.runStatus = "查詢失敗";
    state.runError = error.message;
    selectedJob.lastRun = "失敗";
    persistJobs();
    render();
  }
}

render();
