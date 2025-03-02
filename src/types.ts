export interface GameRun {
  score: number;
  attempts: number;
  time: number;
  date: string;
}

export type ColorEmoji = "⚪" | "🔴" | "🔵" | "🟢" | "🟡" | "🟠" | "🟤" | "⚫";

export interface FeedbackResult {
  exact: number;
  partial: number;
}
