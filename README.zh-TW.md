<div align="center">

<img src="https://raw.githubusercontent.com/Ruxiu0409/getreceipts/main/assets/banner.svg" alt="getreceipts" width="100%" />

<p>
  <a href="https://www.npmjs.com/package/getreceipts"><img src="https://img.shields.io/npm/v/getreceipts.svg?color=2ea043" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/getreceipts"><img src="https://img.shields.io/npm/dm/getreceipts.svg?color=2ea043" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license: MIT" /></a>
  <img src="https://img.shields.io/badge/tests-107%20passing-brightgreen.svg" alt="107 tests passing" />
  <img src="https://img.shields.io/badge/LLM-none-111.svg" alt="no LLM" />
</p>

<p>
  <a href="README.md">English</a> ·
  <b>繁體中文</b> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p><i>你的 AI coding agent 說它加了測試而且都過了。<code>getreceipts</code> 幫你查證。</i></p>

</div>

一個確定性、唯讀的看門狗,專抓你的 coding agent **謊報它根本沒做的工作** —— 號稱「所有測試都過了」但根本沒跑測試、號稱「我改了 `src/foo.ts`」但 git diff 打臉。它在每次 Claude Code turn 結束後執行,除非某個宣稱**可被證明是假的**,否則完全保持安靜。

**不用 LLM。不收任何遙測。不演假警報。只給你證據(receipts)。**

```
⚠️  getreceipts — 2 unverified claims caught
  ✗ Claimed tests pass, but no test command ran this turn.
      • observed: no test command appears in this turn's tool calls
  ✗ Claimed to have updated src/missing.ts, but it does not exist.
      • path: src/missing.ts
      • observed: this file is not in the git diff and does not exist in the repo
```

> ⭐ 只要它幫你抓到一次,就請[給專案一顆星](https://github.com/Ruxiu0409/getreceipts) —— 能幫助更多人找到它。

## 快速開始

```bash
npx -y getreceipts init      # 把 Stop hook 寫進 ./.claude/settings.json
```

就這樣,零設定。之後每次 Claude Code turn 結束,getreceipts 會把 agent 的宣稱拿去跟你的 git diff、磁碟上的檔案、以及它實際跑過的指令交叉比對。乾淨的 turn?你根本不會注意到它在。

```bash
getreceipts doctor     # 證明引擎能動 + 檢查 hook 是否接好
getreceipts explain    # 說明到底會檢查(與不檢查)哪些東西
```

## 它會抓到什麼

| 宣稱 | 何時會被標記 |
|---|---|
| **「所有測試都過了」** /「suite 全綠」 | 這個 turn 內根本沒跑測試指令,或跑了但出錯 |
| **「build 成功」** /「lint 通過」/「型別檢查乾淨」 | 沒有對應的 check/build 指令跑過,或跑了但失敗 |
| **「我改了 `src/foo.ts`」** /「建立了 config/x.yaml」 | 該路徑不在 git diff 裡(甚至根本不存在) |

## 它(刻意)不會做的事

會亂叫的工具會被解除安裝。getreceipts 只在某個宣稱**與觀察到的事實**(git、檔案系統、行程結果)矛盾時才出聲。任何無法證明的,它一律保持安靜:

- 未來式／意圖 —— *「我等等會跑測試」*、*「我們來加個測試吧」*
- 含糊 —— *「我想測試應該有過」*、*「看起來有 build 起來」*
- 條件式 —— *「如果測試過了…」* ・ 否定 —— *「測試還沒過」*
- 任何在 ``` 程式碼區塊 ``` 裡的內容

它**永遠不會**跑你的測試、不安裝任何東西、不碰你的 repo。永遠唯讀。

## 運作原理

1. Claude Code 在一個 turn 結束時觸發 `Stop` hook,並把 session transcript 的路徑交給我們。
2. 我們讀取 transcript,只切出**這一個 turn**(忽略先前的 turn 與 subagent),取出 agent 的發言＋它實際呼叫過的工具。
3. 用高精準度的 pattern 從發言中抽出可被證偽的**宣稱(claims)**。
4. 把每個宣稱拿去跟觀察到的事實比對,只在可被證明的矛盾時印出一張**收據(receipt)** —— 預設是不擋住流程的警告(或加上 `--strict`,把它丟回給 agent 自己修)。

設計上就是確定性、規則式的:一個反幻覺的工具,自己絕不能幻覺。

## 為什麼不用 linter?或 LLM 裁判?

- **靜態的 AI-slop linter** 只在 CI 檢查程式碼,一次一種語言。它們看不到 agent 的*宣稱* ——「我跑了測試而且都過了」對 `tsc`／`eslint` 來說是隱形的。
- **LLM 裁判型 hook** 等於把它要解決的問題又帶回來(成本、延遲,而且模型本身也可能判錯)。getreceipts 是建立在地面真相之上的純規則 —— 每次答案都一樣、即時、離線。

## 開發藍圖

- 更多 claim 類型(removed/renamed、「版本升到 X」、「committed/pushed」)
- 檔案引用 & lockfile import 檢查
- Cursor、Codex、OpenCode 的 adapter(引擎本來就與 agent 無關)
- MCP server 模式(`verify_last_turn`),讓任何說 MCP 的 agent 都能用
- 社群 **check-packs** —— 可安裝的規則包

## 參與貢獻

claim 的 pattern 與指令辨識器都刻意做成資料驅動,因此很容易擴充。歡迎送 PR 補上漏掉的真實世界用語(附測試)或新的 test-runner —— **每個新 pattern 都必須有通過的測試,且在語料庫中不增加任何假陽性**。

## Star 成長史

<a href="https://star-history.com/#Ruxiu0409/getreceipts&Date"><img src="https://api.star-history.com/svg?repos=Ruxiu0409/getreceipts&type=Date" alt="Star History Chart" width="600" /></a>

## 授權

[MIT](LICENSE) © getreceipts contributors
