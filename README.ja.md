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
  <a href="README.zh-CN.md">简体中文</a> ·
  <b>日本語</b> ·
  <a href="README.ko.md">한국어</a>
</p>

<p><i>AI コーディングエージェントは「テストを追加して、全部通った」と言う。<code>getreceipts</code> はそれを検証する。</i></p>

</div>

コーディングエージェントが**やってもいない作業をやったと言い張る**のを捕まえる、決定論的で読み取り専用のウォッチドッグです —— テストを一度も実行していないのに「全テスト通過」、diff には無いのに「`src/foo.ts` を更新した」。Claude Code の各ターン終了後に実行され、ある主張が**証明可能に偽**でない限り、完全に沈黙します。

**LLM なし。テレメトリなし。誤検知の芝居なし。あるのは証拠(レシート)だけ。**

```
⚠️  getreceipts — 2 unverified claims caught
  ✗ Claimed tests pass, but no test command ran this turn.
      • observed: no test command appears in this turn's tool calls
  ✗ Claimed to have updated src/missing.ts, but it does not exist.
      • path: src/missing.ts
      • observed: this file is not in the git diff and does not exist in the repo
```

> ⭐ 一度でもエージェントの嘘を捕まえたら、ぜひ[リポジトリにスター](https://github.com/Ruxiu0409/getreceipts)を —— 他の人が見つけやすくなります。

## クイックスタート

```bash
npx -y getreceipts init      # Stop フックを ./.claude/settings.json に書き込む
```

これだけ。設定ゼロ。以降は Claude Code のターンが終わるたびに、getreceipts がエージェントの主張を git diff・ディスク上のファイル・実際に実行されたコマンドと突き合わせます。問題のないターンなら、その存在にすら気づきません。

```bash
getreceipts doctor     # エンジンが動くことを証明 + フックの接続を確認
getreceipts explain    # 何をチェックする(しない)のかを正確に表示
```

## 何を捕まえるか

| 主張 | フラグが立つ条件 |
|---|---|
| **「全テスト通過」** /「スイートはグリーン」 | このターンでテストコマンドが実行されていない、または実行されたがエラー終了した |
| **「ビルド成功」** /「lint 通過」/「型チェックはクリーン」 | 対応する check/build コマンドが実行されていない、または失敗した |
| **「`src/foo.ts` を更新した」** /「config/x.yaml を作成した」 | そのパスが git diff に存在しない(そもそも存在しないことも) |

## (あえて)やらないこと

オオカミ少年なツールはアンインストールされます。getreceipts は、ある主張が**観測された事実**(git・ファイルシステム・プロセス結果)と矛盾するときだけ発言します。証明できないものには一切沈黙します:

- 未来・意図 —— *「これからテストを実行する」*、*「テストを追加しよう」*
- ぼかし —— *「テストは通ったと思う」*、*「ビルドできてそう」*
- 条件 —— *「テストが通れば…」* ・ 否定 —— *「テストはまだ通っていない」*
- ``` コードフェンス ``` の中身すべて

あなたのテストを実行したり、何かをインストールしたり、リポジトリに触れたりは**一切しません**。常に読み取り専用です。

## 仕組み

1. ターンが終わると Claude Code が `Stop` フックを発火し、セッション transcript のパスを渡してきます。
2. transcript を読み、**このターンだけ**を切り出し(過去のターンとサブエージェントは無視)、エージェントの発言＋実際に呼び出したツールを取り出します。
3. 高精度なパターンで、発言から反証可能な**主張(claims)**を抽出します。
4. 各主張を観測事実と照合し、証明可能な矛盾があるときだけ**レシート(receipt)**を出力します —— デフォルトは流れを止めない警告(`--strict` ならエージェントに差し戻して修正させます)。

設計からして決定論的・ルールベースです。反ハルシネーションのツールが、自らハルシネーションを起こしてはいけません。

## なぜ linter や LLM ジャッジではダメなのか

- **静的な AI スロップ linter** は CI でコードを、一度に一言語ずつチェックします。エージェントの*主張*は見えません ——「テストを実行して全部通った」は `tsc`/`eslint` には不可視です。
- **LLM ジャッジ型フック**は、解決すべき問題そのもの(コスト・レイテンシ・モデル自身も誤判定しうる)を呼び戻してしまいます。getreceipts は地上の真実に対する純粋なルール —— 毎回同じ答え、即時、オフライン。

## ロードマップ

- 主張タイプの追加(removed/renamed、「バージョンを X に上げた」、「committed/pushed」)
- ファイル参照 & lockfile import チェック
- Cursor、Codex、OpenCode 向けアダプタ(エンジンはすでにエージェント非依存)
- MCP サーバーモード(`verify_last_turn`) —— MCP を話すあらゆるエージェント向け
- コミュニティ **check-packs** —— インストール可能なルールバンドル

## コントリビュート

主張のパターンとコマンド認識器は意図的にデータ駆動なので、簡単に拡張できます。見落とされていた実世界の言い回し(テスト付き)や test-runner を追加する PR を歓迎します —— **新しいパターンには必ず通過するテストが必要で、コーパスに新たな誤検知を増やさないこと**。

## スター推移

<a href="https://star-history.com/#Ruxiu0409/getreceipts&Date"><img src="https://api.star-history.com/svg?repos=Ruxiu0409/getreceipts&type=Date" alt="Star History Chart" width="600" /></a>

## ライセンス

[MIT](LICENSE) © getreceipts contributors
