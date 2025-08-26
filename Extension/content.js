let gameSidebar,
  startBetButton,
  statusSpan,
  betAmountInput,
  profitInput,
  cashoutInput;
let statusCheckInterval;
let autoBetRunning = false;
let lastStatus = "";

const POSSIBLE_BUTTON_TEXTS = ["Bet", "Starting...", "Bet (Next Round)"];

function initializeElements() {
  gameSidebar = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar"
  );
  startBetButton = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar > button"
  );
  statusSpan = startBetButton?.querySelector("span");
  betAmountInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='input-game-amount']"
  );
  profitInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='profit-input']"
  );
  cashoutInput = [
    ...(gameSidebar?.querySelectorAll("label span[slot='label']") || []),
  ]
    .find((el) => el.textContent.trim() === "Cashout At")
    ?.closest("label")
    ?.querySelector("input");

  console.log("Elements found:", { gameSidebar, startBetButton, statusSpan });

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 1 second...");
    setTimeout(initializeElements, 1000);
  } else {
    lastStatus = startBetButton?.textContent || "";
    statusCheckInterval = setInterval(checkButtonTextChange, 100);
    console.log("Button text monitoring started automatically");
  }
}

function checkButtonTextChange() {
  if (startBetButton) {
    const currentText = startBetButton.textContent;
    if (currentText !== lastStatus) {
      console.log("Button text changed:", currentText);
      lastStatus = currentText;
    }
  }
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeElements);
} else {
  initializeElements();
  console.log("Document already loaded, elements initialized.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fillBetData") {
    const { amount, cashout } = message.data;

    if (betAmountInput && amount) {
      betAmountInput.value = amount;
      betAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
      betAmountInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (cashoutInput && cashout) {
      cashoutInput.value = cashout;
      cashoutInput.dispatchEvent(new Event("input", { bubbles: true }));
      cashoutInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  if (message.action === "startAutoBet") {
    autoBetRunning = true;
    console.log("Auto-betting started");
  }

  if (message.action === "stopAutoBet") {
    autoBetRunning = false;
    console.log("Auto-betting stopped");
  }
});
