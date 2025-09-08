let gameSidebar, startBetButton, betAmountInput, profitInput, cashoutInput;
let autoBetRunning = false;
let lastStatus = "";
let currentBet = null;
let betConfig = {};
let crashHistory = [];
let consecutiveLowCrashes = 0;
let skipBetting = false;
let currentBetAmount = 0;

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

  console.log("Elements found:", { gameSidebar, startBetButton, lastCrashes });

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 1 second...");
    setTimeout(initializeElements, 1000);
  } else {
    lastStatus = startBetButton?.textContent || "";

    // Watch for button text changes
    if (startBetButton) {
      const buttonObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "childList" ||
            mutation.type === "characterData"
          ) {
            const currentText = startBetButton.textContent.trim();
            if (currentText !== lastStatus) {
              console.log("Button text changed:", currentText);

              // Send button status to sidepanel
              console.log("Sending button status:", currentText);
              chrome.runtime.sendMessage({
                action: "updateButtonStatus",
                data: { buttonText: currentText },
              });

              // When button shows 'Bet', new round is ready
              if (currentText === "Bet" && autoBetRunning && !skipBetting) {
                placeBet();
              }

              lastStatus = currentText;
            }
          }
        });
      });
      buttonObserver.observe(startBetButton, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // Watch for new crash entries
    if (lastCrashes) {
      const crashObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            const newCrash = mutation.addedNodes[0];
            if (newCrash.nodeType === Node.ELEMENT_NODE) {
              const crashValue = newCrash.textContent;
              console.log("New crash detected:", crashValue);
              addCrashToHistory(crashValue);
            }
          }
        });
      });
      crashObserver.observe(lastCrashes, { childList: true });
    }

    // Send initial button status
    chrome.runtime.sendMessage({
      action: "updateButtonStatus",
      data: { buttonText: lastStatus },
    });
    
    console.log("Button text monitoring started automatically");
  }
}

function addCrashToHistory(crashValue) {
  const crash = parseFloat(crashValue);
  crashHistory.unshift(crash);

  // Check crash patterns and adjust betting
  if (autoBetRunning) {
    handleAutoBetting(crash);
  }

  const historyData = currentBet
    ? { ...currentBet, crashValue }
    : {
        betAmount: "0",
        cashoutAt: "0",
        crashValue,
        timestamp: new Date().toLocaleTimeString(),
        skipped: true,
      };

  chrome.runtime.sendMessage({
    action: "addHistory",
    data: historyData,
  });
  currentBet = null;
}

function handleAutoBetting(crash) {
  const { crashAt, crashTimes, onWin, onLoss, resumeAt } = betConfig;

  // Track consecutive low crashes
  if (crash < crashAt) {
    consecutiveLowCrashes++;
  } else {
    consecutiveLowCrashes = 0;
    skipBetting = false;
  }

  // Skip betting if too many consecutive low crashes
  if (consecutiveLowCrashes >= crashTimes) {
    skipBetting = true;
  }

  // Resume betting if crash crosses resumeAt threshold
  if (skipBetting && crash >= resumeAt) {
    skipBetting = false;
    consecutiveLowCrashes = 0;
  }

  // Adjust bet amount based on result
  if (currentBet) {
    if (crash >= parseFloat(currentBet.cashoutAt)) {
      // Won - adjust by onWin %
      currentBetAmount = adjustBetAmount(currentBetAmount, onWin);
    } else {
      // Lost - adjust by onLoss %
      currentBetAmount = adjustBetAmount(currentBetAmount, onLoss);
    }
  }

  // Betting will be triggered when button text changes to 'Bet'
}

function adjustBetAmount(amount, percentage) {
  const percent = parseFloat(percentage) || 0;
  const multiplier = 1 + percent / 100;
  return (amount * multiplier).toFixed(2);
}

function placeBet() {
  if (betAmountInput && cashoutInput) {
    betAmountInput.value = currentBetAmount;
    cashoutInput.value = betConfig.cashout;

    betAmountInput.dispatchEvent(new Event("input", { bubbles: true }));
    cashoutInput.dispatchEvent(new Event("input", { bubbles: true }));

    currentBet = {
      betAmount: currentBetAmount,
      cashoutAt: betConfig.cashout,
      timestamp: new Date().toLocaleTimeString(),
    };

    // Click bet button
    console.log("Placing bet:", currentBet);
    startBetButton?.click();
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
    const { amount, cashout, stopCrashAt, stopCrashTimes, loss, win, resumeAt } =
      message.data;

    betConfig = {
      amount: parseFloat(amount),
      cashout: parseFloat(cashout),
      crashAt: parseFloat(stopCrashAt),
      crashTimes: parseInt(stopCrashTimes),
      onLoss: loss,
      onWin: win,
      resumeAt: parseFloat(resumeAt),
    };

    currentBetAmount = betConfig.amount;

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
    consecutiveLowCrashes = 0;
    skipBetting = false;
    console.log("Auto-betting started");
  }

  if (message.action === "stopAutoBet") {
    autoBetRunning = false;
    skipBetting = false;
    console.log("Auto-betting stopped");
  }
});
