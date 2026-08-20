import assert from "node:assert/strict";
import test from "node:test";
import {
  compareOfficialDocument,
  assertOfficialMonitorUrl,
  fetchOfficialDocument,
  extractOfficialContent,
  normalizeOfficialContent,
  renderDriftReport,
  sourceDigest,
} from "../scripts/monitor-takken-sources.mjs";

test("official content normalization is deterministic across JSON and HTML noise", () => {
  assert.equal(normalizeOfficialContent("egov-json", '{"a": 1}'), '{"a":1}');
  assert.equal(
    normalizeOfficialContent("egov-json", '{"b":2,"a":{"d":4,"c":3}}'),
    normalizeOfficialContent("egov-json", '{"a":{"c":3,"d":4},"b":2}'),
  );
  assert.equal(normalizeOfficialContent("html-text", "<style>x</style><h1> Official </h1>  source"), "Official source");
});

test("HTML monitoring hashes the declared content window instead of page chrome", () => {
  const document = {
    format: "html-text",
    contentWindow: { startMarker: "Article start", endMarker: "Article end" },
  };
  const first = "<nav>old menu</nav><main>Article start stable body Article end</main><footer>old footer</footer>";
  const second = "<nav>new menu</nav><main>Article start stable body Article end</main><footer>new footer</footer>";
  assert.equal(extractOfficialContent(document, first), "Article start stable body");
  assert.equal(extractOfficialContent(document, first), extractOfficialContent(document, second));
});

test("the monitor cannot be redirected outside the three official hosts", () => {
  assert.doesNotThrow(() => assertOfficialMonitorUrl("https://www.retio.or.jp/exam/schedule/"));
  assert.throws(() => assertOfficialMonitorUrl("https://example.com/official"), /not allowlisted/);
  assert.throws(() => assertOfficialMonitorUrl("http://www.mlit.go.jp/official"), /not allowlisted/);
  assert.throws(() => assertOfficialMonitorUrl("https://user@www.mlit.go.jp/official"), /not allowlisted/);
  assert.throws(() => assertOfficialMonitorUrl("https://www.mlit.go.jp:444/official"), /not allowlisted/);
});

test("the monitor rejects redirects before following their destination", async () => {
  let requestOptions;
  const fetchImpl = async (_url, options) => {
    requestOptions = options;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
  };
  await assert.rejects(
    fetchOfficialDocument({ id: "official", url: "https://www.retio.or.jp/redirect" }, fetchImpl),
    /redirects are not allowed/,
  );
  assert.equal(requestOptions.redirect, "manual");
});

test("drift includes digest and marker changes without copying official content", () => {
  const raw = "<h1>Official source</h1>";
  const stable = {
    id: "official",
    title: "Official",
    url: "https://www.mlit.go.jp/official",
    asOfDate: "2026-04-01",
    format: "html-text",
    digest: sourceDigest("html-text", raw),
    expectedMarkers: ["Official"],
    affectedSourceIds: ["S01", "S12"],
  };
  assert.equal(compareOfficialDocument(stable, raw).changed, false);
  const changed = compareOfficialDocument(stable, "<h1>Changed</h1>");
  assert.equal(changed.changed, true);
  assert.deepEqual(changed.missingMarkers, ["Official"]);
  const report = renderDriftReport([changed], "2026-08-20T00:00:00.000Z");
  assert.match(report, /自動公開は行いません/);
  assert.match(report, /登録digest/);
  assert.match(report, /S01, S12/);
  assert.doesNotMatch(report, /<h1>/);
});
