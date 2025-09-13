let gameSidebar,
  startBetButton,
  betAmountInput,
  profitInput,
  cashoutInput,
  lastCrashes;
let autoBetRunning = false;
let lastStatus = "";
let currentBet = null;
let betConfig = {};
let crashHistory = [];
let consecutiveLowCrashes = 0;
let skipBetting = false;
let resumeTriggered = false;
let resumeNextRound = false;
let currentBetAmount = 0;
let ignorePreviousCrash = false;

const POSSIBLE_BUTTON_TEXTS = ["Bet", "Starting...", "Bet (Next Round)"];

function initializeElements() {
  fillProperties();

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 1 second...");
    setTimeout(initializeElements, 500);
  } else {
    betWatcher();
    crashWatcher();
  }
}

function crashWatcher() {
  if (lastCrashes) {
    const crashObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const newCrash = mutation.addedNodes[0];
          if (newCrash.nodeType === Node.ELEMENT_NODE) {
            const crashValue = newCrash.textContent?.trim();
            console.log("New crash detected:", crashValue);
            addCrashToHistory(crashValue);
          }
        }
      });
    });
    crashObserver.observe(lastCrashes, { childList: true });
  }
}

function betWatcher() {
  lastStatus = startBetButton?.textContent?.trim() || "";

  // Send initial button status
  chrome.runtime.sendMessage({
    action: "updateButtonStatus",
    data: { buttonText: lastStatus },
  });

  if (startBetButton && gameSidebar) {
    const buttonObserver = new MutationObserver(() => {
      const currentButton = gameSidebar.querySelector(":scope > button");
      const currentText = currentButton?.textContent?.trim() || "";

      if (currentText !== lastStatus) {
        console.log("Button text changed:", currentText);
        startBetButton = currentButton;

        chrome.runtime.sendMessage({
          action: "updateButtonStatus",
          data: { buttonText: currentText },
        });

        if (currentText === "Bet" && autoBetRunning) {
          console.log(
            "Button ready - currentBet:",
            !!currentBet,
            "skipBetting:",
            skipBetting,
            "consecutiveLowCrashes:",
            consecutiveLowCrashes
          );

          // Check if we should skip due to consecutive losses
          if (consecutiveLowCrashes >= betConfig.crashTimes) {
            skipBetting = true;
            console.log(
              `Pre-bet check: Skipping due to ${consecutiveLowCrashes} consecutive losses`
            );
          }

          if (!skipBetting) {
            placeBet();
          } else {
            console.log("Bet skipped due to consecutive low crashes");
            currentBet = null; // Ensure no bet is tracked
            // Notify bet skipped
            chrome.runtime.sendMessage({
              action: "showBetStatus",
              data: { type: "skipped", reason: "Consecutive low crashes" },
            });
          }
        }

        lastStatus = currentText;
      }
    });
    buttonObserver.observe(gameSidebar, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    console.log("Button text monitoring started automatically");
  }
}

function fillProperties() {
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
  lastCrashes = document.querySelector(".past-bets");

  cashoutInput = [
    ...(gameSidebar?.querySelectorAll("label span[slot='label']") || []),
  ]
    .find((el) => el.textContent.trim() === "Cashout At")
    ?.closest("label")
    ?.querySelector("input");

  console.log("Elements found:", { gameSidebar, startBetButton, lastCrashes });
}

function addCrashToHistory(crashValue) {
  // Handle win case (e.g., "3.68× 2.50×")
  const isWin = crashValue.includes("×") && crashValue.split("×").length > 2;
  const crash = parseFloat(crashValue);
  crashHistory.unshift(crash);

  // Keep only latest 50 crashes to prevent UI performance issues
  if (crashHistory.length > 10) {
    crashHistory = crashHistory.slice(0, 10);
  }

  // Ignore the first crash after starting auto betting
  if (ignorePreviousCrash) {
    console.log("Ignoring previous crash:", crash);
    ignorePreviousCrash = false;
    return;
  }

  // Always process stop/resume logic when auto betting is running
  if (autoBetRunning) {
    handleStopResumeLogic(crash);

    // Only adjust bet amounts if we actually had a bet placed
    if (currentBet) {
      adjustBetAmountBasedOnResult(crash);
    }
  }

  console.log("Crash history updated:", crashHistory);
  console.log("Current bet:", currentBet);

  const historyData = currentBet
    ? { ...currentBet, crashValue, isWin }
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

function adjustBetAmountBasedOnResult(crash) {
  const { onWin, onLoss } = betConfig;
  const oldAmount = currentBetAmount;

  if (crash >= parseFloat(currentBet.cashoutAt)) {
    // Won - adjust by onWin % (typically negative to decrease bet)
    currentBetAmount = adjustBetAmount(currentBetAmount, -Math.abs(onWin));
    console.log(
      `WON: ${oldAmount} -> ${currentBetAmount} (${onWin}% decrease)`
    );
  } else {
    // Lost - adjust by onLoss % (typically positive to increase bet)
    currentBetAmount = adjustBetAmount(currentBetAmount, Math.abs(onLoss));
    console.log(
      `LOST: ${oldAmount} -> ${currentBetAmount} (${onLoss}% increase)`
    );
  }
}

function handleStopResumeLogic(crash) {
  const { crashAt, crashTimes, resumeAt } = betConfig;

  console.log(
    `Crash: ${crash}, skipBetting: ${skipBetting}, consecutiveLowCrashes: ${consecutiveLowCrashes}, currentBet: ${!!currentBet}`
  );

  // Resume betting immediately when any crash crosses resumeAt threshold (check all crashes during skip)
  if (skipBetting && crash >= resumeAt) {
    console.log(`Resume triggered! Crash ${crash} >= resumeAt ${resumeAt}`);
    skipBetting = false;
    consecutiveLowCrashes = 0;
    return;
  }

  // Count consecutive bet losses on low crashes (crash <= crashAt) - only when we had a bet
  if (currentBet) {
    if (crash < parseFloat(currentBet.cashoutAt)) {
      // Bet lost - check if it's a low crash
      if (crash <= crashAt) {
        consecutiveLowCrashes++;
        console.log(
          `Low crash bet loss detected. Count: ${consecutiveLowCrashes}`
        );

        // Skip betting if reached crashTimes
        if (consecutiveLowCrashes >= crashTimes) {
          console.log(
            `Will skip betting after ${consecutiveLowCrashes} consecutive low crash losses`
          );
          skipBetting = true;
        }
      } else {
        // High crash loss - reset counter
        consecutiveLowCrashes = 0;
        console.log(`High crash loss - reset consecutive count`);
      }
    } else {
      // Bet won - reset counter
      consecutiveLowCrashes = 0;
      console.log(`Bet won - reset consecutive loss count`);
    }
  }
}

function setInputValue(input, value) {
  if (!input) return;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

function adjustBetAmount(amount, percentage) {
  const percent = parseFloat(percentage) || 0;
  const multiplier = 1 + percent / 100;
  return (amount * multiplier).toFixed(2);
}

function placeBet() {
  if (betAmountInput && cashoutInput) {
    console.log(`Setting bet amount to: ${currentBetAmount}`);

    // Clear and set values with small delays
    betAmountInput.value = "";
    setTimeout(() => {
      setInputValue(betAmountInput, currentBetAmount);
      setTimeout(() => {
        setInputValue(cashoutInput, betConfig.cashout);

        currentBet = {
          betAmount: currentBetAmount,
          cashoutAt: betConfig.cashout,
          timestamp: new Date().toLocaleTimeString(),
        };

        // Click bet button
        console.log("Placing bet:", currentBet);
        startBetButton?.click();

        // Notify bet placed and update current amount
        chrome.runtime.sendMessage({
          action: "showBetStatus",
          data: {
            type: "placed",
            amount: currentBetAmount,
            cashout: betConfig.cashout,
          },
        });

        // Update current bet amount display
        chrome.runtime.sendMessage({
          action: "updateCurrentBetAmount",
          data: { amount: currentBetAmount },
        });
      }, 50);
    }, 50);
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
    const {
      amount,
      cashout,
      stopCrashAt,
      stopCrashTimes,
      loss,
      win,
      resumeAt,
    } = message.data;

    betConfig = {
      amount: parseFloat(amount),
      cashout: parseFloat(cashout),
      crashAt: parseFloat(stopCrashAt),
      crashTimes: parseInt(stopCrashTimes),
      onLoss: parseFloat(loss),
      onWin: parseFloat(win),
      resumeAt: parseFloat(resumeAt),
    };

    currentBetAmount = betConfig.amount;

    setInputValue(betAmountInput, amount);
    setInputValue(cashoutInput, cashout);
  }

  if (message.action === "startAutoBet") {
    autoBetRunning = true;
    consecutiveLowCrashes = 0;
    skipBetting = false;
    ignorePreviousCrash = true;
    console.log("Auto-betting started - will ignore next crash");
  }

  if (message.action === "stopAutoBet") {
    autoBetRunning = false;
    skipBetting = false;
    console.log("Auto-betting stopped");
  }

  if (message.action === "resetBetAmount") {
    const { resetBetAmount } = message.data;
    currentBetAmount = parseFloat(resetBetAmount);
    crashHistory = [];
    consecutiveLowCrashes = 0;
    skipBetting = false;
    resumeTriggered = false;
    resumeNextRound = false;
    currentBetAmount = 0;
    ignorePreviousCrash = false;
    console.log(`Bet amount reset to: ${currentBetAmount}`);

    // Update current bet amount display
    chrome.runtime.sendMessage({
      action: "updateCurrentBetAmount",
      data: { amount: currentBetAmount },
    });
  }
});
