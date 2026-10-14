/** Converts a 1-indexed column number to its A1 letter(s), e.g. 1 -> A, 27 -> AA. */
export function columnLetter(n: number): string {
  let s = '';
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

/** Builds an A1 range like `Leads!A5:O504` for a block starting at (startRow, 1) spanning columnCount columns and rowCount rows. */
export function a1Range(sheetTitle: string, startRow: number, columnCount: number, rowCount: number): string {
  const endRow = startRow + rowCount - 1;
  const endCol = columnLetter(columnCount);
  return `${sheetTitle}!A${startRow}:${endCol}${endRow}`;
}
