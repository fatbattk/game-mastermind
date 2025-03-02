import { GameRun } from "./types";

const STORAGE_KEY = "mastermindRuns";

export function saveGameRun(run: GameRun): void {
  try {
    const runs = getGameRuns();
    runs.unshift(run); // Add to beginning for newest first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (error) {
    console.error("Error saving game runs:", error);
  }
}

export function getGameRuns(): GameRun[] {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY) ?? "[]";
    return JSON.parse(storedData) as GameRun[];
  } catch (error) {
    console.error("Error getting game runs:", error);
    return [];
  }
}

export function hasSeenInstructions(): boolean {
  return localStorage.getItem("instructionsShown") === "true";
}

export function markInstructionsAsSeen(): void {
  localStorage.setItem("instructionsShown", "true");
}
