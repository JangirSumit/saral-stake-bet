let gameSidebar,
  startBetButton,
  betAmountInput,
  profitInput,
  cashoutInput,
  lastCrashButton;
let statusCheckInterval;
let autoBetRunning = false;
let lastStatus = "";
let currentBet = null;

const POSSIBLE_BUTTON_TEXTS = ["Bet", "Starting...", "Bet (Next Round)"];

function initializeElements() {
  gameSidebar = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar"
  );
  startBetButton = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar > button"
  );
  betAmountInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='input-game-amount']"
  );
  profitInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='profit-input']"
  );
  const lastCrashes = document.querySelector(".past-bets");

  cashoutInput = [
    ...(gameSidebar?.querySelectorAll("label span[slot='label']") || []),
  ]
    .find((el) => el.textContent.trim() === "Cashout At")
    ?.closest("label")
    ?.querySelector("input");

  console.log("Elements found:", { gameSidebar, startBetButton, statusSpan, lastCrashes });

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 1 second...");
    setTimeout(initializeElements, 1000);
  } else {
    lastStatus = startBetButton?.textContent || "";
    statusCheckInterval = setInterval(checkButtonTextChange, 100);
    
    // Watch for new crash entries
    if (lastCrashes) {
      const crashObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            const newCrash = mutation.addedNodes[0];
            if (newCrash.nodeType === Node.ELEMENT_NODE) {
              const crashValue = newCrash.textContent;
              console.log('New crash detected:', crashValue);
              addCrashToHistory(crashValue);
            }
          }
        });
      });
      crashObserver.observe(lastCrashes, { childList: true });
    }
    
    console.log("Button text monitoring started automatically");
  }
}

function addCrashToHistory(crashValue) {
  const historyData = currentBet ? 
    { ...currentBet, crashValue } : 
    { betAmount: "0", cashoutAt: "0", crashValue, timestamp: new Date().toLocaleTimeString(), skipped: true };
  
  console.log('Sending history data:', historyData);
  chrome.runtime.sendMessage({
    action: "addHistory",
    data: historyData
  });
  currentBet = null;
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
    
    currentBet = {
      betAmount: amount,
      cashoutAt: cashout,
      timestamp: new Date().toLocaleTimeString()
    };
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
