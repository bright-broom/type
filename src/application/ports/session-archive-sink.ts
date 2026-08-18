export type SessionArchiveFile = {
  filename: string;
  mediaType: "application/json;charset=utf-8";
  content: string;
};

export interface SessionArchiveSink {
  save(file: SessionArchiveFile): void;
}
