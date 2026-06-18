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
  <a href="README.ja.md">日本語</a> ·
  <b>한국어</b>
</p>

<p><i>당신의 AI 코딩 에이전트는 "테스트를 추가했고 전부 통과한다"고 말합니다. <code>getreceipts</code>가 확인합니다.</i></p>

</div>

코딩 에이전트가 **하지도 않은 작업을 했다고 주장하는 것**을 잡아내는, 결정론적이고 읽기 전용인 워치독입니다 —— 테스트를 한 번도 실행하지 않았는데 "모든 테스트 통과", diff에는 없는데 "`src/foo.ts`를 수정했다". Claude Code의 매 턴이 끝난 뒤 실행되며, 어떤 주장이 **증명 가능하게 거짓**이 아닌 한 완전히 침묵합니다.

**LLM 없음. 텔레메트리 없음. 거짓 경보 쇼 없음. 오직 증거(receipts)만.**

```
⚠️  getreceipts — 2 unverified claims caught
  ✗ Claimed tests pass, but no test command ran this turn.
      • observed: no test command appears in this turn's tool calls
  ✗ Claimed to have updated src/missing.ts, but it does not exist.
      • path: src/missing.ts
      • observed: this file is not in the git diff and does not exist in the repo
```

> ⭐ 단 한 번이라도 에이전트의 거짓말을 잡아냈다면, [저장소에 스타](https://github.com/Ruxiu0409/getreceipts)를 눌러 주세요 —— 다른 사람들이 찾는 데 도움이 됩니다.

## 빠른 시작

```bash
npx -y getreceipts init      # Stop 훅을 ./.claude/settings.json 에 등록합니다
```

이게 전부입니다. 설정 제로. 이후 Claude Code의 매 턴이 끝날 때마다 getreceipts가 에이전트의 주장을 git diff·디스크의 파일·실제로 실행된 명령과 교차 확인합니다. 깨끗한 턴이라면 존재조차 느끼지 못합니다.

```bash
getreceipts doctor     # 엔진이 동작함을 증명 + 훅 연결 여부 확인
getreceipts explain    # 무엇을 검사하는지(그리고 하지 않는지)를 정확히 표시
```

## 무엇을 잡아내나

| 주장 | 플래그가 뜨는 경우 |
|---|---|
| **"모든 테스트 통과"** /"스위트가 초록불" | 이번 턴에 테스트 명령이 실행되지 않았거나, 실행됐지만 오류로 종료됨 |
| **"빌드 성공"** /"lint 통과"/"타입 체크 깨끗함" | 대응하는 check/build 명령이 실행되지 않았거나, 실패함 |
| **"`src/foo.ts`를 수정했다"** /"config/x.yaml을 생성했다" | 해당 경로가 git diff에 없음(심지어 존재하지 않을 수도) |

## (의도적으로) 하지 않는 것

거짓 경보를 남발하는 도구는 삭제됩니다. getreceipts는 어떤 주장이 **관찰된 사실**(git·파일 시스템·프로세스 결과)과 모순될 때만 입을 엽니다. 증명할 수 없는 것에는 전부 침묵합니다:

- 미래·의도 —— *"이제 테스트를 실행할게요"*, *"테스트를 추가합시다"*
- 모호함 —— *"테스트는 통과한 것 같아요"*, *"빌드되는 것 같네요"*
- 조건 —— *"테스트가 통과하면…"* ・ 부정 —— *"테스트가 아직 통과하지 않음"*
- ``` 코드 펜스 ``` 안의 모든 내용

당신의 테스트를 실행하거나, 무언가를 설치하거나, 저장소를 건드리는 일은 **절대 없습니다**. 항상 읽기 전용입니다.

## 작동 원리

1. 턴이 끝나면 Claude Code가 `Stop` 훅을 발동하고 세션 transcript 경로를 넘겨줍니다.
2. transcript를 읽어 **이번 턴만** 잘라내고(이전 턴과 서브에이전트는 무시), 에이전트의 발언＋실제로 호출한 도구를 추출합니다.
3. 고정밀 패턴으로 발언에서 반증 가능한 **주장(claims)**을 뽑아냅니다.
4. 각 주장을 관찰된 사실과 대조해, 증명 가능한 모순이 있을 때만 **영수증(receipt)**을 출력합니다 —— 기본은 흐름을 막지 않는 경고(`--strict`면 에이전트에게 되돌려 직접 고치게 함).

설계상 결정론적이고 규칙 기반입니다. 환각을 막는 도구가 스스로 환각해서는 안 되니까요.

## 왜 linter나 LLM 심판이 아닌가

- **정적 AI 슬롭 linter**는 CI에서 코드를, 한 번에 한 언어씩 검사합니다. 에이전트의 *주장*은 보지 못합니다 ——"테스트를 실행했고 전부 통과"는 `tsc`/`eslint`에게는 보이지 않습니다.
- **LLM 심판형 훅**은 해결하려던 문제(비용·지연, 그리고 모델 자체도 틀릴 수 있음)를 그대로 되불러옵니다. getreceipts는 지상 진실 위의 순수 규칙입니다 —— 매번 같은 답, 즉시, 오프라인.

## 로드맵

- 더 많은 주장 유형(removed/renamed, "버전을 X로 올림", "committed/pushed")
- 파일 참조 & lockfile import 검사
- Cursor, Codex, OpenCode 어댑터(엔진은 이미 에이전트 비종속)
- MCP 서버 모드(`verify_last_turn`) —— MCP를 말하는 모든 에이전트용
- 커뮤니티 **check-packs** —— 설치 가능한 규칙 번들

## 기여하기

주장 패턴과 명령 인식기는 의도적으로 데이터 기반이라 확장이 쉽습니다. 놓친 실제 표현(테스트 포함)이나 test-runner를 추가하는 PR을 환영합니다 —— **새 패턴에는 반드시 통과하는 테스트가 있어야 하고, 코퍼스에 새로운 오탐을 추가하지 않아야 합니다**.

## 스타 히스토리

<a href="https://star-history.com/#Ruxiu0409/getreceipts&Date"><img src="https://api.star-history.com/svg?repos=Ruxiu0409/getreceipts&type=Date" alt="Star History Chart" width="600" /></a>

## 라이선스

[MIT](LICENSE) © getreceipts contributors
