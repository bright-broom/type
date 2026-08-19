import type { AssessmentAttempt, AssessmentAttemptEvent } from "./assessment-attempt.ts";

export function assessmentAttemptTransition(
  state: AssessmentAttempt,
  event: AssessmentAttemptEvent,
): AssessmentAttempt {
  if (state.status !== "active") return state;
  if (state.deadlineAt !== null && event.now >= state.deadlineAt) {
    return { ...state, status: "expired", completedAt: state.deadlineAt };
  }
  switch (event.type) {
    case "ANSWER":
      if (!state.questionIds.includes(event.questionId)) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [event.questionId]: {
            questionId: event.questionId,
            choiceId: event.choiceId,
            answeredAt: event.now,
          },
        },
      };
    case "NAVIGATE":
      return event.index < 0 || event.index >= state.questionIds.length
        ? state
        : { ...state, currentIndex: event.index };
    case "TOGGLE_FLAG": {
      if (!state.questionIds.includes(event.questionId)) return state;
      const flagged = state.flaggedQuestionIds.includes(event.questionId);
      return {
        ...state,
        flaggedQuestionIds: flagged
          ? state.flaggedQuestionIds.filter((id) => id !== event.questionId)
          : [...state.flaggedQuestionIds, event.questionId],
      };
    }
    case "SUBMIT":
      return { ...state, status: "submitted", completedAt: event.now };
    case "TICK":
      return state;
    case "ABANDON":
      return { ...state, status: "abandoned", completedAt: event.now };
  }
}
