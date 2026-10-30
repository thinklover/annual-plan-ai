# 年度業務計畫書 AI 填表

依長照機構評鑑基準 A1 年度業務計畫書格式（壹～貳拾），貼上訪談逐字稿，由 Gemini 協助填寫，人員抽查修改後提交並匯出 Word。
完整範圍見 [docs/SPEC.md](docs/SPEC.md)。

## 使用流程

1. 首頁按「AI 設定」，輸入 Gemini API Key（到 Google AI Studio 取得），可按「測試連線並列出模型」。
2. 新增計畫書 →「訪談講稿」頁籤可勾選題目或匯出 Word 帶去現場。
3. 訪談後把逐字稿貼到「逐字稿」→ 按「AI 全部填寫」，或在各區塊按「AI 依逐字稿填寫」。
4. AI 內容會直接填入。欄位旁的「逐字稿依據」標籤可點「依據」查看原句；逐字稿沒提到的欄位會留白，請人工填寫。直接修改的欄位重跑 AI 時不會被覆蓋。文字欄位可用「AI 修飾」。
5. 檢查完成後「提交定稿」→「匯出 Word」。

資料只存在瀏覽器 localStorage，換電腦前請用「匯出 JSON」備份。

## 開發

```bash
npm install
npm run dev
```

## 部署到 GitHub Pages

1. 在 GitHub 建立公開 repo `annual-plan-ai`，把程式推到 `main`。
2. repo 的 Settings → Pages → Source 選「GitHub Actions」。
3. 之後每次推到 `main` 會自動建置並發佈到 `https://<帳號>.github.io/annual-plan-ai/`。
