# TypeLoop

1日60秒で正確さとリズムを育てる、日本語ローマ字タイピング練習アプリです。

## Features

- Incremental Japanese romanization matching
- Deterministic score, WPM, CPM, accuracy, miss, and combo calculation
- Drift-resistant 60-second session timer with pause and resume
- Local-first personal best, history, weak-key analysis, and settings
- Excel由来のConsulting Playbook全17セクション検索と327件の用語練習
- 令和8年度向け宅建用語446語の検索・分野/重要度/出典フィルター・用語練習
- Keyboard-first operation, IME protection, reduced motion, and optional sound

## Development

Node.js 22.13以降が必要です。

```bash
npm ci
npm run dev
```

ローカルでは `http://localhost:3000/` を開きます。

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
```

設計判断は [`docs/adr`](docs/adr) に記録しています。

## Deployment

This is a standard Next.js App Router application and can be deployed to Vercel with the framework preset set to **Next.js**. No output directory override is required.

## Architecture

```text
Presentation → Application → Domain
                      ↑
       Infrastructure implements ports
```

Domain層はReact、ブラウザAPI、永続化実装に依存しません。セッション履歴と設定は端末内にのみ保存されます。

## Consulting Playbook import

元ブックを更新した場合は、次のように全シートを再取込できます。

```bash
npm run import:consulting -- "/path/to/Consulting_Playbook_Dictionary_JA.xlsx"
npm run import:takken -- "/path/to/takken-glossary.tsv"
```

取込データはローカル静的データとして保持され、外部へ送信されません。
