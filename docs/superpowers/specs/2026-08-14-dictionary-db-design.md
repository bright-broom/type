# TypeLoop Dictionary Database Design

Date: 2026-08-14
Status: Approved design
Target repository: `bright-broom/type`

## 1. Purpose

Create a lightweight, maintainable Japanese word database that is independent of TypeLoop runtime concerns but can generate TypeLoop-compatible typing prompts.

The database covers five domains:

1. Tokyo place and transportation terminology
2. Toggle Holdings internal terminology and product names
3. Toggle Holdings organization, unit, department, team, role, and position names
4. Japanese bank names
5. Current Japanese political terminology

The canonical data is human-reviewable TSV. JSON files consumed by the application are generated artifacts and must not be edited by hand.

This follows the repository's existing content flow:

`source file -> importer -> generated JSON -> typed content loader -> presentation`

## 2. Scope

### 2.1 Tokyo

Include:

- Tokyo special wards, cities, towns, and villages
- Town/area names and chome-level names where present in authoritative source data
- Railway stations
- Railway lines
- Railway operators
- Bus operators
- Major bus stops only
- Expressways
- Junctions and interchanges
- Major roads and commonly used street names

Do not attempt to include every bus stop in Tokyo in v1.

### 2.2 Toggle internal terminology

Include terminology confirmed from internal sources, including:

- internal abbreviations
- internal programs and initiatives
- internal systems
- product and service names
- project vocabulary that is sufficiently durable to train
- meeting room names

Known examples already confirmed include `デベNAVI`, `Pascal`, `Turing`, and `Moore`.

### 2.3 Toggle organization

Include current and materially used names for:

- legal entities
- divisions
- departments
- units
- groups
- teams
- positions
- managerial roles
- recurring organizational role labels

Historical names may be retained with `active=false` when useful for recognition, but they must not be mixed with current names without status metadata.

### 2.4 Japanese banks

Include licensed Japanese banks and commonly typed accepted short forms.

The canonical term should be the formal institution name from an authoritative regulator or banking-industry source. Aliases may include common abbreviations and orthographic variants.

### 2.5 Current Japanese politics

Scope is current Japanese politics, not broad political history or international politics.

Include:

- current political parties
- Diet terminology
- Cabinet terminology
- ministries and agencies
- political offices and titles
- election terminology
- parliamentary procedures
- policy and administrative terminology frequently appearing in current political discourse
- common structural terms such as ruling party, opposition party, coalition, proportional representation, constituency, committee, plenary sitting, Cabinet decision, and similar vocabulary

Dynamic entities must carry source-date metadata.

## 3. Architecture

The dictionary database is a content subsystem, not a runtime database.

```text
dictionary-db/
├── sources/
│   └── sources.json
├── data/
│   ├── tokyo.tsv
│   ├── toggle-terms.tsv
│   ├── toggle-organization.tsv
│   ├── banks.tsv
│   └── politics-jp.tsv
├── generated/
│   ├── dictionary.json
│   └── typeloop-prompts.json
└── README.md
```

When integrated into TypeLoop, generated application assets should be copied or emitted into the repository's existing `src/content/generated/` boundary rather than introducing runtime file or network access.

No backend, SQLite runtime dependency, API call, telemetry, account, or server persistence is required.

## 4. Canonical record model

Canonical TSV columns:

```text
id
term
reading
aliases
domain
category
subcategory
parent
sourceRef
sourceAsOf
active
priority
notes
```

### Field semantics

- `id`: stable machine identifier. Must not change when display spelling changes unless identity itself changes.
- `term`: canonical display form.
- `reading`: canonical hiragana reading used to derive typing input.
- `aliases`: zero or more alternate forms separated using an importer-defined safe delimiter.
- `domain`: one of `tokyo`, `toggle`, `toggle_org`, `bank`, `politics_jp`.
- `category`: primary classification.
- `subcategory`: optional narrower classification.
- `parent`: optional stable parent record ID.
- `sourceRef`: key into `sources/sources.json`.
- `sourceAsOf`: date when the source state was valid or retrieved, `YYYY-MM-DD`.
- `active`: `true` or `false`.
- `priority`: integer weighting for prompt selection or curation. It must not encode identity.
- `notes`: brief human-reviewable clarification only.

## 5. Generated normalized model

The importer may generate additional internal fields that are not canonical TSV columns, including:

- `normalizedTerm`
- `normalizedAliases`
- `relations`
- `sourceMetadata`

Normalization is used for comparison and validation only. The formal spelling in `term` must be preserved.

Normalization rules:

1. Unicode NFKC for comparison keys
2. trim leading/trailing whitespace
3. collapse repeated internal spaces where semantically irrelevant
4. normalize ASCII letter case in comparison keys
5. normalize katakana/hiragana only for comparison keys where appropriate
6. preserve official display typography in `term`

## 6. Identity and deduplication

Records represent entities or training concepts, not merely strings.

Examples:

- `渋谷` as a place and `渋谷駅` as a station are different records.
- One physical railway station served by multiple lines should normally remain one station record with relations/tags to multiple lines rather than duplicated station records.
- A formal bank name and its abbreviation are one bank record, with the abbreviation in aliases.
- A renamed Toggle organizational unit may be represented as a new identity when the organization itself materially changed; otherwise retain stable identity and update aliases/status based on evidence.

Deduplication checks should flag, not silently merge, ambiguous collisions across different categories.

## 7. Reading policy

Every active training record must have a validated hiragana reading.

Priority order:

1. authoritative source-provided reading
2. organization/operator official reading
3. trusted structured source
4. deterministic normalization from unambiguous kana source
5. manually reviewed reading

Do not silently infer uncertain readings for proper nouns.

Foreign/English internal names should receive a Japanese reading intended for typing practice, for example meeting-room names. The display term remains the original formal name.

Readings must pass validation for supported TypeLoop Japanese romanization behavior.

## 8. Source registry

`sources/sources.json` records reusable provenance metadata.

Each entry should contain at minimum:

```json
{
  "id": "jp-post-tokyo-address",
  "name": "Japan Post address data",
  "authority": "Japan Post",
  "type": "public",
  "url": "source URL or durable source description",
  "retrievedAt": "YYYY-MM-DD",
  "notes": "optional"
}
```

Internal Google Drive sources should not embed confidential file contents into source metadata. Store a stable source label and, when appropriate, a Drive file ID or controlled reference rather than copied confidential prose.

## 9. Domain-specific generation rules

### 9.1 Tokyo

Preferred source hierarchy:

- address/town readings: Japan Post structured address data
- railway stations/lines: Ministry of Land, Infrastructure, Transport and Tourism national land data and operator confirmation when needed
- railway operators: official operator information
- bus operators and major stops: operator GTFS/official structured data where available; MLIT data as fallback
- expressways/JCT/IC: national land data and road operator confirmation
- major roads/street names: Tokyo Metropolitan Government official road/street-name data

Major bus stop selection in v1 should be deterministic. A stop qualifies if one or more of these apply:

- directly connected to a railway station or major terminal
- serves multiple routes or operators above a configured threshold
- designated as a bus terminal or major interchange in source data
- explicitly curated as a high-importance stop

The importer must preserve the selection reason in generated metadata or build logs for auditability.

### 9.2 Toggle terminology

Preferred sources:

1. explicit internal terminology masters
2. current company/product documentation
3. current organization and onboarding documentation
4. recurring operational documentation

Do not indiscriminately tokenize every internal document. Include terms that are named concepts, durable abbreviations, products, systems, rooms, or recurring internal vocabulary.

When conflicting names exist, prefer the most recent authoritative source and retain old names as aliases or inactive records when useful.

### 9.3 Toggle organization

Preferred sources:

1. current organization chart
2. current headcount/organization planning source where clearly authoritative
3. current onboarding/recruiting source
4. recurring operational references for corroboration

Every organizational record should include a category such as `company`, `division`, `department`, `unit`, `group`, `team`, `position`, or `role`.

Parent relationships should be used where reliable, but missing parent data must not block an otherwise valid record.

### 9.4 Banks

Preferred source hierarchy:

1. Financial Services Agency licensed institution list
2. Japanese Bankers Association member list for cross-checking
3. bank official pages for accepted reading/name clarification

Remove non-bank financial institutions unless intentionally included by a later scope change.

Current institutions use `active=true`. Merged or renamed institutions may be retained only when deliberately useful and must be marked inactive.

### 9.5 Current Japanese politics

Preferred source hierarchy:

- Cabinet and ministerial organization: Prime Minister's Office and ministry/agency official sites
- Diet structure, parliamentary groups, procedure: House of Representatives and House of Councillors official sources
- political parties: official Diet information and party official sources for names/readings as needed
- election system: Ministry of Internal Affairs and Communications and election administration sources

Person names are excluded from the initial political dictionary unless separately approved. The v1 target is durable institutional/political vocabulary, reducing churn and political-personality bias.

## 10. Active/inactive behavior

`active=true` means eligible for normal training-set generation.

`active=false` means retained for recognition, migration, historical aliases, or review but excluded from normal prompts by default.

Importers must never delete an existing stable ID merely because an upstream source temporarily omits it. Such cases should be surfaced for review and changed to inactive only through a deliberate update policy.

## 11. TypeLoop adapter

Dictionary records are converted into the existing `TypingPrompt` model:

```ts
{
  id,
  displayText: term,
  reading,
  category,
  difficulty,
  tags,
  description
}
```

The domain database must not be constrained to only fields supported by `TypingPrompt`; the adapter is a projection.

Recommended generated prompt tags include domain, category, subcategory, and selected source/status metadata where useful.

Difficulty should be derived deterministically from reading length or the repository's future common difficulty policy.

## 12. Validation

The import/build pipeline must fail on:

- duplicate `id`
- missing active `term`
- missing active `reading`
- invalid `domain`
- invalid `active` value
- malformed date fields
- active record with unknown `sourceRef`
- reading outside supported Japanese prompt constraints
- exact duplicate entity within the same domain/category when deterministic evidence shows duplication

The pipeline should warn on:

- suspiciously similar terms
- same canonical term across multiple categories
- stale dynamic source dates
- inactive records that reappear in current upstream sources
- uncertain reading provenance

## 13. Update cadence

Suggested cadence:

- Tokyo address/transport: quarterly or on source release
- Toggle terminology: monthly and after major product/process changes
- Toggle organization: monthly and after organization changes
- banks: monthly or on regulator/member-list update
- politics: monthly and after Cabinet, ministry, Diet-group, party, or election-system changes

This is a build-time content refresh. TypeLoop itself remains local-first and requires no runtime update service.

## 14. Security and confidentiality

Public dictionaries may use public source URLs.

Internal Toggle content must remain limited to terminology necessary for training. Do not copy confidential explanations, financial data, employee personal data, customer information, contracts, or meeting contents into the dictionary.

For internal source provenance, store only the minimum reference necessary to reproduce or review the term.

## 15. Testing strategy

Unit tests:

- TSV parsing and delimiter handling
- normalization
- stable ID validation
- alias normalization
- reading validation
- source-reference validation
- active/inactive filtering
- TypeLoop prompt projection

Dataset tests:

- representative Tokyo place/station/road records
- one multi-line station relationship
- representative Toggle product/internal term/room
- representative Toggle organization hierarchy
- representative bank formal name plus alias
- representative current political institution/term

Repository-level tests:

- generated artifacts match committed source data
- no generated file is manually edited without importer regeneration
- content modules respect existing architecture boundaries

## 16. Delivery boundaries

Phase 1: dictionary DB and import/build pipeline.

Phase 2: TypeLoop training-set registration and UI/filter integration.

Keeping these phases separate allows the data asset to be reviewed independently before product behavior changes.

## 17. Success criteria

The design is successful when:

- all five domains are represented by human-reviewable canonical source data
- every active record has a stable ID and validated reading
- provenance is traceable
- regeneration is deterministic
- TypeLoop-compatible prompts can be generated without runtime network access
- public and internal source handling remain clearly separated
- adding or refreshing a domain does not require editing generated JSON by hand
