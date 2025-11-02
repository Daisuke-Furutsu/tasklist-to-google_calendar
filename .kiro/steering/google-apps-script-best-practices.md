# Google Apps Script 開発のベストプラクティス

このドキュメントは、Google Apps Script (GAS) Webアプリケーション開発で学んだ重要な教訓とベストプラクティスをまとめたものです。

## 認証とデプロイ設定

### 重要な教訓：fetchではなくgoogle.script.runを使用する

**問題**:
- `fetch()`を使ってPOSTリクエストを送信すると、「Authorization required」エラーが発生する
- デプロイ設定が「全員」アクセス可能な場合、認証ダイアログが表示され、doPost関数が呼ばれない
- Response textにHTMLの認証ダイアログが返される

**解決策**:
- フロントエンド（HTML）からサーバー側の関数を呼び出す場合は、**必ず`google.script.run`を使用する**
- これはGoogle Apps Scriptの公式推奨方法で、認証の問題を回避できる

### 正しい実装例

```javascript
// ❌ 間違い：fetchを使用
async submitTasks() {
  const response = await fetch(window.location.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks: taskData })
  });
  const result = await response.json();
}

// ✅ 正しい：google.script.runを使用
submitTasks() {
  google.script.run
    .withSuccessHandler((result) => {
      console.log('Success:', result);
      // 成功時の処理
    })
    .withFailureHandler((error) => {
      console.error('Error:', error);
      // エラー時の処理
    })
    .processTaskList(taskData);  // サーバー側の関数を直接呼び出す
}
```

## OAuth Scopes の明示的な宣言

### appsscript.json に必要な権限を記載

Google Calendar、Drive、Docsなどを使用する場合は、`appsscript.json`に明示的にOAuth scopesを宣言する：

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### タイムゾーン設定

**重要**: 特に指定がない限り、日本のアプリケーションでは`timeZone`を`"Asia/Tokyo"`に設定してください。デフォルトの`"America/New_York"`のままだと、日付計算が13-14時間ずれてしまいます。

```json
{
  "timeZone": "Asia/Tokyo"  // 日本標準時間（JST）
}
```

タイムゾーンが正しく設定されていないと：
- 「本日」の日付が前日になる
- カレンダーイベントの日付がずれる
- 期限計算が正しく動作しない

## デプロイ設定のチェックリスト

1. **次のユーザーとして実行**: 「自分」を選択
2. **アクセスできるユーザー**: 「全員」を選択（公開する場合）
3. **権限の承認**: Google Apps Scriptエディタで関数を直接実行して権限を承認
4. **バージョン管理**: 変更後は必ず新バージョンをデプロイ

## デバッグのベストプラクティス

### ログ出力を活用

```javascript
function doPost(e) {
  Logger.log('doPost called');
  Logger.log('e object: ' + JSON.stringify(e));
  // 処理...
}
```

### 実行ログの確認方法

- Google Apps Scriptエディタの左メニュー「実行数」（時計アイコン）をクリック
- どの関数が呼ばれたか、エラーが発生したかを確認できる

## よくある問題と解決策

### 問題1: 「Authorization required」エラー

**症状**: Response textにHTMLの認証ダイアログが返される

**原因**: `fetch()`を使ってPOSTリクエストを送信している

**解決**: `google.script.run`に変更する

### 問題2: doPost関数が呼ばれない

**症状**: 実行ログにdoGetは表示されるが、doPostが表示されない

**原因**: フロントエンドからのリクエストが正しく送信されていない

**解決**: `google.script.run`を使用して、直接サーバー側の関数を呼び出す

### 問題3: 権限エラー

**症状**: 「このアプリは確認されていません」というメッセージ

**解決**: 
1. Google Apps Scriptエディタで関数を直接実行
2. 「権限を確認」→「詳細」→「（プロジェクト名）に移動」をクリック
3. すべての権限を許可

## プロジェクト構成の推奨

```
.
├── Code.gs              # サーバー側のロジック
├── index.html           # フロントエンドUI
├── appsscript.json      # 設定ファイル（OAuth scopesを含む）
└── .clasp.json          # clasp設定
```

## デプロイワークフロー

1. コードを編集
2. `clasp push` でコードをプッシュ
3. Google Apps Scriptエディタで「デプロイ」→「デプロイを管理」
4. 既存のデプロイを編集して「新バージョン」を選択
5. 「デプロイ」をクリック
6. Webアプリをテスト

## 重要な注意事項

- **doPost関数は不要**: `google.script.run`を使う場合、doPost関数は呼ばれない
- **同期的な処理**: `google.script.run`は非同期だが、サーバー側の関数は同期的に実行される
- **タイムアウト**: Google Apps Scriptの実行時間制限（6分）に注意
- **レート制限**: APIの呼び出し回数制限に注意

## まとめ

Google Apps Script Webアプリ開発では：
1. **必ず`google.script.run`を使用する**（fetchは使わない）
2. **OAuth scopesを明示的に宣言する**
3. **権限を事前に承認する**
4. **実行ログでデバッグする**

これらを守ることで、認証エラーを回避し、スムーズに開発できます。
