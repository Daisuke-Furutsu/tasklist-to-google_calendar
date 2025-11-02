# 要件定義書

## Introduction

既存のコンテナバインドGoogle Spreadsheetsアプリを、スタンドアロンGoogle Apps Script (GAS) + HTML UIのWebアプリケーションに移行する。現在はSheetsがUIとして機能しているが、今後はHTML/CSS/JavaScriptで構築されたWebインターフェースを提供し、ユーザーがブラウザから直接アクセスできるようにする。データ格納にはGoogle Sheetsを使用せず、タスク番号管理にはGASのPropertiesServiceを使用する。

## Glossary

- **GAS (Google Apps Script)**: Googleのクラウドベースのスクリプトプラットフォーム
- **System**: タスク管理Webアプリケーション
- **User**: アプリケーションを使用してタスクをカレンダーに転記するユーザー
- **Task**: ユーザーが入力するタスク情報（タスク名、期限、詳細）
- **Calendar Event**: Google カレンダーに作成される終日イベント
- **Task Number**: タスクに割り当てられる一意の4桁ゼロ埋め番号（Tkk-0001から開始）
- **Parent Task**: 子タスクの親となるタスク（タスク名の先頭に `>` または `＞` がないタスク）
- **Child Task**: 親タスクに紐づくタスク（タスク名の先頭に `>` または `＞` があるタスク）
- **Google Docs File**: タスクごとに作成されるGoogle ドキュメントファイル
- **Task Detail**: タスクの詳細情報（最大3,500文字）
- **Web UI**: HTML/CSS/JavaScriptで構築されたユーザーインターフェース
- **PropertiesService**: GASが提供するキー・バリュー型のストレージサービス
- **JST (Japan Standard Time)**: 日本標準時間（Asia/Tokyo タイムゾーン）
- **Today**: 本日の日付（JST基準）

## システム全体の制約

### 制約1: タイムゾーン

THE System SHALL 日本標準時間（JST / Asia/Tokyo）を使用する

- すべての日付・時刻計算はJSTを基準とする
- `appsscript.json`の`timeZone`設定は`"Asia/Tokyo"`とする
- 「本日」「今日」などの表現はすべてJST基準とする

## Requirements

### Requirement 1

**User Story:** ユーザーとして、Webブラウザから直接アプリケーションにアクセスしたい。これにより、Google Sheetsを開かずにタスク管理ができるようになる。

#### Acceptance Criteria

1. WHEN User がスタンドアロンGASのWebアプリURLにアクセスする, THEN THE System SHALL HTML UIを表示する
2. THE System SHALL Bootstrap, htmx, Alpine.jsをCDN経由で読み込む
3. THE System SHALL Google認証を通じてユーザーを識別する
4. THE System SHALL レスポンシブデザインでモバイルデバイスにも対応する

### Requirement 2

**User Story:** ユーザーとして、Webフォームからタスク情報を入力したい。これにより、直感的にタスクを追加できるようになる。

#### Acceptance Criteria

1. THE System SHALL タスク名入力フィールドを提供する
2. THE System SHALL 期限日付選択フィールドを提供する
3. THE System SHALL タスク詳細入力フィールド（テキストエリア）を提供する
4. THE System SHALL 複数のタスクを一度に入力できる動的な行追加機能を提供する

### Requirement 3

**User Story:** ユーザーとして、入力したタスクをGoogle カレンダーに転記したい。これにより、既存アプリと同じ機能をWebから実行できるようになる。

#### Acceptance Criteria

1. WHEN User が「処理開始」ボタンをクリックする, THEN THE System SHALL 入力されたすべてのタスクを処理する
2. THE System SHALL 各タスクに対して「Tkk-」プレフィックス付きの4桁ゼロ埋めタスク番号を割り当てる
3. THE System SHALL タスク番号をPropertiesServiceに保存する
4. THE System SHALL 指定されたGoogle カレンダー（カレンダーID: 9dsoil5r12um5nojs5qp1hun0g@group.calendar.google.com）に終日イベントを作成する
5. THE System SHALL 処理完了後に所要時間を表示する

### Requirement 4

**User Story:** ユーザーとして、期限に応じた適切な日程でカレンダーイベントを作成したい。これにより、タスクの可視性と管理性が向上する。

#### Acceptance Criteria

1. WHEN 期限が空欄である, THEN THE System SHALL 本日を開始日とし翌日0:00を終了日とする終日イベントを作成する
2. WHEN 期限が本日以前である, THEN THE System SHALL 本日を開始日とし翌日0:00を終了日とする終日イベントを作成する
3. WHEN 期限が未来日付である, THEN THE System SHALL (期限日-4日)と本日のうち遅い方を開始日とし、期限日翌日0:00を終了日とする終日イベントを作成する
4. THE System SHALL 終日イベントとして排他エンド形式で日時を設定する

### Requirement 5

**User Story:** ユーザーとして、親子関係のあるタスクを管理したい。これにより、タスクの階層構造を表現できるようになる。

#### Acceptance Criteria

1. WHEN タスク名が `>` または `＞` で始まる, THEN THE System SHALL そのタスクを子タスクとして認識する
2. THE System SHALL 子タスクのイベントタイトルを「子タスク名@親タスク名」形式で作成する
3. THE System SHALL 子タスクのDescriptionに「親タスク: (親タスク名)」を追加する
4. THE System SHALL 直前の `>` または `＞` がないタスクを親タスクとして記憶する
5. THE System SHALL 子タスク名から先頭の `>` または `＞` を除去する



### Requirement 6

**User Story:** ユーザーとして、各タスクに対応するGoogle Docsファイルを自動作成したい。これにより、タスクの詳細情報を一元管理できるようになる。

#### Acceptance Criteria

1. THE System SHALL カレンダーイベント作成時に同名のGoogle Docsファイルを作成する
2. THE System SHALL Google Docsファイルを「Tsk タスク管理」フォルダに配置する
3. WHEN 「Tsk タスク管理」フォルダが存在しない, THEN THE System SHALL 自動的にフォルダを作成する
4. THE System SHALL Google DocsファイルのURLをカレンダーイベントの「場所」欄に設定する
5. THE System SHALL カレンダーイベントのDescriptionをGoogle Docsファイルに書き込む

### Requirement 7

**User Story:** ユーザーとして、カレンダーイベントに詳細情報を含めたい。これにより、カレンダーから直接タスク情報を確認できるようになる。

#### Acceptance Criteria

1. THE System SHALL イベントタイトルを「Tkk-xxxx タスク名」形式で作成する（xxxxは4桁ゼロ埋め）
2. THE System SHALL タスク詳細をイベントDescriptionに含める
3. THE System SHALL イベントDescriptionを最大3,500文字に制限する
4. WHEN タスク詳細が3,500文字を超える, THEN THE System SHALL 超過分を切り捨てる

### Requirement 8

**User Story:** ユーザーとして、入力したタスクリストをクリアしたい。これにより、処理後に新しいタスクを入力しやすくなる。

#### Acceptance Criteria

1. THE System SHALL 「リストをクリア」ボタンを提供する
2. WHEN User が「リストをクリア」ボタンをクリックする, THEN THE System SHALL すべての入力フィールドをクリアする
3. THE System SHALL 処理完了後に自動的に入力フィールドをクリアする

### Requirement 9

**User Story:** ユーザーとして、処理の進行状況を確認したい。これにより、処理が正常に実行されているか把握できるようになる。

#### Acceptance Criteria

1. WHEN User が「処理開始」ボタンをクリックする, THEN THE System SHALL ローディングインジケーターを表示する
2. THE System SHALL 処理完了時に所要時間を含む完了メッセージを表示する
3. THE System SHALL エラー発生時にエラーメッセージを表示する
4. THE System SHALL 処理完了メッセージを2秒後に自動的に閉じる

### Requirement 10

**User Story:** ユーザーとして、タスク番号を永続的に管理したい。これにより、アプリを再起動してもタスク番号が継続される。

#### Acceptance Criteria

1. THE System SHALL PropertiesServiceからタスク番号を取得する
2. THE System SHALL イベント作成ごとにタスク番号を1増加させる
3. THE System SHALL 更新されたタスク番号をPropertiesServiceに保存する
4. WHEN タスク番号が存在しない, THEN THE System SHALL タスク番号を1から開始する
5. THE System SHALL タスク番号を「Tkk-」プレフィックス付きの4桁ゼロ埋め形式で使用する
