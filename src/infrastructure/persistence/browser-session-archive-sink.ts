import type { SessionArchiveFile, SessionArchiveSink } from "../../application/ports/session-archive-sink.ts";

type DownloadLink = {
  href: string;
  download: string;
  hidden: boolean;
  rel: string;
  click(): void;
  remove(): void;
};

type DownloadDocument = {
  body: { append(link: DownloadLink): unknown };
  createElement(tag: "a"): DownloadLink;
};

type ObjectUrlFactory = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
};

function browserDocument(): DownloadDocument | undefined {
  return typeof document === "undefined" ? undefined : (document as unknown as DownloadDocument);
}

function browserObjectUrls(): ObjectUrlFactory | undefined {
  return typeof URL === "undefined" ? undefined : URL;
}

export class BrowserSessionArchiveSink implements SessionArchiveSink {
  private readonly documentRef: DownloadDocument | undefined;
  private readonly objectUrls: ObjectUrlFactory | undefined;

  constructor(documentRef = browserDocument(), objectUrls = browserObjectUrls()) {
    this.documentRef = documentRef;
    this.objectUrls = objectUrls;
  }

  save(file: SessionArchiveFile): void {
    if (!this.documentRef) throw new Error("A browser document is required to save session history.");
    if (!this.objectUrls) throw new Error("Browser object URLs are unavailable.");

    const blob = new Blob([file.content], { type: file.mediaType });
    const url = this.objectUrls.createObjectURL(blob);
    let link: DownloadLink | undefined;

    try {
      link = this.documentRef.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.hidden = true;
      link.rel = "noopener";
      this.documentRef.body.append(link);
      link.click();
    } finally {
      try {
        link?.remove();
      } finally {
        this.objectUrls.revokeObjectURL(url);
      }
    }
  }
}
