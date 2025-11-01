# タスク管理Webアプリケーション

Google Apps Script (GAS)を使用したタスク管理Webアプリケーション。タスクをGoogle Calendarに転記し、Google Docsで詳細を管理します。

## 機能

- タスクの入力と管理
- Google Calendarへの自動転記
- Google Docsでのタスク詳細管理
- 親子タスクの階層管理
- 期限に基づく自動スケジューリング

## 技術スタック

- **バックエンド**: Google Apps Script
- **フロントエンド**: HTML, Bootstrap 5, Alpine.js, htmx
- **API**: Google Calendar API, Google Drive API, Google Docs API

## セットアップ

### 前提条件

- Node.js (clasp使用のため)
- clasp CLI (`npm install -g @google/clasp`)
- Googleアカウント

### インストール

1. リポジトリをクローン
```bash
git clone <repository-url>
cd tasklist-to-google_calendar
```

2. claspでログイン
```bash
clasp login
```

3. 新しいGASプロジェクトを作成
```bash
clasp create --type webapp --title "タスク管理Webアプリ"
```

4. コードをプッシュ
```bash
clasp push
```

5. Webアプリとしてデプロイ
```bash
clasp deploy
```

詳細なデプロイ手順は[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)を参照してください。

## 使い方

1. デプロイされたWebアプリのURLにアクセス
2. タスク名、期限、詳細を入力
3. 「処理開始！」ボタンをクリック
4. Google Calendarとドライブに自動的に転記されます

## プロジェクト構成

```
.
├── Code.gs              # バックエンドロジック
├── index.html           # フロントエンドUI
├── DEPLOYMENT_GUIDE.md  # デプロイメントガイド
├── existing-app/        # 既存アプリのリファレンス
└── .kiro/specs/         # 仕様書
```

## ライセンス

MIT
