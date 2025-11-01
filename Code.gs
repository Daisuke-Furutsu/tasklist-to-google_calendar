/**
 * タスク管理Webアプリケーション - メインコード
 * スタンドアロンGoogle Apps Script
 */

// ========================================
// Webアプリエントリーポイント
// ========================================

/**
 * WebアプリのGETリクエストを処理してHTML UIを提供
 * @param {Object} e - イベントオブジェクト
 * @return {HtmlOutput} HTML UI
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('タスク管理アプリ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * WebアプリのPOSTリクエストを処理してタスクを実行
 * @param {Object} e - イベントオブジェクト（POSTデータを含む）
 * @return {ContentService.TextOutput} JSON形式の処理結果
 */
function doPost(e) {
  try {
    // POSTデータをパース
    let taskData;
    
    if (e.postData && e.postData.contents) {
      // JSON形式のデータをパース
      const requestData = JSON.parse(e.postData.contents);
      taskData = requestData.tasks || [];
    } else {
      // データが存在しない場合は空配列
      taskData = [];
    }
    
    // processTaskList()関数を呼び出して処理を実行
    const result = processTaskList(taskData);
    
    // 処理結果をJSON形式で返却
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // エラーをログに出力
    Logger.log(`doPost エラー: ${error.message}`);
    Logger.log(`スタックトレース: ${error.stack}`);
    
    // エラー結果をJSON形式で返却
    const errorResult = {
      success: false,
      message: `リクエスト処理エラー: ${error.message}`,
      elapsedTime: 0
    };
    
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================
// タスク番号管理関数
// ========================================

/**
 * PropertiesServiceからタスク番号を取得
 * @return {number} 現在のタスク番号（存在しない場合は1）
 */
function getTaskNumber() {
  const properties = PropertiesService.getScriptProperties();
  const taskNo = properties.getProperty('taskNo');
  return taskNo ? parseInt(taskNo) : 1;
}

/**
 * タスク番号をPropertiesServiceに保存
 * @param {number} newTaskNo - 新しいタスク番号
 */
function incrementTaskNumber(newTaskNo) {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('taskNo', newTaskNo.toString());
}

// ========================================
// タスク名解析関数
// ========================================

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

// ========================================
// 日付計算関数
// ========================================

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

// ========================================
// Google Docs連携関数
// ========================================

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
    Logger.log(`Google Docsファイル作成エラー: ${error.message}`);
    return null;
  }
}

// ========================================
// イベントタイトル生成関数
// ========================================

/**
 * イベントタイトルを生成
 * @param {number} taskNo - タスク番号
 * @param {string} taskName - タスク名
 * @param {boolean} isChild - 子タスクかどうか
 * @param {string} parentName - 親タスク名（子タスクの場合）
 * @return {string} イベントタイトル
 */
function generateEventTitle(taskNo, taskName, isChild, parentName) {
  const taskNoStr = taskNo.toString().padStart(4, '0');
  
  if (isChild) {
    return `Tkk-${taskNoStr} ${taskName}@${parentName}`;
  }
  
  return `Tkk-${taskNoStr} ${taskName}`;
}

// ========================================
// イベントDescription生成関数
// ========================================

/**
 * イベントDescriptionを生成
 * @param {boolean} isChild - 子タスクかどうか
 * @param {string} parentName - 親タスク名（子タスクの場合）
 * @param {string} taskDetail - タスク詳細
 * @return {string} イベントDescription（最大3,500文字）
 */
function generateEventDescription(isChild, parentName, taskDetail) {
  let description = "";
  
  if (isChild) {
    description += `親タスク: ${parentName}\n`;
  }
  
  if (taskDetail) {
    description += `\n${taskDetail}`;
  }
  
  // 3,500文字制限
  if (description.length > 3500) {
    description = description.substring(0, 3500);
  }
  
  return description;
}

// ========================================
// カレンダーイベント作成関数
// ========================================

/**
 * カレンダーイベントを作成
 * @param {string} calendarId - カレンダーID
 * @param {string} eventTitle - イベントタイトル
 * @param {Date} startDay - 開始日
 * @param {Date} endDay - 終了日
 * @param {string} description - イベントDescription
 * @param {string} docsUrl - Google DocsファイルのURL（任意）
 * @return {CalendarEvent} 作成されたカレンダーイベント
 */
function createCalendarEvent(calendarId, eventTitle, startDay, endDay, description, docsUrl) {
  const calendar = CalendarApp.getCalendarById(calendarId);
  
  const options = {
    description: description
  };
  
  // DocsファイルURLが提供されている場合は「場所」欄に設定
  if (docsUrl) {
    options.location = docsUrl;
  }
  
  const event = calendar.createAllDayEvent(eventTitle, startDay, endDay, options);
  
  return event;
}

// ========================================
// メイン処理関数
// ========================================

/**
 * タスクリストを処理してカレンダーに転記
 * @param {Array} taskData - タスクデータの配列 [{ name: string, dueDate: string, detail: string }, ...]
 * @return {Object} 処理結果 { success: boolean, message: string, elapsedTime: number }
 */
function processTaskList(taskData) {
  // 処理開始時刻を記録
  const startTime = new Date();
  
  try {
    // 設定
    const calendarId = "9dsoil5r12um5nojs5qp1hun0g@group.calendar.google.com";
    const folderName = "Tsk タスク管理";
    
    // タスク番号を取得
    let taskNo = getTaskNumber();
    
    // 親タスク名を追跡
    let currentParentTaskName = "";
    
    // タスク配列をループして各タスクを処理
    for (const task of taskData) {
      // 空のタスク名をスキップ
      if (!task.name || !task.name.trim()) {
        continue;
      }
      
      // タスク名を解析して親子関係を判定
      const { isChild, taskName, parentName } = parseTaskName(task.name, currentParentTaskName);
      
      // 親タスクの場合は追跡用に保存
      if (!isChild) {
        currentParentTaskName = taskName;
      }
      
      // 日付計算
      const { startDay, endDay } = calculateEventDates(task.dueDate);
      
      // イベントタイトル生成
      const eventTitle = generateEventTitle(taskNo, taskName, isChild, parentName);
      
      // イベントDescription生成
      const description = generateEventDescription(isChild, parentName, task.detail);
      
      // Google Docsファイル作成
      const docsFile = createDocsFile(eventTitle, folderName, description);
      const docsUrl = docsFile ? docsFile.getUrl() : null;
      
      // カレンダーイベント作成
      createCalendarEvent(calendarId, eventTitle, startDay, endDay, description, docsUrl);
      
      // タスク番号をインクリメント
      taskNo++;
    }
    
    // 更新されたタスク番号を保存
    incrementTaskNumber(taskNo);
    
    // 処理終了時刻を記録
    const endTime = new Date();
    
    // 所要時間を計算（秒単位、小数点以下2桁）
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
    
    // 成功結果を返却
    return {
      success: true,
      message: `処理が完了しました。所要時間は${elapsedTime}秒でした。`,
      elapsedTime: parseFloat(elapsedTime)
    };
    
  } catch (error) {
    // エラーをログに出力
    Logger.log(`エラーが発生しました: ${error.message}`);
    Logger.log(`スタックトレース: ${error.stack}`);
    
    // 処理終了時刻を記録
    const endTime = new Date();
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2);
    
    // エラー結果を返却
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
      elapsedTime: parseFloat(elapsedTime)
    };
  }
}
