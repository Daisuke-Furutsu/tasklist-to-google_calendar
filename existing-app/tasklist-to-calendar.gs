function TaskListToCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const taskSheet = ss.getSheetByName("リストからタスク");
  const taskNoSheet = ss.getSheetByName("TaskNO");

  if (!taskSheet || !taskNoSheet) {
    throw new Error("必要なシートが見つかりません。");
  }

  const calendarId = "9dsoil5r12um5nojs5qp1hun0g@group.calendar.google.com";
  const calendar = CalendarApp.getCalendarById(calendarId);
  const driveFolderName = "Tsk タスク管理";

  let taskNo = taskNoSheet.getRange("A1").getValue();
  if (!taskNo) taskNo = 1;

  const lastRow = taskSheet.getLastRow();
  if (lastRow < 4) {
    showTemporaryMessage("転記するタスクがありません。");
    return;
  }

  const range = taskSheet.getRange(4, 1, lastRow - 3, 4);
  const values = range.getValues();

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let currentParentTaskName = "";

  for (const row of values) {
    const taskColumn = row[0];
    const dueDate = row[1];
    const taskDetail = row[2];
    const relatedTask = row[3];

    if (!taskColumn || !taskColumn.toString().trim()) {
      continue;
    }

    let taskId = null;
    if (taskColumn.includes("[[backlog]]")) {
      const match = taskColumn.match(/\[\[backlog\]\] (\S+)/);
      if (match) {
        taskId = match[1];
      }
    }

    let startDay, endDay;
    if (!dueDate) {
      startDay = todayStart;
      endDay = new Date(todayStart);
      endDay.setDate(endDay.getDate() + 1);
    } else {
      const due = new Date(dueDate);
      const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());

      if (dueDateOnly <= todayStart) {
        startDay = todayStart;
        endDay = new Date(todayStart);
        endDay.setDate(endDay.getDate() + 1);
      } else {
        const startCandidate = new Date(dueDateOnly);
        startCandidate.setDate(startCandidate.getDate() - 4);
        startDay = startCandidate <= todayStart ? todayStart : startCandidate;
        endDay = new Date(dueDateOnly);
        endDay.setDate(endDay.getDate() + 1);
      }
    }

    let isChildTask = false;
    let rowTaskName = taskColumn.toString().trim();
    if (rowTaskName.startsWith(">") || rowTaskName.startsWith("＞")) {
      isChildTask = true;
      rowTaskName = rowTaskName.replace(/^[>＞]+/, "").trim();
    }

    let finalTaskName;
    if (isChildTask) {
      finalTaskName = `${rowTaskName}@${currentParentTaskName}`;
    } else {
      currentParentTaskName = rowTaskName;
      finalTaskName = rowTaskName;
    }

    const taskNoStr = taskNo.toString().padStart(4, "0");
    const eventTitle = `Tsk-${taskNoStr} ${finalTaskName}`;

    let description = "";
    if (relatedTask && !isNaN(relatedTask)) {
      const relStr = relatedTask.toString().padStart(4, "0");
      description += `関連タスク: Tsk-${relStr}\n`;
    }
    if (isChildTask) {
      description += `親タスク: ${currentParentTaskName}\n`;
    }
    if (taskDetail) {
      description += `\n${taskDetail}`;
    }
    if (description.length > 3500) {
      description = description.substring(0, 3500);
    }

    let existingEvents = [];
    if (taskId) {
      existingEvents = calendar.getEvents(todayStart, new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()))
        .filter(event => event.getTitle().includes(taskId));
    }

    if (existingEvents.length > 0) {
      existingEvents.forEach(event => {
        event.setTime(startDay, endDay);
        event.setDescription(description);
      });
    } else {
      const event = calendar.createAllDayEvent(eventTitle, startDay, endDay, { description });

      const docsFile = createGoogleDocsFile(eventTitle, driveFolderName);
      if (docsFile) {
        event.setLocation(docsFile.getUrl());
        const doc = DocumentApp.openById(docsFile.getId());
        doc.getBody().appendParagraph(description);
        doc.saveAndClose();
      }

      taskNo++;
      taskNoSheet.getRange("A1").setValue(taskNo);
    }
  }

  const endTime = new Date();
  const elapsedTimeSec = ((endTime - today) / 1000).toFixed(2);
  showTemporaryMessage(`処理が完了しました。所要時間は${elapsedTimeSec}秒でした。`);
  clearTaskList();
}

function createGoogleDocsFile(fileName, folderName) {
  try {
    const folderIterator = DriveApp.getFoldersByName(folderName);
    let folder;
    if (folderIterator.hasNext()) {
      folder = folderIterator.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    const newFile = DocumentApp.create(fileName);
    const fileId = newFile.getId();
    const file = DriveApp.getFileById(fileId);
    file.moveTo(folder);

    return file;
  } catch (e) {
    console.error(`Google Docsファイル作成エラー: ${e.message}`);
    return null;
  }
}

function showTemporaryMessage(message) {
  const html = HtmlService.createHtmlOutput(`
    <html>
      <body>
        <div style="font-size:16px; text-align:center;">${message}</div>
        <script>
          setTimeout(() => { google.script.host.close(); }, 2000);
        </script>
      </body>
    </html>
  `);
  SpreadsheetApp.getUi().showModalDialog(html, '通知');
}
