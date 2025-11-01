function clearTaskList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("リストからタスク");

  if (!sheet) {
    throw new Error('シート "リストからタスク" が見つかりません');
  }

  const startRow = 4;
  // ▼ ポイント: 列Aで実際にデータがある最後の行を取得
  const lastRowA = sheet.getRange("A" + sheet.getMaxRows()).getNextDataCell(SpreadsheetApp.Direction.UP).getRow();

  // もしデータが存在しない or A4より上の行が最終行なら何もしない
  if (lastRowA < startRow) return;

  // A列からD列までを一括取得
  const range = sheet.getRange(startRow, 1, lastRowA - startRow + 1, 4);
  const values = range.getValues();

  // A列が空ではない行をすべて空白化
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] !== "") {
      values[i][0] = "";
      values[i][1] = "";
      values[i][2] = "";
      values[i][3] = "";
    }
  }

  // 一括で書き戻す
  range.setValues(values);
}
