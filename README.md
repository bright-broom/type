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

実装前に [`AGENTS.md`](AGENTS.md) を入口として、必要に応じて
[`docs/architecture.md`](docs/architecture.md) と
[`docs/directory-structure.md`](docs/directory-structure.md) を参照してください。

## Quality gates

```bash
npm run check:quick
npm run check
npm run check:ci
```

`check:quick` は開発中の typecheck・lint・unit test、`check` はそれらに production build を加えた最終確認です。CIはさらにHigh以上の依存脆弱性を検査する `check:ci` を使用します。設計判断は [`docs/adr`](docs/adr) に記録しています。

## Deployment

This is a standard Next.js App Router application and can be deployed to Vercel with the framework preset set to **Next.js**. No output directory override is required.

## Architecture

```text
app/                         Next.js routes and metadata
src/
├── presentation/            React components and browser-facing hooks
├── application/             Session orchestration, state, and ports
├── domain/                  Pure typing, scoring, prompt, and analytics rules
├── infrastructure/          Browser adapters for audio and persistence
└── content/                 Authored loaders and generated learning content
```

依存方向と各層の責務は [`docs/architecture.md`](docs/architecture.md) を正とします。境界違反と配置ルールはテストで機械的に検出します。セッション履歴と設定は端末内にのみ保存されます。

## Content import

元ブックを更新した場合は、次のように全シートを再取込できます。

```bash
npm run import:consulting -- "/path/to/Consulting_Playbook_Dictionary_JA.xlsx"
npm run import:takken -- "/path/to/takken-glossary.tsv"
```

生成物は `src/content/generated/` に出力されます。生成JSONを直接編集せず、取込スクリプトを再実行してください。取込データはローカル静的データとして保持され、外部へ送信されません。
