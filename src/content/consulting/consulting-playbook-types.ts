export type PlaybookCell = {
  column: number;
  value: string;
  formula?: string;
};

export type PlaybookRow = {
  index: number;
  cells: ReadonlyArray<PlaybookCell>;
};

export type PlaybookSheet = {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  rows: ReadonlyArray<PlaybookRow>;
};

export type ConsultingPlaybook = {
  source: string;
  version: number;
  stats: {
    sheetCount: number;
    rowCount: number;
    nonemptyCellCount: number;
    formulaCellCount: number;
  };
  sheets: ReadonlyArray<PlaybookSheet>;
};
