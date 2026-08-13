export type MatchStatus = "valid" | "complete" | "invalid";

export type RomanSegment = ReadonlyArray<string>;

export type ActiveMatch = {
  segmentIndex: number;
  variant: string;
  offset: number;
};

export type TypingState = {
  reading: string;
  segments: ReadonlyArray<RomanSegment>;
  active: ReadonlyArray<ActiveMatch>;
  input: string;
  readingIndex: number;
  romanBuffer: string;
  status: MatchStatus;
  completed: boolean;
};

export type TypingResult = {
  accepted: boolean;
  completed: boolean;
  nextState: TypingState;
};

export type TypingGuide = {
  typed: string;
  remaining: string;
  full: string;
};
