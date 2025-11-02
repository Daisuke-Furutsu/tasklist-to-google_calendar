# デザイン文書

## Overview

本アプリケーションは、スタンドアロンGoogle Apps Script (GAS) + HTML UIで構築されるタスク管理Webアプリケーションです。ユーザーはWebブラウザからアクセスし、タスク情報を入力してGoogle カレンダーに転記できます。データ永続化にはPropertiesServiceを使用し、Google Sheetsへの依存を完全に排除します。

### 主要機能
- HTML UIからのタスク入力（タスク名、期限、詳細）
- Google カレンダーへの終日イベント作成
- Google Docsファイルの自動生成と連携
- 親子タスクの階層管理
- タスク番号の永続的管理（PropertiesService）

### 技術スタック
- **バックエンド**: Google Apps Script
- **フロントエンド**: HTML5, CSS3, JavaScript
- **UIフレームワーク**: Bootstrap 5 (CDN)
- **インタラクション**: htmx (CDN)
- **状態管理**: Alpine.js (CDN)
- **データ永続化**: PropertiesService
- **外部サービス**: Google Calendar API, Google Drive API, Google Docs API
- **タイムゾーン**: 日本標準時間（JST / Asia/Tokyo）

### 重要な設計原則

**タイムゾーン**: すべての日付・時刻処理は日本標準時間（JST / Asia/Tokyo）を基準とします。`appsscript.json`の`timeZone`設定は必ず`"Asia/Tokyo"`とし、JavaScriptの`new Date()`で取得される日付はすべてJST基準となります。

## Architecture

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              HTML UI (index.html)                     │  │
│  │  - Bootstrap (スタイリング)                           │  │
│  │  - htmx (サーバー通信)                                │  │
│  │  - Alpine.js (状態管理)                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Apps Script                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Code.gs (メインロジック)                 │  │
│  │  - doGet(): HTML UIの提供                             │  │
│  │  - processTaskList(): タスク処理                      │  │
│  │  - createCalendarEvent(): イベント作成                │  │
│  │  - createDocsFile(): Docsファイル作成                 │  │
│  │  - getTaskNumber(): タスク番号取得                    │  │
│  │  - incrementTaskNumber(): タスク番号更新              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         PropertiesService (データ永続化)              │  │
│  │  - taskNo: 現在のタスク番号                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Google APIs
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Google Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Calendar   │  │    Drive     │  │     Docs     │      │
│  │     API      │  │     API      │  │     API      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

1. **タスク入力フロー**
   ```
   User → HTML UI → Alpine.js (状態管理) → 入力データ保持
   ```

2. **タスク処理フロー**
   ```
   User (処理開始ボタン) 
     → htmx (POST request)
     → GAS: processTaskList()
     → PropertiesService (タスク番号取得)
     → Calendar API (イベント作成)
     → Drive API (Docsファイル作成)
     → Docs API (内容書き込み)
     → PropertiesService (タスク番号更新)
     → Response (処理結果)
     → HTML UI (結果表示)
   ```

3. **タスク番号管理フロー**
   ```
   getTaskNumber() 
     → PropertiesService.getProperty('taskNo')
     → 存在しない場合は '1' を返す
   
   incrementTaskNumber(currentNo)
     → currentNo + 1
     → PropertiesService.setProperty('taskNo', newNo)
   ```

## Components and Interfaces

### 1. フロントエンド (HTML UI)

#### index.html
HTML UIのメインファイル。Bootstrap、htmx、Alpine.jsをCDN経由で読み込み、タスク入力フォームを提供します。

**主要コンポーネント:**

```html
<!-- Alpine.jsデータストア -->
<div x-data="taskApp()">
  <!-- タスク入力フォーム -->
  <form hx-post="/processTaskList" hx-trigger="submit">
    <!-- タスク行（動的追加可能） -->
    <template x-for="(task, index) in tasks" :key="index">
      <div class="task-row">
        <input type="text" name="taskName[]" x-model="task.name">
        <input type="date" name="dueDate[]" x-model="task.dueDate">
        <textarea name="taskDetail[]" x-model="task.detail"></textarea>
        <button @click="removeTask(index)">削除</button>
      </div>
    </template>
    
    <!-- 行追加ボタン -->
    <button @click="addTask()">行を追加</button>
    
    <!-- アクションボタン -->
    <button type="submit">処理開始！</button>
    <button @click="clearTasks()">リストをクリア</button>
  </form>
  
  <!-- ローディングインジケーター -->
  <div x-show="loading" class="spinner-border"></div>
  
  <!-- 結果メッセージ -->
  <div x-show="message" x-text="message" class="alert"></div>
</div>
```

**Alpine.jsデータ構造:**

```javascript
function taskApp() {
  return {
    tasks: [
      { name: '', dueDate: '', detail: '' }
    ],
    loading: false,
    message: '',
    
    addTask() {
      this.tasks.push({ name: '', dueDate: '', detail: '' });
    },
    
    removeTask(index) {
      this.tasks.splice(index, 1);
    },
    
    clearTasks() {
      this.tasks = [{ name: '', dueDate: '', detail: '' }];
      this.message = '';
    }
  }
}
```

### 2. バックエンド (Google Apps Script)

#### Code.gs

**主要関数:**

##### doGet(e)
```javascript
/**
 * Webアプリのエントリーポイント
 * @param {Object} e - イベントオブジェクト
 * @return {HtmlOutput} HTML UI
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('タスク管理アプリ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

##### processTaskList(taskData)
```javascript
/**
 * タスクリストを処理してカレンダーに転記
 * @param {Array} taskData - タスクデータの配列
 * @return {Object} 処理結果 { success: boolean, message: string, elapsedTime: number }
 */
function processTaskList(taskData) {
  const startTime = new Date();
  
  try {
    const calendarId = "9dsoil5r12um5nojs5qp1hun0g@group.calendar.google.com";
    const calendar = CalendarApp.getCalendarById(calendarId);
    const folderName = "Tsk タスク管理";
    
    let currentParentTaskName = "";
    let taskNo = getTaskNumber();
    
    for (const task of taskData) {
      if (!task.name || !task.name.trim()) continue;
      
      // 親子タスク判定
      const { isChild, taskName, parentName } = parseTaskName(task.name, currentParentTaskName);
      if (!isChild) currentParentTaskName = taskName;
      
      // 日付計算
      const { startDay, endDay } = calculateEventDates(task.dueDate);
      
      // イベントタイトル作成
      const taskNoStr = taskNo.toString().padStart(4, '0');
      const eventTitle = isChild 
        ? `Tkk-${taskNoStr} ${taskName}@${parentName}`
        : `Tkk-${taskNoStr} ${taskName}`;
      
      // Description作成
      let description = "";
      if (isChild) {
        description += `親タスク: ${parentName}\n`;
      }
      if (task.detail) {
        description += `\n${task.detail}`;
      }
      if (description.length > 3500) {
        description = description.substring(0, 3500);
      }
      
      // カレンダーイベント作成
      const event = calendar.createAllDayEvent(eventTitle, startDay, endDay, { description });
      
      // Docsファイル作成
      const docsFile = createDocsFile(eventTitle, folderName, description);
      if (docsFile) {
        event.setLocation(docsFile.getUrl());
      }
      
      // タスク番号インクリメント
      taskNo++;
    }
    
    // タスク番号保存
    incrementTaskNumber(taskNo);
    
    const endTime = new Date();
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
    
    return {
      success: true,
      message: `処理が完了しました。所要時間は${elapsedTime}秒でした。`,
      elapsedTime: elapsedTime
    };
    
  } catch (error) {
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
      elapsedTime: 0
    };
  }
}
```

##### parseTaskName(taskName, currentParent)
```javascript
/**
 * タスク名を解析して親子関係を判定
 * @param {string} taskName - タスク名
 * @param {string} currentParent - 現在の親タスク名
 * @return {Object} { isChild: boolean, taskName: string, parentName: string }
 */
function parseTaskName(taskName, currentParent) {
  const trimmed = taskName.trim();
  const isChild = trimmed.startsWith('>') || trimmed.startsWith('＞');
  
  if (isChild) {
    const cleanedName = trimmed.replace(/^[>＞]+/, '').trim();
    return {
      isChild: true,
      taskName: cleanedName,
      parentName: currentParent
    };
  }
  
  return {
    isChild: false,
    taskName: trimmed,
    parentName: ''
  };
}
```

##### calculateEventDates(dueDate)
```javascript
/**
 * イベントの開始日と終了日を計算
 * @param {string|Date} dueDate - 期限日
 * @return {Object} { startDay: Date, endDay: Date }
 */
function calculateEventDates(dueDate) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  if (!dueDate) {
    // 期限が空欄の場合
    const endDay = new Date(todayStart);
    endDay.setDate(endDay.getDate() + 1);
    return { startDay: todayStart, endDay: endDay };
  }
  
  const due = new Date(dueDate);
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  
  if (dueDateOnly <= todayStart) {
    // 期限が本日以前の場合
    const endDay = new Date(todayStart);
    endDay.setDate(endDay.getDate() + 1);
    return { startDay: todayStart, endDay: endDay };
  }
  
  // 期限が未来日付の場合
  const startCandidate = new Date(dueDateOnly);
  startCandidate.setDate(startCandidate.getDate() - 4);
  const startDay = startCandidate <= todayStart ? todayStart : startCandidate;
  
  const endDay = new Date(dueDateOnly);
  endDay.setDate(endDay.getDate() + 1);
  
  return { startDay: startDay, endDay: endDay };
}
```

##### createDocsFile(fileName, folderName, content)
```javascript
/**
 * Google Docsファイルを作成
 * @param {string} fileName - ファイル名
 * @param {string} folderName - フォルダ名
 * @param {string} content - ファイル内容
 * @return {File|null} 作成されたファイル、またはnull
 */
function createDocsFile(fileName, folderName, content) {
  try {
    // フォルダ取得または作成
    const folderIterator = DriveApp.getFoldersByName(folderName);
    let folder;
    if (folderIterator.hasNext()) {
      folder = folderIterator.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    // Docsファイル作成
    const newFile = DocumentApp.create(fileName);
    const fileId = newFile.getId();
    const file = DriveApp.getFileById(fileId);
    
    // フォルダに移動
    file.moveTo(folder);
    
    // 内容書き込み
    const doc = DocumentApp.openById(fileId);
    doc.getBody().appendParagraph(content);
    doc.saveAndClose();
    
    return file;
  } catch (error) {
    console.error(`Google Docsファイル作成エラー: ${error.message}`);
    return null;
  }
}
```

##### getTaskNumber()
```javascript
/**
 * PropertiesServiceからタスク番号を取得
 * @return {number} 現在のタスク番号
 */
function getTaskNumber() {
  const properties = PropertiesService.getScriptProperties();
  const taskNo = properties.getProperty('taskNo');
  return taskNo ? parseInt(taskNo) : 1;
}
```

##### incrementTaskNumber(newTaskNo)
```javascript
/**
 * タスク番号をPropertiesServiceに保存
 * @param {number} newTaskNo - 新しいタスク番号
 */
function incrementTaskNumber(newTaskNo) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('taskNo', newTaskNo.toString());
}
```

## Data Models

### Task (フロントエンド)
```javascript
{
  name: string,      // タスク名（必須）
  dueDate: string,   // 期限日（YYYY-MM-DD形式、任意）
  detail: string     // タスク詳細（任意、最大3500文字）
}
```

### TaskData (バックエンド処理用)
```javascript
{
  name: string,           // タスク名
  dueDate: Date|null,     // 期限日
  detail: string,         // タスク詳細
  isChild: boolean,       // 子タスクかどうか
  taskName: string,       // クリーンなタスク名（>除去後）
  parentName: string      // 親タスク名（子タスクの場合）
}
```

### CalendarEvent
```javascript
{
  title: string,          // "Tkk-xxxx タスク名" または "Tkk-xxxx 子タスク名@親タスク名"
  startDay: Date,         // 開始日（0:00）
  endDay: Date,           // 終了日（翌日0:00、排他エンド）
  description: string,    // イベント詳細（最大3500文字）
  location: string        // Google DocsファイルのURL
}
```

### PropertiesService Data
```javascript
{
  taskNo: string  // 現在のタスク番号（文字列形式）
}
```

## Error Handling

### エラーの種類と対応

1. **カレンダーアクセスエラー**
   - 原因: カレンダーIDが無効、または権限不足
   - 対応: try-catchでキャッチし、エラーメッセージを返す
   - メッセージ: "カレンダーへのアクセスに失敗しました"

2. **Docsファイル作成エラー**
   - 原因: Drive APIの制限、または権限不足
   - 対応: エラーをログに記録し、処理は継続（イベントは作成される）
   - メッセージ: "Docsファイルの作成に失敗しましたが、カレンダーイベントは作成されました"

3. **PropertiesServiceエラー**
   - 原因: 読み書き権限の問題
   - 対応: デフォルト値（1）を使用して処理を継続
   - メッセージ: "タスク番号の取得に失敗しました。デフォルト値を使用します"

4. **入力検証エラー**
   - 原因: 必須フィールド（タスク名）が空
   - 対応: そのタスクをスキップして次のタスクを処理
   - メッセージ: なし（サイレントスキップ）

5. **日付解析エラー**
   - 原因: 無効な日付形式
   - 対応: 期限なしとして扱う（本日のみのイベント）
   - メッセージ: なし（自動補正）

### エラーハンドリングパターン

```javascript
try {
  // メイン処理
} catch (error) {
  Logger.log(`エラー: ${error.message}`);
  return {
    success: false,
    message: `エラーが発生しました: ${error.message}`
  };
}
```

## Testing Strategy

### 1. 単体テスト

**テスト対象関数:**
- `parseTaskName()`: 親子タスク判定
- `calculateEventDates()`: 日付計算ロジック
- `getTaskNumber()`: タスク番号取得
- `incrementTaskNumber()`: タスク番号更新

**テストケース例:**

```javascript
function testParseTaskName() {
  // 通常タスク
  const result1 = parseTaskName("タスクA", "");
  console.assert(result1.isChild === false);
  console.assert(result1.taskName === "タスクA");
  
  // 子タスク（>）
  const result2 = parseTaskName(">子タスクB", "タスクA");
  console.assert(result2.isChild === true);
  console.assert(result2.taskName === "子タスクB");
  console.assert(result2.parentName === "タスクA");
  
  // 子タスク（＞）
  const result3 = parseTaskName("＞子タスクC", "タスクA");
  console.assert(result3.isChild === true);
  console.assert(result3.taskName === "子タスクC");
}

function testCalculateEventDates() {
  // 期限なし
  const result1 = calculateEventDates(null);
  console.assert(result1.startDay.getDate() === new Date().getDate());
  
  // 期限が過去
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);
  const result2 = calculateEventDates(pastDate);
  console.assert(result2.startDay.getDate() === new Date().getDate());
  
  // 期限が未来（10日後）
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);
  const result3 = calculateEventDates(futureDate);
  // 開始日は期限-4日 = 6日後
  const expectedStart = new Date();
  expectedStart.setDate(expectedStart.getDate() + 6);
  console.assert(result3.startDay.getDate() === expectedStart.getDate());
}
```

### 2. 統合テスト

**テストシナリオ:**

1. **基本フロー**
   - タスクを1件入力して処理
   - カレンダーイベントが作成されることを確認
   - Docsファイルが作成されることを確認
   - タスク番号がインクリメントされることを確認

2. **複数タスク処理**
   - 3件のタスクを入力して処理
   - すべてのイベントが作成されることを確認
   - タスク番号が連番になることを確認

3. **親子タスク**
   - 親タスク1件、子タスク2件を入力
   - 子タスクのタイトルに「@親タスク名」が含まれることを確認
   - 子タスクのDescriptionに「親タスク:」が含まれることを確認

4. **期限日パターン**
   - 期限なし、期限が過去、期限が未来のタスクを入力
   - それぞれ正しい日程でイベントが作成されることを確認

5. **エラーハンドリング**
   - タスク名が空のタスクを含めて処理
   - 空のタスクがスキップされることを確認
   - 他のタスクは正常に処理されることを確認

### 3. UIテスト

**テスト項目:**

1. **フォーム操作**
   - 行追加ボタンで行が追加される
   - 削除ボタンで行が削除される
   - リストをクリアボタンですべての入力がクリアされる

2. **処理実行**
   - 処理開始ボタンでローディングが表示される
   - 処理完了後にメッセージが表示される
   - メッセージが2秒後に自動的に消える

3. **レスポンシブデザイン**
   - モバイル画面でも正しく表示される
   - タブレット画面でも正しく表示される

### 4. パフォーマンステスト

**テスト項目:**

1. **大量タスク処理**
   - 10件、50件、100件のタスクを処理
   - 処理時間を計測
   - タイムアウトが発生しないことを確認

2. **PropertiesService読み書き**
   - 連続してタスク番号を更新
   - データの整合性を確認

## Deployment

### デプロイ手順

1. **GASプロジェクト作成**
   ```
   - Google Apps Scriptの新規プロジェクトを作成
   - プロジェクト名: "タスク管理Webアプリ"
   ```

2. **ファイル配置**
   ```
   - Code.gs: バックエンドロジック
   - index.html: フロントエンドUI
   ```

3. **Webアプリとしてデプロイ**
   ```
   - 「デプロイ」→「新しいデプロイ」
   - 種類: Webアプリ
   - 実行ユーザー: 自分
   - アクセスできるユーザー: 自分のみ（または組織内）
   ```

4. **権限の承認**
   ```
   - Calendar API
   - Drive API
   - Docs API
   ```

5. **初期設定**
   ```
   - PropertiesServiceにtaskNo=1を設定（任意、自動初期化される）
   ```

### 設定項目

**appsscript.json:**
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

**重要**: `timeZone`は必ず`"Asia/Tokyo"`に設定してください。これにより、すべての日付計算が日本標準時間で行われます。

**Code.gs内の設定:**
```javascript
const CONFIG = {
  calendarId: "9dsoil5r12um5nojs5qp1hun0g@group.calendar.google.com",
  folderName: "Tsk タスク管理",
  taskPrefix: "Tkk-",
  maxDescriptionLength: 3500,
  dueDateOffsetDays: 4
};
```

### セキュリティ考慮事項

1. **認証**
   - Google認証を使用
   - アクセス権限を適切に設定

2. **データ保護**
   - PropertiesServiceはスクリプト所有者のみアクセス可能
   - カレンダーとDocsは既存の権限設定に従う

3. **入力検証**
   - タスク名の必須チェック
   - 詳細文字数の制限（3500文字）
   - XSS対策（HTMLエスケープ）

## Future Enhancements

今後の拡張候補：

1. **タスク編集機能**
   - 作成済みイベントの編集
   - タスク番号での検索

2. **タスクテンプレート**
   - よく使うタスクをテンプレートとして保存
   - ワンクリックで入力

3. **バッチ処理**
   - CSVインポート
   - 一括削除

4. **通知機能**
   - 処理完了をメールで通知
   - エラー発生時のアラート

5. **統計機能**
   - 作成したタスク数の集計
   - 期限別の分析
