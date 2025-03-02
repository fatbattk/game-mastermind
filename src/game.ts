// Import styles
import "./assets/style.scss";

import * as bootstrap from "bootstrap";
import * as Tone from "tone";
import { ColorEmoji, FeedbackResult, GameRun } from "./types";
import * as Storage from "./storage";

class MastermindGame {
  private readonly colors: ColorEmoji[] = [
    "⚪",
    "🔴",
    "🔵",
    "🟢",
    "🟡",
    "🟠",
    "🟤",
    "⚫",
  ];
  private readonly codeLength = 4;
  private readonly maxAttempts = 10;
  private currentAttempt = 0;
  private selectedColor: ColorEmoji | null = null;
  private currentGuess = new Array<ColorEmoji | null>(4).fill(null);
  private secretCode: ColorEmoji[] = [];
  private gameBoard: HTMLElement;
  private startTime: number | null = null;
  private timerInterval: number | null = null;
  private synth: Tone.Synth;
  private gameEnded = false;
  private lastNoteTime = 0;
  private readonly minNoteInterval = 0.1; // minimum time between notes in seconds

  constructor(id: string) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id ${id} not found`);
    }
    this.gameBoard = element;
    this.synth = new Tone.Synth().toDestination();

    this.initializeGame();
    this.setupEventListeners();
    this.updateButtonStates();
  }

  private showAnswer(): void {
    const row = document.createElement("div");
    row.className = "game-row answer-row";

    const pegsContainer = document.createElement("div");
    pegsContainer.className = "d-flex gap-2";

    for (let i = 0; i < this.codeLength; i++) {
      const peg = document.createElement("div");
      peg.className = "peg";
      peg.textContent = this.secretCode[i];
      pegsContainer.appendChild(peg);
    }

    const label = document.createElement("div");
    label.className = "answer-label";
    label.textContent = "Answer";

    row.appendChild(pegsContainer);
    row.appendChild(label);
    this.gameBoard.appendChild(row);

    // Hide color selector when answer is shown
    const colorPicker = document.getElementById("color-picker");
    if (colorPicker) {
      colorPicker.classList.add("d-none");
    }
  }

  private saveRun(score: number, time: number): void {
    const newRun: GameRun = {
      score,
      attempts: this.currentAttempt + 1,
      time,
      date: new Date().toISOString(),
    };

    Storage.saveGameRun(newRun);
    this.updateRunsList();
  }

  private updateRunsList(): void {
    const runsList = document.getElementById("game-runs-list");
    if (!runsList) return;

    const runs = Storage.getGameRuns();

    // Find the highest score
    const highestScore = Math.max(...runs.map((run) => run.score));

    runsList.innerHTML = runs
      .map(
        (run, index) => `
          <div class="d-flex justify-content-between border-bottom py-2">
            <span>${String(index + 1)}</span>
            <span>${String(run.score)} pts${
          run.score === highestScore ? "⭐" : ""
        }</span>
            <span>${String(run.attempts)} tries</span>
            <span>${String(Math.floor(run.time))}s</span>
          </div>
        `
      )
      .join("");
  }

  private updateButtonStates(): void {
    const checkButton = document.getElementById(
      "check-btn"
    ) as HTMLButtonElement;
    const clearButton = document.getElementById(
      "clear-row-btn"
    ) as HTMLButtonElement;

    const isRowEmpty = this.currentGuess.every((color) => color === null);
    const isRowFull = this.currentGuess.every((color) => color !== null);

    checkButton.disabled = !isRowFull || this.gameEnded;
    clearButton.disabled = (isRowEmpty && !isRowFull) || this.gameEnded;
  }

  private initializeGame(): void {
    this.secretCode = Array.from(
      { length: this.codeLength },
      () => this.colors[Math.floor(Math.random() * this.colors.length)]
    );
    this.gameBoard.innerHTML = "";
    this.currentAttempt = 0;
    this.currentGuess = new Array<ColorEmoji | null>(this.codeLength).fill(
      null
    );
    this.gameEnded = false;

    // Show color selector when game starts
    const colorPicker = document.getElementById("color-picker");
    if (colorPicker) {
      colorPicker.classList.remove("d-none");
    }

    for (let i = this.maxAttempts - 1; i >= 0; i--) {
      this.createGameRow(i);
    }

    this.startTimer();
    this.showInstructions();
    this.updateRunsList();
    this.updateButtonStates();
  }

  private createGameRow(rowIndex: number): void {
    const row = document.createElement("div");
    row.className = `game-row ${rowIndex === 0 ? "current-row" : ""}`;
    row.id = `row-${String(rowIndex)}`;

    const pegsContainer = document.createElement("div");
    pegsContainer.className = "d-flex gap-2";

    for (let i = 0; i < this.codeLength; i++) {
      const peg = document.createElement("div");
      peg.className = "peg";
      peg.dataset.position = i.toString();
      if (rowIndex === 0) {
        peg.addEventListener("click", (e: MouseEvent) => {
          const target = e.currentTarget as HTMLElement;
          this.handlePegClick(target);
        });
      }
      pegsContainer.appendChild(peg);
    }

    const feedback = document.createElement("div");
    feedback.className = "feedback";
    for (let i = 0; i < this.codeLength; i++) {
      const feedbackPeg = document.createElement("div");
      feedbackPeg.className = "feedback-peg";
      feedback.appendChild(feedbackPeg);
    }

    row.appendChild(pegsContainer);
    row.appendChild(feedback);
    this.gameBoard.appendChild(row);
  }

  private setupEventListeners(): void {
    document.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.gameEnded) return;
        document.querySelectorAll(".color-btn").forEach((b) => {
          b.classList.remove("selected");
        });
        const button = btn as HTMLElement;
        button.classList.add("selected");
        this.selectedColor = button.dataset.color as ColorEmoji;
        this.playNote("C4");
        this.fillFirstEmptyPeg();
      });
    });

    const checkButton = document.getElementById("check-btn");
    if (checkButton) {
      checkButton.addEventListener("click", () => {
        if (!this.gameEnded) {
          this.checkGuess();
        }
      });
    }

    const newGameButton = document.getElementById("new-game-btn");
    if (newGameButton) {
      newGameButton.addEventListener("click", () => {
        if (!this.gameEnded && this.currentAttempt > 0) {
          const modalElement = document.getElementById("newGameModal");
          if (modalElement) {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
            bsModal.show();
          }
        } else {
          this.initializeGame();
        }
      });
    }

    const confirmNewGameButton = document.getElementById("confirm-new-game");
    if (confirmNewGameButton) {
      confirmNewGameButton.addEventListener("click", () => {
        const modalElement = document.getElementById("newGameModal");
        if (modalElement) {
          const bsModal = bootstrap.Modal.getInstance(modalElement);
          if (bsModal) {
            bsModal.hide();
            this.initializeGame();
          }
        }
      });
    }

    const clearRowButton = document.getElementById("clear-row-btn");
    if (clearRowButton) {
      clearRowButton.addEventListener("click", () => {
        if (!this.gameEnded) {
          this.clearCurrentRow();
        }
      });
    }

    const helpButton = document.getElementById("help-btn");
    if (helpButton) {
      helpButton.addEventListener("click", () => {
        const modalElement = document.getElementById("instructionsModal");
        if (modalElement) {
          const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
          bsModal.show();
        }
      });
    }
  }

  private clearCurrentRow(): void {
    const currentRow = document.querySelector(".current-row");
    if (!currentRow) return;

    const currentRowPegs = currentRow.querySelectorAll(".peg");
    currentRowPegs.forEach((peg) => {
      (peg as HTMLElement).textContent = "";
    });

    this.currentGuess = new Array<ColorEmoji | null>(this.codeLength).fill(
      null
    );
    this.playNote("D4");
    this.updateButtonStates();
  }

  private fillFirstEmptyPeg(): void {
    const currentRow = document.querySelector(".current-row");
    if (!currentRow) return;

    const currentRowPegs = currentRow.querySelectorAll(".peg");
    for (let i = 0; i < this.codeLength; i++) {
      if (!currentRowPegs[i].textContent) {
        this.placePeg(currentRowPegs[i] as HTMLElement);
        break;
      }
    }
  }

  private handlePegClick = (peg: HTMLElement): void => {
    if (!peg.closest(".current-row") || this.gameEnded) return;

    if (peg.textContent) {
      peg.textContent = "";
      const position = parseInt(peg.dataset.position ?? "0");
      this.currentGuess[position] = null;
      this.playNote("D4");
    } else if (this.selectedColor) {
      this.placePeg(peg);
    }
    this.updateButtonStates();
  };

  private placePeg(peg: HTMLElement): void {
    if (!peg.closest(".current-row") || this.gameEnded) return;

    const position = parseInt(peg.dataset.position ?? "0");
    this.currentGuess[position] = this.selectedColor;
    peg.textContent = this.selectedColor ?? "";
    this.playNote("E4");
    this.updateButtonStates();
  }

  private checkGuess(): void {
    if (this.currentGuess.includes(null)) {
      alert("Please fill all positions before checking!");
      return;
    }

    const feedback = this.calculateFeedback(this.currentGuess);
    this.displayFeedback(feedback);

    if (feedback.exact === this.codeLength) {
      this.handleWin();
    } else if (this.currentAttempt === this.maxAttempts - 1) {
      this.handleLoss();
    } else {
      this.moveToNextRow();
    }
  }

  private calculateFeedback(guess: (ColorEmoji | null)[]): FeedbackResult {
    const feedback: FeedbackResult = {
      exact: 0,
      partial: 0,
    };

    const secretCodeCopy = [...this.secretCode];
    const guessCopy = [...guess] as ColorEmoji[];

    // First pass: check for exact matches
    for (let i = 0; i < this.codeLength; i++) {
      if (guessCopy[i] === secretCodeCopy[i]) {
        feedback.exact++;
        secretCodeCopy[i] = null as unknown as ColorEmoji;
        guessCopy[i] = null as unknown as ColorEmoji;
      }
    }

    // Second pass: check for partial matches
    for (let i = 0; i < this.codeLength; i++) {
      const currentGuess = guessCopy[i];
      if (currentGuess !== null) {
        const index = secretCodeCopy.indexOf(currentGuess);
        if (index !== -1) {
          feedback.partial++;
          secretCodeCopy[index] = null as unknown as ColorEmoji;
        }
      }
    }

    return feedback;
  }

  private displayFeedback({ exact, partial }: FeedbackResult): void {
    const currentRow = document.querySelector(".current-row");
    if (!currentRow) return;

    const feedbackPegs = currentRow.querySelectorAll(".feedback-peg");
    let pegIndex = 0;

    for (let i = 0; i < exact; i++) {
      feedbackPegs[pegIndex].className = "feedback-peg feedback-black";
      pegIndex++;
    }

    for (let i = 0; i < partial; i++) {
      feedbackPegs[pegIndex].className = "feedback-peg feedback-white";
      pegIndex++;
    }
  }

  private moveToNextRow(): void {
    const currentRow = document.querySelector(".current-row");
    if (!currentRow) return;

    currentRow.classList.remove("current-row");
    currentRow.querySelectorAll(".peg").forEach((peg) => {
      const pegElement = peg as HTMLElement;
      pegElement.removeEventListener("click", () => {
        this.handlePegClick(pegElement);
      });
      pegElement.style.cursor = "default";
    });

    this.currentAttempt++;
    this.currentGuess = new Array<ColorEmoji | null>(this.codeLength).fill(
      null
    );

    const nextRow = document.getElementById(
      `row-${String(this.currentAttempt)}`
    );
    if (!nextRow) return;

    nextRow.classList.add("current-row");
    nextRow.querySelectorAll(".peg").forEach((peg) => {
      const pegElement = peg as HTMLElement;
      pegElement.addEventListener("click", () => {
        this.handlePegClick(pegElement);
      });
    });
    this.updateButtonStates();
  }

  private showResultModal(won: boolean): void {
    const modalTitle = won ? "Congratulations!" : "Game Over";
    const timeElapsed = Math.floor((Date.now() - (this.startTime ?? 0)) / 1000);
    const modalContent = won
      ? `You won in ${String(this.currentAttempt + 1)} attempts and ${String(
          timeElapsed
        )} seconds!`
      : `Game Over! The correct code was: ${this.secretCode.join(" ")}`;

    const modalLabelElement = document.getElementById("resultModalLabel");
    const modalContentElement = document.getElementById("resultModalContent");
    const modalElement = document.getElementById("resultModal");

    if (modalLabelElement) modalLabelElement.textContent = modalTitle;
    if (modalContentElement) modalContentElement.textContent = modalContent;
    if (modalElement) {
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
      bsModal.show();
    }
  }

  private handleWin(): void {
    this.gameEnded = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    const timeElapsed = Math.floor((Date.now() - (this.startTime ?? 0)) / 1000);
    const score = this.calculateScore(timeElapsed);
    this.saveRun(score, timeElapsed);
    this.playWinSound();
    this.showAnswer();
    this.showResultModal(true);
    this.updateButtonStates();
  }

  private handleLoss(): void {
    this.gameEnded = true;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.playLoseSound();
    this.showAnswer();
    this.showResultModal(false);
    this.updateButtonStates();
  }

  private startTimer(): void {
    this.startTime = Date.now();
    const timerElement = document.getElementById("timer");

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (!timerElement) return;

      const elapsed = Math.floor((Date.now() - (this.startTime ?? 0)) / 1000);
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const seconds = String(elapsed % 60).padStart(2, "0");
      timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
  }

  private calculateScore(timeElapsed: number): number {
    const baseScore = 1000;
    const timeDeduction = Math.floor(timeElapsed / 10);
    const attemptsDeduction = this.currentAttempt * 50;
    return Math.max(0, baseScore - timeDeduction - attemptsDeduction);
  }

  private playNote(note: string): void {
    const now = Tone.now();
    if (now - this.lastNoteTime >= this.minNoteInterval) {
      this.synth.triggerAttackRelease(note, "0.1", now);
      this.lastNoteTime = now;
    }
  }

  private playWinSound(): void {
    const now = Tone.now();
    if (now - this.lastNoteTime >= this.minNoteInterval) {
      this.synth.triggerAttackRelease("C4", "0.1", now + 0.1);
      this.synth.triggerAttackRelease("E4", "0.1", now + 0.2);
      this.synth.triggerAttackRelease("G4", "0.1", now + 0.3);
      this.synth.triggerAttackRelease("C5", "0.2", now + 0.4);
      this.lastNoteTime = now;
    }
  }

  private playLoseSound(): void {
    const now = Tone.now();
    if (now - this.lastNoteTime >= this.minNoteInterval) {
      this.synth.triggerAttackRelease("C4", "0.2", now + 0.1);
      this.synth.triggerAttackRelease("G3", "0.2", now + 0.3);
      this.synth.triggerAttackRelease("C3", "0.3", now + 0.5);
      this.lastNoteTime = now;
    }
  }

  private showInstructions(): void {
    if (!Storage.hasSeenInstructions()) {
      const modalElement = document.getElementById("instructionsModal");
      if (modalElement) {
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalElement);
        bsModal.show();
        Storage.markInstructionsAsSeen();
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new MastermindGame("game-board");
});
