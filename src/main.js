import { jobs, providers } from "./data.js";

const state = {
  selectedJobId: jobs[0].id,
  running: false,
};

const app = document.querySelector("#app");

function getSelectedJob() {
  return jobs.find((job) => job.id === state.selectedJobId);
}

function badge(label, tone) {
  return `<span class="badge ${tone}">${label}</span>`;
}

function renderSidebar(selectedJob) {
  return `
    <aside class="sidebar">
      <div class="sidebar-head">
        <h2>報告任務</h2>
        ${badge("3 啟用中", "success")}
      </div>
      <div class="task-list">
        ${jobs.map((job) => `
          <button class="task ${job.id === selectedJob.id ? "active" : ""}" data-job-id="${job.id}">
            <div class="task-title">
              <span>${job.name}</span>
              ${badge(job.status, job.statusTone)}
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

function renderWorkspace(selectedJob) {
  const runningTone = state.running ? "running" : "success";
  const runningLabel = state.running ? "執行中" : `下次執行：${selectedJob.nextRun}`;

  return `
    <section class="workspace">
      <div class="section-head">
        <h2>${selectedJob.name}</h2>
        ${badge(runningLabel, runningTone)}
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
            <button>儲存</button>
          </div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="field">
                <label>頻率</label>
                <select>
                  <option>每週</option>
                  <option>每月</option>
                  <option>自訂</option>
                </select>
              </div>
              <div class="field">
                <label>執行時間</label>
                <input value="${selectedJob.schedule}">
              </div>
              <div class="field">
                <label>資料區間</label>
                <select>
                  <option>${selectedJob.range}</option>
                  <option>最近 7 天</option>
                  <option>本週</option>
                  <option>上週</option>
                  <option>自訂日期</option>
                </select>
              </div>
              <div class="field">
                <label>寄送對象</label>
                <input value="${selectedJob.recipient}">
              </div>
              <div class="field full">
                <label>Deep Research 提供者</label>
                <div class="provider-row">
                  ${renderProviderButtons(selectedJob)}
                </div>
              </div>
              <div class="field full">
                <label>完整提示詞</label>
                <textarea>${selectedJob.prompt}</textarea>
              </div>
            </div>
          </div>
        </article>

        <div class="timeline">
          <article class="panel">
            <div class="section-head">
              <h2>最近一次執行</h2>
              <button id="run-now" ${state.running ? "disabled" : ""}>${state.running ? "執行中..." : "重新執行"}</button>
            </div>
            <div class="panel-body">
              <div class="timeline-item">
                <div class="dot ${state.running ? "pending" : ""}"></div>
                <div>
                  <div class="timeline-title">${state.running ? "研究進行中" : "研究完成"}</div>
                  <div class="timeline-copy">${state.running ? "系統正在呼叫 Deep Research，完成後會自動整理報告。" : "已分析 126 個來源，產出完整報告與引用。"}</div>
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
              <a class="report-link" href="#">${selectedJob.reportTitle}</a>
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

function render() {
  const selectedJob = getSelectedJob();
  app.innerHTML = `
    <div class="app">
      <header>
        <div class="brand">
          <div class="brand-mark">R</div>
          <span>週報管理工具</span>
        </div>
        <div class="header-actions">
          <button id="test-run">測試執行</button>
          <button class="primary">新增週報</button>
        </div>
      </header>
      <main>
        ${renderSidebar(selectedJob)}
        ${renderWorkspace(selectedJob)}
      </main>
    </div>
  `;

  document.querySelectorAll("[data-job-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedJobId = button.dataset.jobId;
      state.running = false;
      render();
    });
  });

  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.addEventListener("click", () => {
      getSelectedJob().provider = button.dataset.provider;
      render();
    });
  });

  document.querySelector("#run-now").addEventListener("click", () => {
    state.running = true;
    render();
  });

  document.querySelector("#test-run").addEventListener("click", () => {
    state.running = true;
    render();
  });
}

render();
