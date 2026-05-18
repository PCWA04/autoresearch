export const jobs = [
  {
    id: "ai-weekly",
    name: "AI 產業週報",
    status: "已排程",
    statusTone: "success",
    schedule: "每週一 08:00",
    range: "最近 7 天",
    recipient: "strategy@company.com",
    provider: "openai",
    nextRun: "2026/05/25 08:00",
    lastRun: "成功",
    duration: "18 分鐘",
    sentCount: 6,
    reportTitle: "2026-W21 AI 產業週報",
    prompt: `請根據最近 7 天的公開資訊，整理生成式 AI 產業週報。內容需包含：
1. 重要新聞與事件
2. 主要公司動態
3. 新產品與技術趨勢
4. 市場訊號與潛在風險
5. 對產品、投資與策略的建議

請以繁體中文撰寫，使用清楚標題、條列、摘要與來源引用。`,
  },
  {
    id: "competitor-watch",
    name: "競品追蹤",
    status: "已排程",
    statusTone: "success",
    schedule: "每週五 17:30",
    range: "本週",
    recipient: "pm@company.com",
    provider: "gemini",
    nextRun: "2026/05/22 17:30",
    lastRun: "成功",
    duration: "11 分鐘",
    sentCount: 4,
    reportTitle: "2026-W21 競品追蹤",
    prompt: `請整理本週主要競品的產品更新、價格調整、合作消息與市場反應。
請以繁體中文產出主管可快速閱讀的摘要，並標記值得關注的策略訊號。`,
  },
  {
    id: "regulation-monitor",
    name: "法規監測",
    status: "需確認",
    statusTone: "warning",
    schedule: "每月 1 日 09:00",
    range: "上個月",
    recipient: "legal@company.com",
    provider: "openai",
    nextRun: "2026/06/01 09:00",
    lastRun: "待確認",
    duration: "-",
    sentCount: 0,
    reportTitle: "尚未產生",
    prompt: `請彙整上個月與生成式 AI、資料治理、隱私、著作權相關的重要法規更新。
請依地區分類，說明變更內容、影響範圍與建議行動。`,
  },
];

export const providers = {
  openai: {
    name: "OpenAI Deep Research",
    description: "適合長篇分析、引文清楚、可接內部資料",
  },
  gemini: {
    name: "Gemini Deep Research",
    description: "適合互動規劃、圖表輸出、Google 生態整合",
  },
};
