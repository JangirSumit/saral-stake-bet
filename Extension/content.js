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
let consecutiveHighCrashes = 0;
let consecutiveResumeBelowCrashes = 0;
let skipBetting = false;
let resumeTriggered = false;
let resumeNextRound = false;
let currentBetAmount = 0;
let originalBetAmount = 0;
let lastBetAmount = 0;
let totalProfit = 0;
let sessionStartTime = null;
let superTotalProfit = 0;
let superTotalLoss = 0;
let superTotalBets = 0;
let subSessionResets = 0;
let subSessionLossDetails = [];
let totalRefreshes = 0;
let refreshDetails = [];
let refreshInProgress = false;
let ignorePreviousCrash = false;
let walletObserver = null;
let currentWalletBalance = 0;
let currentCurrency = "$";
let initialWalletBalance = 0;
let walletProtectionTriggered = false;

// Console log recording
let consoleLogs = [];
const originalConsoleLog = console.log;
console.log = function (...args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  consoleLogs.push(`[${timestamp}] ${message}`);
  originalConsoleLog.apply(console, args);
};

const POSSIBLE_BUTTON_TEXTS = ["Bet", "Starting...", "Bet (Next Round)"];

function saveState() {
  const state = {
    autoBetRunning,
    betConfig,
    currentBetAmount,
    originalBetAmount,
    lastBetAmount,
    totalProfit,
    consecutiveLowCrashes,
    consecutiveHighCrashes,
    consecutiveResumeBelowCrashes,
    skipBetting,
    superTotalProfit,
    superTotalLoss,
    superTotalBets,
    subSessionResets,
    subSessionLossDetails,
    totalRefreshes,
    refreshDetails,
    consoleLogs: consoleLogs.slice(-100), // Save last 100 console logs
    sessionStartTime: sessionStartTime?.getTime(),
    refreshedFromDisabled: true,
  };
  localStorage.setItem("autoBetState", JSON.stringify(state));
}

function restoreState() {
  const savedState = localStorage.getItem("autoBetState");
  if (savedState) {
    const state = JSON.parse(savedState);
    if (state.refreshedFromDisabled) {
      autoBetRunning = state.autoBetRunning;
      betConfig = state.betConfig || {};
      currentBetAmount = state.currentBetAmount || 0;
      originalBetAmount = state.originalBetAmount || 0;
      lastBetAmount = state.lastBetAmount || 0;
      totalProfit = state.totalProfit || 0;
      consecutiveLowCrashes = state.consecutiveLowCrashes || 0;
      consecutiveHighCrashes = state.consecutiveHighCrashes || 0;
      consecutiveResumeBelowCrashes = state.consecutiveResumeBelowCrashes || 0;
      skipBetting = state.skipBetting || false;
      superTotalProfit = state.superTotalProfit || 0;
      superTotalLoss = state.superTotalLoss || 0;
      superTotalBets = state.superTotalBets || 0;
      subSessionResets = state.subSessionResets || 0;
      subSessionLossDetails = state.subSessionLossDetails || [];
      totalRefreshes = state.totalRefreshes || 0;
      refreshDetails = state.refreshDetails || [];
      if (state.consoleLogs) {
        consoleLogs = [...consoleLogs, ...state.consoleLogs];
      }
      if (state.sessionStartTime) {
        sessionStartTime = new Date(state.sessionStartTime);
      }
      console.log("State restored after disabled button refresh");
      localStorage.removeItem("autoBetState");
      return true;
    }
  }
  return false;
}

function initializeElements() {
  // Reset refresh flag on initialization
  refreshInProgress = false;

  fillProperties();

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 500ms...");
    setTimeout(initializeElements, 500);
  } else {
    console.log("Elements ready, initializing watchers");
    const wasRestored = restoreState();

    // Add small delay to ensure DOM is stable
    setTimeout(() => {
      betWatcher();
      crashWatcher();
      walletWatcher();

      if (wasRestored && autoBetRunning) {
        chrome.runtime.sendMessage({
          action: "sessionRestored",
          data: {
            startTime: sessionStartTime,
            currentBetAmount,
            skipBetting,
          },
        });

        // Send refresh data after restoration
        chrome.runtime.sendMessage({
          action: "updateRefreshData",
          data: {
            refreshes: totalRefreshes,
            refreshDetails: refreshDetails,
          },
        });
      }
    }, 200);
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
      const currentButton = gameSidebar.querySelector(
        "[data-testid='bet-button']"
      );
      const currentText = currentButton?.textContent?.trim() || "Cashout";

      if (currentText !== lastStatus) {
        console.log("Button text changed:", currentText);
        startBetButton = currentButton;

        // Update input references when button changes
        fillProperties();

        chrome.runtime.sendMessage({
          action: "updateButtonStatus",
          data: { buttonText: currentText },
        });

        if (currentText === "Bet" && autoBetRunning) {
          // Check if button is disabled and prevent multiple refreshes
          if (
            (currentButton?.disabled ||
              currentButton?.getAttribute("data-test-action-enabled") ===
                "false") &&
            !refreshInProgress
          ) {
            // Check if bet amount input has invalid class (zero balance scenario)
            if (betAmountInput?.classList.contains("invalid")) {
              console.log(
                "Bet amount input invalid (zero balance) - skipping refresh"
              );
            } else {
              console.log(
                "Bet button is disabled - saving state and refreshing page"
              );
              refreshInProgress = true;

              // Track refresh
              totalRefreshes++;
              const refreshInfo = {
                refreshNumber: totalRefreshes,
                timestamp: new Date().toLocaleTimeString(),
                reason: "Bet button disabled",
                snapshot: {
                  superProfit: superTotalProfit,
                  superLoss: superTotalLoss,
                  superBets: superTotalBets,
                  currentBetAmount: currentBetAmount,
                  sessionTime: sessionStartTime
                    ? Math.floor((new Date() - sessionStartTime) / 1000)
                    : 0,
                },
              };
              refreshDetails.push(refreshInfo);

              saveState();
              chrome.runtime.sendMessage({
                action: "refreshRequired",
                data: { reason: "Bet button disabled" },
              });

              setTimeout(() => {
                location.reload();
              }, 100);
              return;
            }
          }

          setTimeout(() => {
            console.log(
              "Button ready - currentBet:",
              !!currentBet,
              "skipBetting:",
              skipBetting,
              "consecutiveLowCrashes:",
              consecutiveLowCrashes
            );

            // Check if we should skip due to consecutive low crashes
            if (
              betConfig.crashAt > 0 &&
              betConfig.crashTimes > 0 &&
              consecutiveLowCrashes >= betConfig.crashTimes
            ) {
              skipBetting = true;
              console.log(
                `Pre-bet check: Skipping due to ${consecutiveLowCrashes} consecutive low crashes`
              );
            }

            if (!skipBetting && !refreshInProgress) {
              placeBet();
            } else {
              console.log(
                "Bet skipped due to consecutive crashes or refresh in progress"
              );
              currentBet = null; // Ensure no bet is tracked
              // Notify bet skipped
              if (!refreshInProgress) {
                chrome.runtime.sendMessage({
                  action: "showBetStatus",
                  data: { type: "skipped", reason: "Consecutive crashes" },
                });
              }
            }
          }, 50);
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
  const newGameSidebar = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar"
  );
  const newStartBetButton = document.querySelector(
    "[data-testid='game-frame'] [data-testid='bet-button']"
  );
  const newBetAmountInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='input-game-amount']"
  );
  const newProfitInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='profit-input']"
  );
  const newLastCrashes = document.querySelector(".past-bets");

  const newCashoutInput = [
    ...(newGameSidebar?.querySelectorAll("label span[slot='label']") || []),
  ]
    .find((el) => el.textContent.trim() === "Cashout At")
    ?.closest("label")
    ?.querySelector("input");

  console.log("Elements found:", {
    gameSidebar: !!newGameSidebar,
    startBetButton: !!newStartBetButton,
    betAmountInput: !!newBetAmountInput,
    profitInput: !!newProfitInput,
    lastCrashes: !!newLastCrashes,
    cashoutInput: !!newCashoutInput,
  });

  // Update global variables if elements found
  if (newGameSidebar) gameSidebar = newGameSidebar;
  if (newStartBetButton) startBetButton = newStartBetButton;
  if (newBetAmountInput) betAmountInput = newBetAmountInput;
  if (newProfitInput) profitInput = newProfitInput;
  if (newLastCrashes) lastCrashes = newLastCrashes;
  if (newCashoutInput) cashoutInput = newCashoutInput;
}

function addCrashToHistory(crashValue) {
  // Only block if we're actually refreshing (not just skipped due to invalid input)
  if (refreshInProgress) {
    console.log("Crash processing blocked - refresh in progress");
    return;
  }

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

function handleStopResumeLogic(crash) {
  console.log(
    `Crash: ${crash}, skipBetting: ${skipBetting}, consecutiveLowCrashes: ${consecutiveLowCrashes}, consecutiveHighCrashes: ${consecutiveHighCrashes}, currentBet: ${!!currentBet}`
  );

  // Check resume logic first
  if (checkResumeLogic(crash)) return;

  // Check crash patterns for betting decisions
  if (currentBet) {
    checkCrashPattern(crash);
  }
}

function checkResumeLogic(crash) {
  if (skipBetting) {
    // Check high crash resume (original logic)
    if (betConfig.resumeAt > 0 && crash >= betConfig.resumeAt) {
      console.log(
        `Resume triggered! Crash ${crash} >= resumeAt ${betConfig.resumeAt}`
      );
      resumeBetting();
      return true;
    }

    // Check alternative resume logic (new logic)
    if (betConfig.resumeBelowAt !== 0 && betConfig.resumeBelowTimes > 0) {
      let conditionMet = false;

      if (betConfig.resumeBelowAt > 0) {
        // Positive value: resume when crashes are below this value
        conditionMet = crash < betConfig.resumeBelowAt;
      } else {
        // Negative value: resume when crashes are above this value (use absolute)
        conditionMet = crash > Math.abs(betConfig.resumeBelowAt);
      }

      if (conditionMet) {
        consecutiveResumeBelowCrashes++;
        const operator = betConfig.resumeBelowAt > 0 ? "<" : ">";
        const threshold = Math.abs(betConfig.resumeBelowAt);
        console.log(
          `Resume condition: ${crash} ${operator} ${threshold}. Count: ${consecutiveResumeBelowCrashes}`
        );

        if (consecutiveResumeBelowCrashes >= betConfig.resumeBelowTimes) {
          console.log(
            `Resume triggered! ${consecutiveResumeBelowCrashes} consecutive crashes ${operator} ${threshold}`
          );
          resumeBetting();
          return true;
        }
      } else {
        consecutiveResumeBelowCrashes = 0;
        const operator = betConfig.resumeBelowAt > 0 ? ">=" : "<=";
        const threshold = Math.abs(betConfig.resumeBelowAt);
        console.log(
          `Resume condition reset: ${crash} ${operator} ${threshold}`
        );
      }
    }
  }
  return false;
}

function resumeBetting() {
  if (betConfig.resumeAdjust !== 0) {
    const oldAmount = currentBetAmount;
    currentBetAmount = adjustBetAmount(lastBetAmount, betConfig.resumeAdjust);
    console.log(
      `Resume bet adjustment: ${oldAmount} -> ${currentBetAmount} (${betConfig.resumeAdjust}% from last bet ${lastBetAmount})`
    );
  } else {
    currentBetAmount = lastBetAmount;
    console.log(`Resume: Using last bet amount ${lastBetAmount}`);
  }

  chrome.runtime.sendMessage({
    action: "updateCurrentBetAmount",
    data: { amount: currentBetAmount },
  });

  skipBetting = false;
  consecutiveLowCrashes = 0;
  consecutiveHighCrashes = 0;
  consecutiveResumeBelowCrashes = 0;
}

function checkCrashPattern(crash) {
  // Check crash pattern (all bet outcomes)
  if (betConfig.crashAt > 0 && betConfig.crashTimes > 0) {
    if (crash < betConfig.crashAt) {
      consecutiveLowCrashes++;
      console.log(
        `Bet crash below threshold: ${crash} < ${betConfig.crashAt}. Count: ${consecutiveLowCrashes}`
      );

      if (consecutiveLowCrashes >= betConfig.crashTimes) {
        console.log(
          `Will skip betting after ${consecutiveLowCrashes} consecutive crashes below ${betConfig.crashAt}`
        );
        skipBetting = true;
      }
    } else {
      consecutiveLowCrashes = 0;
      console.log(
        `Crash reached threshold: ${crash} >= ${betConfig.crashAt}, reset count`
      );
    }
  }
}

function placeBet() {
  // Only block if we're actually refreshing (not just skipped due to invalid input)
  if (refreshInProgress) {
    console.log("Bet placement blocked - refresh in progress");
    return;
  }

  if (betAmountInput && cashoutInput) {
    console.log(`=== PLACING BET ===`);
    console.log(`Current bet amount: ${currentBetAmount}`);
    console.log(`Last bet amount: ${lastBetAmount}`);
    console.log(`Original bet amount: ${originalBetAmount}`);

    // Clear and set values with small delays
    betAmountInput.value = "";
    setTimeout(() => {
      setInputValue(betAmountInput, currentBetAmount);
      setTimeout(() => {
        setInputValue(cashoutInput, betConfig.cashout);

        // Store the last bet amount before creating currentBet
        lastBetAmount = currentBetAmount;

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
            currency: currentCurrency,
          },
        });

        // Update current bet amount display
        chrome.runtime.sendMessage({
          action: "updateCurrentBetAmount",
          data: { amount: currentBetAmount, currency: currentCurrency },
        });
      }, 50);
    }, 50);
  }
}

function adjustBetAmountBasedOnResult(crash) {
  // Only block if we're actually refreshing (not just skipped due to invalid input)
  if (refreshInProgress) {
    console.log("Bet adjustment blocked - refresh in progress");
    return;
  }

  const { onWin, onLoss } = betConfig;
  const oldAmount = currentBetAmount;

  if (crash >= parseFloat(currentBet.cashoutAt)) {
    // Won - calculate profit and update total
    const profit =
      parseFloat(currentBet.betAmount) * parseFloat(currentBet.cashoutAt) -
      parseFloat(currentBet.betAmount);
    totalProfit += profit;
    superTotalProfit += profit;
    superTotalBets++;
    console.log(
      `Profit this round: ${profit.toFixed(
        2
      )}, Total profit: ${totalProfit.toFixed(2)}`
    );

    // Check if profit crosses threshold
    if (
      betConfig.profitTimes > 0 &&
      totalProfit >= originalBetAmount * betConfig.profitTimes
    ) {
      currentBetAmount = originalBetAmount;
      totalProfit = 0; // Reset profit counter
      console.log(
        `Profit threshold reached! Reset to original amount: ${originalBetAmount}`
      );

      // Notify sidepanel to reset graph and calculations
      chrome.runtime.sendMessage({
        action: "resetProfitTracking",
      });
    } else if (onWin === 0) {
      // Won - check if onWin is 0% to reset to original amount
      currentBetAmount = originalBetAmount;
      console.log(
        `WON: ${oldAmount} -> ${currentBetAmount} (reset to original)`
      );
    } else {
      // Won - adjust by onWin % (typically negative to decrease bet)
      currentBetAmount = adjustBetAmount(currentBetAmount, -Math.abs(onWin));
      console.log(
        `WON: ${oldAmount} -> ${currentBetAmount} (${onWin}% decrease)`
      );
    }
  } else {
    // Lost - subtract loss from total profit
    const loss = parseFloat(currentBet.betAmount);
    totalProfit -= loss;
    superTotalLoss += loss;
    superTotalBets++;
    console.log(
      `Loss this round: ${loss}, Total profit: ${totalProfit.toFixed(2)}`
    );

    // Lost - adjust by onLoss % (typically positive to increase bet)
    currentBetAmount = adjustBetAmount(currentBetAmount, Math.abs(onLoss));
    console.log(
      `LOST: ${oldAmount} -> ${currentBetAmount} (${onLoss}% increase)`
    );
  }

  // Check if reset threshold is exceeded
  checkResetThreshold();
  // Check if loss reset amount is reached
  checkLossResetAmount();

  // Send super data update after win or loss
  console.log("Sending super data update:", {
    superTotalProfit,
    superTotalLoss,
    superTotalBets,
  });
  chrome.runtime.sendMessage({
    action: "updateSuperData",
    data: {
      superProfit: superTotalProfit,
      superLoss: superTotalLoss,
      superBets: superTotalBets,
    },
  });
}

function setInputValue(input, value) {
  if (!input) return;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

function roundBetAmount(amount) {
  const num = parseFloat(amount);
  const decimals = betConfig.decimalPlaces || 0;
  return parseFloat(num.toFixed(decimals));
}

function checkResetThreshold() {
  if (betConfig.resetThreshold !== 0) {
    const changePercent =
      ((currentBetAmount - originalBetAmount) / originalBetAmount) * 100;

    // Check if threshold is exceeded (positive or negative)
    const thresholdExceeded =
      betConfig.resetThreshold > 0
        ? changePercent >= betConfig.resetThreshold
        : changePercent <= betConfig.resetThreshold;

    if (thresholdExceeded) {
      console.log(
        `Reset threshold reached: ${changePercent.toFixed(2)}% ${
          betConfig.resetThreshold > 0 ? ">=" : "<="
        } ${betConfig.resetThreshold}%`
      );
      currentBetAmount = originalBetAmount;
      console.log(`Bet amount reset to original: ${originalBetAmount}`);

      // Update current bet amount display
      chrome.runtime.sendMessage({
        action: "updateCurrentBetAmount",
        data: { amount: currentBetAmount },
      });

      return true;
    }
  }
  return false;
}

function checkLossResetAmount() {
  if (betConfig.lossResetAmount > 0 && totalProfit < 0) {
    const currentLoss = Math.abs(totalProfit);

    if (currentLoss >= betConfig.lossResetAmount) {
      console.log(
        `Loss reset triggered! Loss: ${currentLoss} >= ${betConfig.lossResetAmount}`
      );

      // Track sub-session reset details
      subSessionResets++;
      const resetDetails = {
        resetNumber: subSessionResets,
        lossAmount: currentLoss,
        timestamp: new Date().toLocaleTimeString(),
        betAmountBefore: currentBetAmount,
        betAmountAfter: originalBetAmount,
      };
      subSessionLossDetails.push(resetDetails);

      // Reset sub session
      currentBetAmount = originalBetAmount;
      lastBetAmount = originalBetAmount; // Fix: Update lastBetAmount for resume logic
      totalProfit = 0;

      console.log(
        `Sub session reset #${subSessionResets} - loss: ${currentLoss}, bet amount: ${originalBetAmount}`
      );

      // Notify sidepanel to reset graph and calculations
      chrome.runtime.sendMessage({
        action: "resetProfitTracking",
      });

      // Send updated sub-session data
      chrome.runtime.sendMessage({
        action: "updateSubSessionData",
        data: {
          resets: subSessionResets,
          lossDetails: subSessionLossDetails,
        },
      });

      // Send updated refresh data
      chrome.runtime.sendMessage({
        action: "updateRefreshData",
        data: {
          refreshes: totalRefreshes,
          refreshDetails: refreshDetails,
        },
      });

      // Update current bet amount display
      chrome.runtime.sendMessage({
        action: "updateCurrentBetAmount",
        data: { amount: currentBetAmount, currency: currentCurrency },
      });

      return true;
    }
  }
  return false;
}

function adjustBetAmount(amount, percentage) {
  const percent = parseFloat(percentage) || 0;
  const multiplier = 1 + percent / 100;
  const adjustedAmount = amount * multiplier;
  return roundBetAmount(adjustedAmount);
}

function walletWatcher() {
  const coinToggle = document.querySelector(".coin-toggle");
  if (coinToggle) {
    walletObserver = new MutationObserver(() => {
      // Find balance element - look for the span with currency symbol and amount
      const balanceElement = coinToggle.querySelector(
        '.content span[data-ds-text="true"]'
      );
      // Find currency element - look for span with title attribute
      const currencyElement = coinToggle.querySelector("span[title]");

      if (balanceElement && currencyElement) {
        const balanceText = balanceElement.textContent.trim();
        // Extract numeric value from text like "₹598.21"
        const balance = parseFloat(balanceText.replace(/[^\d.]/g, "")) || 0;
        const currency =
          currencyElement.getAttribute("title")?.toUpperCase() || "USDT";
        const symbol =
          currency === "USDT" ? "$" : currency === "INR" ? "₹" : currency;

        console.log("Wallet detected:", {
          balance,
          currency,
          symbol,
          balanceText,
        });

        if (balance !== currentWalletBalance || symbol !== currentCurrency) {
          currentWalletBalance = balance;
          currentCurrency = symbol;
          chrome.runtime.sendMessage({
            action: "updateWalletBalance",
            data: { balance: currentWalletBalance, currency: currentCurrency },
          });

          // Check wallet protection
          checkWalletProtection();
        }
      }
    });

    walletObserver.observe(coinToggle, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Initial check
    const balanceElement = coinToggle.querySelector(
      '.content span[data-ds-text="true"]'
    );
    const currencyElement = coinToggle.querySelector("span[title]");

    if (balanceElement && currencyElement) {
      const balanceText = balanceElement.textContent.trim();
      currentWalletBalance =
        parseFloat(balanceText.replace(/[^\d.]/g, "")) || 0;
      const currency =
        currencyElement.getAttribute("title")?.toUpperCase() || "USDT";
      currentCurrency =
        currency === "USDT" ? "$" : currency === "INR" ? "₹" : currency;

      console.log("Initial wallet:", {
        balance: currentWalletBalance,
        currency,
        symbol: currentCurrency,
        balanceText,
      });
      chrome.runtime.sendMessage({
        action: "updateWalletBalance",
        data: { balance: currentWalletBalance, currency: currentCurrency },
      });
    }

    console.log("Wallet watcher initialized");
  } else {
    console.log("Coin toggle not found");
  }
}

function checkWalletProtection() {
  if (
    !autoBetRunning ||
    walletProtectionTriggered ||
    !betConfig.walletStopLoss ||
    initialWalletBalance === 0 ||
    currentWalletBalance === 0
  ) {
    return;
  }

  const lossPercentage =
    ((initialWalletBalance - currentWalletBalance) / initialWalletBalance) *
    100;

  if (lossPercentage >= betConfig.walletStopLoss) {
    console.log(
      `Wallet protection triggered! Loss: ${lossPercentage.toFixed(2)}% >= ${
        betConfig.walletStopLoss
      }%`
    );

    walletProtectionTriggered = true;
    autoBetRunning = false;

    chrome.runtime.sendMessage({
      action: "walletProtectionTriggered",
      data: {
        lossPercentage: lossPercentage.toFixed(2),
        threshold: betConfig.walletStopLoss,
        initialBalance: initialWalletBalance,
        currentBalance: currentWalletBalance,
      },
    });
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
      resumeAdjust,
      resumeBelowAt,
      resumeBelowTimes,
      resetThreshold,
      profitTimes,
      lossResetAmount,
      walletStopLoss,
      decimalPlaces,
    } = message.data;

    betConfig = {
      amount: parseFloat(amount),
      cashout: parseFloat(cashout),
      crashAt: parseFloat(stopCrashAt),
      crashTimes: parseInt(stopCrashTimes),
      onLoss: parseFloat(loss),
      onWin: parseFloat(win),
      resumeAt: parseFloat(resumeAt),
      resumeAdjust: parseFloat(resumeAdjust) || 0,
      resumeBelowAt: parseFloat(resumeBelowAt) || 0,
      resumeBelowTimes: parseInt(resumeBelowTimes) || 0,
      resetThreshold: parseFloat(resetThreshold) || 0,
      profitTimes: parseFloat(profitTimes) || 0,
      lossResetAmount: parseFloat(lossResetAmount) || 0,
      walletStopLoss: parseFloat(walletStopLoss) || 0,
      decimalPlaces: parseInt(decimalPlaces) || 0,
    };

    currentBetAmount = betConfig.amount;
    originalBetAmount = betConfig.amount;

    setInputValue(betAmountInput, amount);
    setInputValue(cashoutInput, cashout);
  }

  if (message.action === "updateDecimalPlaces") {
    if (betConfig) {
      betConfig.decimalPlaces = message.data.decimalPlaces;
    }
  }

  if (message.action === "startAutoBet") {
    autoBetRunning = true;
    consecutiveLowCrashes = 0;
    consecutiveHighCrashes = 0;
    consecutiveResumeBelowCrashes = 0;
    skipBetting = false;
    ignorePreviousCrash = true;
    totalProfit = 0;
    sessionStartTime = new Date();
    superTotalProfit = 0;
    superTotalLoss = 0;
    superTotalBets = 0;
    subSessionResets = 0;
    subSessionLossDetails = [];
    totalRefreshes = 0;
    refreshDetails = [];
    initialWalletBalance = currentWalletBalance;
    walletProtectionTriggered = false;
    console.log("Auto-betting started - will ignore next crash");

    // Send session start time to sidepanel
    chrome.runtime.sendMessage({
      action: "sessionStarted",
      data: { startTime: sessionStartTime },
    });

    // Send initial refresh data
    chrome.runtime.sendMessage({
      action: "updateRefreshData",
      data: {
        refreshes: totalRefreshes,
        refreshDetails: refreshDetails,
      },
    });
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

  if (message.action === "getConsoleLogs") {
    sendResponse({ logs: consoleLogs });
  }
});
