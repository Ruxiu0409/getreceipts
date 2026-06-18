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
  <a href="README.zh-TW.md">繁體中文</a> ·
  <b>简体中文</b> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p><i>你的 AI 编码 agent 说它加了测试而且都通过了。<code>getreceipts</code> 帮你核实。</i></p>

</div>

一个确定性、只读的看门狗,专抓你的编码 agent **谎报它根本没做的工作** —— 号称"所有测试都通过"但根本没跑测试、号称"我改了 `src/foo.ts`"但 git diff 并非如此。它在每次 Claude Code turn 结束后运行,除非某个声称**能被证明是假的**,否则完全保持安静。

**不用 LLM。不收集任何遥测。不演假警报。只给你证据(receipts)。**

```
⚠️  getreceipts — 2 unverified claims caught
  ✗ Claimed tests pass, but no test command ran this turn.
      • observed: no test command appears in this turn's tool calls
  ✗ Claimed to have updated src/missing.ts, but it does not exist.
      • path: src/missing.ts
      • observed: this file is not in the git diff and does not exist in the repo
```

> ⭐ 只要它帮你抓到一次,就请[给项目点个 star](https://github.com/Ruxiu0409/getreceipts) —— 能帮助更多人找到它。

## 快速开始

```bash
npx -y getreceipts init      # 把 Stop hook 写入 ./.claude/settings.json
```

就这样,零配置。之后每次 Claude Code turn 结束,getreceipts 会把 agent 的声称拿去跟你的 git diff、磁盘上的文件、以及它实际运行过的命令交叉比对。干净的 turn?你根本不会注意到它在。

```bash
getreceipts doctor     # 证明引擎能跑 + 检查 hook 是否接好
getreceipts explain    # 说明到底会检查(以及不检查)哪些东西
```

## 它会抓到什么

| 声称 | 何时会被标记 |
|---|---|
| **"所有测试都通过"** /"suite 全绿" | 这个 turn 内根本没跑测试命令,或跑了但出错 |
| **"build 成功"** /"lint 通过"/"类型检查干净" | 没有对应的 check/build 命令运行,或运行了但失败 |
| **"我改了 `src/foo.ts`"** /"创建了 config/x.yaml" | 该路径不在 git diff 里(甚至根本不存在) |

## 它(刻意)不会做的事

爱乱叫的工具会被卸载。getreceipts 只在某个声称**与观察到的事实**(git、文件系统、进程结果)矛盾时才出声。任何无法证明的,它一律保持安静:

- 将来时／意图 —— *"我等下会跑测试"*、*"我们来加个测试吧"*
- 含糊 —— *"我想测试应该通过了"*、*"看起来构建起来了"*
- 条件式 —— *"如果测试通过了…"* ・ 否定 —— *"测试还没通过"*
- 任何在 ``` 代码块 ``` 里的内容

它**永远不会**跑你的测试、不安装任何东西、不碰你的仓库。永远只读。

## 工作原理

1. Claude Code 在一个 turn 结束时触发 `Stop` hook,并把 session transcript 的路径交给我们。
2. 我们读取 transcript,只切出**这一个 turn**(忽略之前的 turn 与 subagent),取出 agent 的发言＋它实际调用过的工具。
3. 用高精度的 pattern 从发言中抽出可被证伪的**声称(claims)**。
4. 把每个声称拿去跟观察到的事实比对,只在可被证明的矛盾时打印一张**收据(receipt)** —— 默认是不阻断流程的警告(或加上 `--strict`,把它丢回给 agent 自己修)。

设计上就是确定性、规则式的:一个反幻觉的工具,自己绝不能幻觉。

## 为什么不用 linter?或 LLM 裁判?

- **静态的 AI-slop linter** 只在 CI 检查代码,一次一种语言。它们看不到 agent 的*声称* ——"我跑了测试而且都通过了"对 `tsc`／`eslint` 来说是隐形的。
- **LLM 裁判型 hook** 等于把它要解决的问题又带了回来(成本、延迟,而且模型本身也可能判错)。getreceipts 是建立在地面真相之上的纯规则 —— 每次答案都一样、即时、离线。

## 路线图

- 更多 claim 类型(removed/renamed、"版本升到 X"、"committed/pushed")
- 文件引用 & lockfile import 检查
- Cursor、Codex、OpenCode 的 adapter(引擎本来就与 agent 无关)
- MCP server 模式(`verify_last_turn`),让任何说 MCP 的 agent 都能用
- 社区 **check-packs** —— 可安装的规则包

## 参与贡献

claim 的 pattern 与命令识别器都刻意做成数据驱动,因此很容易扩展。欢迎提 PR 补上漏掉的真实世界说法(附测试)或新的 test-runner —— **每个新 pattern 都必须有通过的测试,且在语料库中不增加任何误报**。

## Star 增长史

<a href="https://star-history.com/#Ruxiu0409/getreceipts&Date"><img src="https://api.star-history.com/svg?repos=Ruxiu0409/getreceipts&type=Date" alt="Star History Chart" width="600" /></a>

## 许可证

[MIT](LICENSE) © getreceipts contributors
