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
let originalBetAmount = 0;
let lastBetAmount = 0;
let totalProfit = 0;
let sessionStartTime = null;
let superTotalProfit = 0;
let superTotalLoss = 0;
let superTotalBets = 0;
let ignorePreviousCrash = false;
let walletObserver = null;
let currentWalletBalance = 0;
let currentCurrency = '$';
let initialWalletBalance = 0;
let walletProtectionTriggered = false;

const POSSIBLE_BUTTON_TEXTS = ["Bet", "Starting...", "Bet (Next Round)"];

function initializeElements() {
  fillProperties();

  if (!gameSidebar || !startBetButton) {
    console.log("Elements not ready, retrying in 1 second...");
    setTimeout(initializeElements, 500);
  } else {
    betWatcher();
    crashWatcher();
    walletWatcher();
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
      const currentButton = gameSidebar.querySelector("[data-testid='bet-button']");
      const currentText = currentButton?.textContent?.trim() || "Cashout";

      if (currentText !== lastStatus) {
        console.log("Button text changed:", currentText);
        startBetButton = currentButton;

        chrome.runtime.sendMessage({
          action: "updateButtonStatus",
          data: { buttonText: currentText },
        });

        if (currentText === "Bet" && autoBetRunning) {
          setTimeout(() => {
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
  gameSidebar = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar"
  );
  startBetButton = document.querySelector(
    "[data-testid='game-frame'] [data-testid='bet-button']"
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

  //console.log("Elements found:", { gameSidebar, startBetButton, lastCrashes });
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

function handleStopResumeLogic(crash) {
  const { crashAt, crashTimes, resumeAt } = betConfig;

  console.log(
    `Crash: ${crash}, skipBetting: ${skipBetting}, consecutiveLowCrashes: ${consecutiveLowCrashes}, currentBet: ${!!currentBet}`
  );

  // Resume betting immediately when any crash crosses resumeAt threshold (check all crashes during skip)
  if (skipBetting && crash >= resumeAt) {
    console.log(`Resume triggered! Crash ${crash} >= resumeAt ${resumeAt}`);

    // Apply resume adjustment to last bet amount
    if (betConfig.resumeAdjust !== 0) {
      const oldAmount = currentBetAmount;
      currentBetAmount = adjustBetAmount(lastBetAmount, betConfig.resumeAdjust);
      console.log(
        `Resume bet adjustment: ${oldAmount} -> ${currentBetAmount} (${betConfig.resumeAdjust}% from last bet ${lastBetAmount})`
      );
    } else {
      // Use last bet amount if no adjustment
      currentBetAmount = lastBetAmount;
      console.log(`Resume: Using last bet amount ${lastBetAmount}`);
    }

    // Update current bet amount display
    chrome.runtime.sendMessage({
      action: "updateCurrentBetAmount",
      data: { amount: currentBetAmount },
    });

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

function placeBet() {
  if (betAmountInput && cashoutInput) {
    console.log(`Setting bet amount to: ${currentBetAmount}`);

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
  const { onWin, onLoss } = betConfig;
  const oldAmount = currentBetAmount;

  if (crash >= parseFloat(currentBet.cashoutAt)) {
    // Won - calculate profit and update total
    const profit = (parseFloat(currentBet.betAmount) * parseFloat(currentBet.cashoutAt)) - parseFloat(currentBet.betAmount);
    totalProfit += profit;
    superTotalProfit += profit;
    superTotalBets++;
    console.log(`Profit this round: ${profit.toFixed(2)}, Total profit: ${totalProfit.toFixed(2)}`);
    
    // Check if profit crosses threshold
    if (betConfig.profitTimes > 0 && totalProfit >= (originalBetAmount * betConfig.profitTimes)) {
      currentBetAmount = originalBetAmount;
      totalProfit = 0; // Reset profit counter
      console.log(`Profit threshold reached! Reset to original amount: ${originalBetAmount}`);
      
      // Notify sidepanel to reset graph and calculations
      chrome.runtime.sendMessage({
        action: "resetProfitTracking"
      });
      
      // Send super data update
      chrome.runtime.sendMessage({
        action: "updateSuperData",
        data: {
          superProfit: superTotalProfit,
          superLoss: superTotalLoss,
          superBets: superTotalBets
        }
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
    console.log(`Loss this round: ${loss}, Total profit: ${totalProfit.toFixed(2)}`);
    
    // Lost - adjust by onLoss % (typically positive to increase bet)
    currentBetAmount = adjustBetAmount(currentBetAmount, Math.abs(onLoss));
    console.log(
      `LOST: ${oldAmount} -> ${currentBetAmount} (${onLoss}% increase)`
    );
  }

  // Check if reset threshold is exceeded
  checkResetThreshold();
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

function adjustBetAmount(amount, percentage) {
  const percent = parseFloat(percentage) || 0;
  const multiplier = 1 + percent / 100;
  const adjustedAmount = amount * multiplier;
  return roundBetAmount(adjustedAmount);
}

function walletWatcher() {
  const coinToggle = document.querySelector('.coin-toggle');
  if (coinToggle) {
    walletObserver = new MutationObserver(() => {
      // Find balance element - look for the span with currency symbol and amount
      const balanceElement = coinToggle.querySelector('.content span[data-ds-text="true"]');
      // Find currency element - look for span with title attribute
      const currencyElement = coinToggle.querySelector('span[title]');
      
      if (balanceElement && currencyElement) {
        const balanceText = balanceElement.textContent.trim();
        // Extract numeric value from text like "₹598.21"
        const balance = parseFloat(balanceText.replace(/[^\d.]/g, '')) || 0;
        const currency = currencyElement.getAttribute('title')?.toUpperCase() || 'USDT';
        const symbol = currency === 'USDT' ? '$' : currency === 'INR' ? '₹' : currency;
        
        console.log('Wallet detected:', { balance, currency, symbol, balanceText });
        
        if (balance !== currentWalletBalance || symbol !== currentCurrency) {
          currentWalletBalance = balance;
          currentCurrency = symbol;
          chrome.runtime.sendMessage({
            action: "updateWalletBalance",
            data: { balance: currentWalletBalance, currency: currentCurrency }
          });
          
          // Check wallet protection
          checkWalletProtection();
        }
      }
    });
    
    walletObserver.observe(coinToggle, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Initial check
    const balanceElement = coinToggle.querySelector('.content span[data-ds-text="true"]');
    const currencyElement = coinToggle.querySelector('span[title]');
    
    if (balanceElement && currencyElement) {
      const balanceText = balanceElement.textContent.trim();
      currentWalletBalance = parseFloat(balanceText.replace(/[^\d.]/g, '')) || 0;
      const currency = currencyElement.getAttribute('title')?.toUpperCase() || 'USDT';
      currentCurrency = currency === 'USDT' ? '$' : currency === 'INR' ? '₹' : currency;
      
      console.log('Initial wallet:', { balance: currentWalletBalance, currency, symbol: currentCurrency, balanceText });
      chrome.runtime.sendMessage({
        action: "updateWalletBalance",
        data: { balance: currentWalletBalance, currency: currentCurrency }
      });
    }
    
    console.log('Wallet watcher initialized');
  } else {
    console.log('Coin toggle not found');
  }
}

function checkWalletProtection() {
  if (!autoBetRunning || walletProtectionTriggered || !betConfig.walletStopLoss || initialWalletBalance === 0) {
    return;
  }
  
  const lossPercentage = ((initialWalletBalance - currentWalletBalance) / initialWalletBalance) * 100;
  
  if (lossPercentage >= betConfig.walletStopLoss) {
    console.log(`Wallet protection triggered! Loss: ${lossPercentage.toFixed(2)}% >= ${betConfig.walletStopLoss}%`);
    
    walletProtectionTriggered = true;
    autoBetRunning = false;
    
    chrome.runtime.sendMessage({
      action: "walletProtectionTriggered",
      data: { 
        lossPercentage: lossPercentage.toFixed(2),
        threshold: betConfig.walletStopLoss,
        initialBalance: initialWalletBalance,
        currentBalance: currentWalletBalance
      }
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
      resetThreshold,
      profitTimes,
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
      resetThreshold: parseFloat(resetThreshold) || 0,
      profitTimes: parseFloat(profitTimes) || 0,
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
    skipBetting = false;
    ignorePreviousCrash = true;
    totalProfit = 0;
    sessionStartTime = new Date();
    superTotalProfit = 0;
    superTotalLoss = 0;
    superTotalBets = 0;
    initialWalletBalance = currentWalletBalance;
    walletProtectionTriggered = false;
    console.log("Auto-betting started - will ignore next crash");
    
    // Send session start time to sidepanel
    chrome.runtime.sendMessage({
      action: "sessionStarted",
      data: { startTime: sessionStartTime }
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
});
