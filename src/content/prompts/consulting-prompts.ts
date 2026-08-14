import consultingPromptsJson from "../generated/consulting-prompts.json" with { type: "json" };
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";

export const CONSULTING_PROMPTS = consultingPromptsJson as ReadonlyArray<TypingPrompt>;
