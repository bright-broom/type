import assert from "node:assert/strict";
import test from "node:test";
import type { SessionArchiveFile } from "../../application/ports/session-archive-sink.ts";
import { BrowserSessionArchiveSink } from "./browser-session-archive-sink.ts";

const file: SessionArchiveFile = {
  filename: "typeloop-history.json",
  mediaType: "application/json;charset=utf-8",
  content: '{"version":1}\n',
};

test("downloads an archive through a temporary object URL and cleans it up", async () => {
  let clicked = false;
  let removed = false;
  let appended = false;
  let capturedBlob: Blob | undefined;
  const link = {
    href: "",
    download: "",
    hidden: false,
    rel: "",
    click: () => {
      clicked = true;
    },
    remove: () => {
      removed = true;
    },
  };
  const documentRef = {
    body: { append: () => (appended = true) },
    createElement: () => link,
  };
  const revoked: string[] = [];
  const objectUrls = {
    createObjectURL: (blob: Blob) => {
      capturedBlob = blob;
      return "blob:typeloop-history";
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  };

  new BrowserSessionArchiveSink(documentRef, objectUrls).save(file);

  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.equal(link.download, file.filename);
  assert.equal(link.href, "blob:typeloop-history");
  assert.equal(await capturedBlob?.text(), file.content);
  assert.deepEqual(revoked, ["blob:typeloop-history"]);
});

test("fails explicitly when a browser document is unavailable", () => {
  const objectUrls = { createObjectURL: () => "blob:test", revokeObjectURL: () => undefined };
  assert.throws(() => new BrowserSessionArchiveSink(undefined, objectUrls).save(file), /browser document/i);
});

test("releases the object URL when link setup fails", () => {
  const documentRef = {
    body: { append: () => undefined },
    createElement: () => {
      throw new Error("link unavailable");
    },
  };
  const revoked: string[] = [];
  const objectUrls = {
    createObjectURL: () => "blob:typeloop-history",
    revokeObjectURL: (url: string) => revoked.push(url),
  };

  assert.throws(() => new BrowserSessionArchiveSink(documentRef, objectUrls).save(file), /link unavailable/);
  assert.deepEqual(revoked, ["blob:typeloop-history"]);
});
