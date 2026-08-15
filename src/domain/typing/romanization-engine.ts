import type { ActiveMatch, RomanSegment, TypingGuide, TypingResult, TypingState } from "./typing-types.ts";

const KANA: Readonly<Record<string, ReadonlyArray<string>>> = {
  あ: ["a"],
  い: ["i"],
  う: ["u"],
  え: ["e"],
  お: ["o"],
  か: ["ka"],
  き: ["ki"],
  く: ["ku"],
  け: ["ke"],
  こ: ["ko"],
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  さ: ["sa"],
  し: ["shi", "si"],
  す: ["su"],
  せ: ["se"],
  そ: ["so"],
  ざ: ["za"],
  じ: ["ji", "zi"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  た: ["ta"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  て: ["te"],
  と: ["to"],
  だ: ["da"],
  ぢ: ["ji", "di"],
  づ: ["zu", "du"],
  で: ["de"],
  ど: ["do"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ゔ: ["vu"],
  ぁ: ["xa", "la"],
  ぃ: ["xi", "li"],
  ぅ: ["xu", "lu"],
  ぇ: ["xe", "le"],
  ぉ: ["xo", "lo"],
  ゃ: ["xya", "lya"],
  ゅ: ["xyu", "lyu"],
  ょ: ["xyo", "lyo"],
  ー: ["-"],
};

const DIGRAPHS: Readonly<Record<string, ReadonlyArray<string>>> = {
  きゃ: ["kya"],
  きゅ: ["kyu"],
  きょ: ["kyo"],
  ぎゃ: ["gya"],
  ぎゅ: ["gyu"],
  ぎょ: ["gyo"],
  しゃ: ["sha", "sya"],
  しゅ: ["shu", "syu"],
  しょ: ["sho", "syo"],
  じゃ: ["ja", "jya", "zya"],
  じゅ: ["ju", "jyu", "zyu"],
  じょ: ["jo", "jyo", "zyo"],
  ちゃ: ["cha", "tya"],
  ちゅ: ["chu", "tyu"],
  ちょ: ["cho", "tyo"],
  にゃ: ["nya"],
  にゅ: ["nyu"],
  にょ: ["nyo"],
  ひゃ: ["hya"],
  ひゅ: ["hyu"],
  ひょ: ["hyo"],
  びゃ: ["bya"],
  びゅ: ["byu"],
  びょ: ["byo"],
  ぴゃ: ["pya"],
  ぴゅ: ["pyu"],
  ぴょ: ["pyo"],
  みゃ: ["mya"],
  みゅ: ["myu"],
  みょ: ["myo"],
  りゃ: ["rya"],
  りゅ: ["ryu"],
  りょ: ["ryo"],
  てぃ: ["thi", "ti"],
  でぃ: ["dhi", "di"],
  ふぁ: ["fa"],
  ふぃ: ["fi"],
  ふぇ: ["fe"],
  ふぉ: ["fo"],
};

function unique(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)];
}

function nextUnit(reading: string, index: number): ReadonlyArray<string> {
  const pair = reading.slice(index, index + 2);
  return DIGRAPHS[pair] ?? KANA[reading[index] ?? ""] ?? [];
}

export function segmentReading(reading: string): ReadonlyArray<RomanSegment> {
  const segments: RomanSegment[] = [];
  for (let index = 0; index < reading.length; index += 1) {
    const char = reading[index] ?? "";
    if (/^[a-z0-9 ' -]$/i.test(char)) {
      segments.push([char.toLowerCase()]);
      continue;
    }
    const pair = reading.slice(index, index + 2);
    if (DIGRAPHS[pair]) {
      segments.push(DIGRAPHS[pair]);
      index += 1;
      continue;
    }
    if (char === "っ") {
      const following = nextUnit(reading, index + 1);
      const consonants = following
        .map((variant) => variant[0] ?? "")
        .filter((value) => value !== "" && !"aeioun".includes(value));
      segments.push(unique(consonants.length > 0 ? consonants : ["xtu", "ltu"]));
      continue;
    }
    if (char === "ん") {
      const following = nextUnit(reading, index + 1);
      const startsAmbiguously = following.some((variant) => /^[aiueoyn]/.test(variant));
      segments.push(index === reading.length - 1 || !startsAmbiguously ? ["n", "nn", "n'"] : ["nn", "n'"]);
      continue;
    }
    const variants = KANA[char];
    if (!variants) {
      throw new Error(`Unsupported reading character: ${char}`);
    }
    segments.push(variants);
  }
  return segments;
}

function keyOf(match: ActiveMatch): string {
  return `${match.segmentIndex}:${match.variant}:${match.offset}`;
}

function epsilonClose(
  segments: ReadonlyArray<RomanSegment>,
  matches: ReadonlyArray<ActiveMatch>,
): ReadonlyArray<ActiveMatch> {
  const result: ActiveMatch[] = [];
  const queue = [...matches];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const signature = keyOf(current);
    if (seen.has(signature)) continue;
    seen.add(signature);
    if (current.offset < current.variant.length) {
      result.push(current);
      continue;
    }
    const nextIndex = current.segmentIndex + 1;
    if (nextIndex >= segments.length) {
      result.push({ segmentIndex: segments.length, variant: "", offset: 0 });
      continue;
    }
    for (const variant of segments[nextIndex] ?? []) {
      queue.push({ segmentIndex: nextIndex, variant, offset: 0 });
    }
  }
  return result;
}

function initialMatches(segments: ReadonlyArray<RomanSegment>): ReadonlyArray<ActiveMatch> {
  if (segments.length === 0) return [{ segmentIndex: 0, variant: "", offset: 0 }];
  return (segments[0] ?? []).map((variant) => ({ segmentIndex: 0, variant, offset: 0 }));
}

function deriveBuffer(active: ReadonlyArray<ActiveMatch>): string {
  const first = active.find((match) => match.variant.length > 0);
  return first?.variant.slice(0, first.offset) ?? "";
}

export function createTypingState(reading: string): TypingState {
  const segments = segmentReading(reading);
  const active = epsilonClose(segments, initialMatches(segments));
  const completed = active.some((match) => match.segmentIndex === segments.length);
  return {
    reading,
    segments,
    active,
    input: "",
    readingIndex: completed ? reading.length : 0,
    romanBuffer: "",
    status: completed ? "complete" : "valid",
    completed,
  };
}

export function validateInput(reading: string, currentState: TypingState, key: string): TypingResult {
  const hasLongerMatch = currentState.active.some((match) => match.segmentIndex < currentState.segments.length);
  if (reading !== currentState.reading || (currentState.completed && !hasLongerMatch) || !/^[a-z0-9 ' -]$/i.test(key)) {
    return { accepted: false, completed: currentState.completed, nextState: currentState };
  }
  const normalized = key.toLowerCase();
  const consumed = currentState.active
    .filter((match) => match.segmentIndex < currentState.segments.length && match.variant[match.offset] === normalized)
    .map((match) => ({ ...match, offset: match.offset + 1 }));
  if (consumed.length === 0) {
    return { accepted: false, completed: false, nextState: currentState };
  }
  const active = epsilonClose(currentState.segments, consumed);
  const completed = active.some((match) => match.segmentIndex === currentState.segments.length);
  const readingIndex = completed ? reading.length : Math.max(0, Math.min(...active.map((match) => match.segmentIndex)));
  const nextState: TypingState = {
    ...currentState,
    active,
    input: `${currentState.input}${normalized}`,
    readingIndex,
    romanBuffer: deriveBuffer(active),
    status: completed ? "complete" : "valid",
    completed,
  };
  return { accepted: true, completed, nextState };
}

function canonicalRemainder(state: TypingState, match: ActiveMatch): string {
  const current = match.variant.slice(match.offset);
  const rest = state.segments
    .slice(match.segmentIndex + 1)
    .map((segment) => segment[0] ?? "")
    .join("");
  return `${current}${rest}`;
}

export function getTypingGuide(state: TypingState): TypingGuide {
  if (state.completed) return { typed: state.input, remaining: "", full: state.input };
  const candidates = state.active
    .filter((match) => match.segmentIndex < state.segments.length)
    .map((match) => canonicalRemainder(state, match))
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  const remaining = candidates[0] ?? "";
  return { typed: state.input, remaining, full: `${state.input}${remaining}` };
}
