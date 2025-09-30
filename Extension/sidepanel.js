// Profit tracking variables (global scope)
let totalProfit = 0;
let totalLoss = 0;
let profitHistory = [];
let canvas, ctx;
let skipNextHistoryUpdate = false;
let autoBettingActive = false;
let sessionStartTime = null;
let timerInterval = null;
let superTotalProfit = 0;
let superTotalLoss = 0;
let superTotalBets = 0;
let decimalPlacesCount = 0;
let currentCurrency = '$';

document.addEventListener("DOMContentLoaded", () => {
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const crashAt = document.getElementById("crashAt");
  const crashTimes = document.getElementById("crashTimes");
  const resumeAt = document.getElementById("resumeAt");
  const resumeAdjust = document.getElementById("resumeAdjust");
  const resetThreshold = document.getElementById("resetThreshold");
  const profitTimes = document.getElementById("profitTimes");
  const walletStopLoss = document.getElementById("walletStopLoss");
  const decimalPlaces = document.getElementById("decimalPlaces");
  const saveBtn = document.getElementById("saveBtn");
  const resetBetBtn = document.getElementById("resetBetBtn");

  const startStopBtn = document.getElementById("startStopBtn");
  let isRunning = false;
  
  // Initialize canvas and context
  canvas = document.getElementById('profitChart');
  ctx = canvas.getContext('2d');

  // Tab switching functionality
  document.getElementById("settingsTab").addEventListener("click", () => switchTab("settings"));
  document.getElementById("historyTab").addEventListener("click", () => switchTab("history"));
  
  // Load saved configuration
  chrome.storage.local.get(["betData"], (result) => {
    if (result.betData) {
      const data = result.betData;
      
      // Load all form values
      if (data.amount) betAmount.value = data.amount;
      if (data.cashout) cashoutAt.value = data.cashout;
      if (data.loss) onLoss.value = data.loss;
      if (data.win) onWin.value = data.win;
      if (data.stopCrashAt) crashAt.value = data.stopCrashAt;
      if (data.stopCrashTimes) crashTimes.value = data.stopCrashTimes;
      if (data.resumeAt) resumeAt.value = data.resumeAt;
      if (data.resumeAdjust) resumeAdjust.value = data.resumeAdjust;
      if (data.resetThreshold) resetThreshold.value = data.resetThreshold;
      if (data.profitTimes) profitTimes.value = data.profitTimes;
      if (data.walletStopLoss) walletStopLoss.value = data.walletStopLoss;
      
      // Load decimal places setting
      if (data.decimalPlaces !== undefined) {
        decimalPlacesCount = parseInt(data.decimalPlaces) || 0;
        decimalPlaces.value = data.decimalPlaces;
      }
    }
  });
  
  // Decimal places input event
  decimalPlaces.addEventListener("input", (e) => {
    decimalPlacesCount = parseInt(e.target.value) || 0;
    // Update displays immediately
    updateProfitGraph();
    updateSuperSummary();
    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateDecimalPlaces",
        data: { decimalPlaces: decimalPlacesCount }
      });
    });
  });

  saveBtn.addEventListener("click", () => {
    // Validate all inputs
    if (!validateInputs()) {
      return;
    }

    const betData = {
      amount: betAmount.value,
      cashout: cashoutAt.value,
      loss: onLoss.value,
      win: onWin.value,
      stopCrashAt: crashAt.value,
      stopCrashTimes: crashTimes.value,
      resumeAt: resumeAt.value,
      resumeAdjust: resumeAdjust.value,
      resetThreshold: resetThreshold.value,
      profitTimes: profitTimes.value,
      walletStopLoss: walletStopLoss.value,
      decimalPlaces: decimalPlaces.value,
    };

    chrome.storage.local.set({ betData });

    // Show saved feedback
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "✅ Saved!";
    saveBtn.style.background = "#16a34a";
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = "";
    }, 1500);
  });

  resetBetBtn.addEventListener("click", () => {
    const betData = {
      resetBetAmount: betAmount.value,
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "resetBetAmount",
        data: betData,
      });
    });

    // Show reset feedback
    const originalText = resetBetBtn.textContent;
    resetBetBtn.textContent = "✅ Reset!";
    resetBetBtn.style.background = "#16a34a";
    setTimeout(() => {
      resetBetBtn.textContent = originalText;
      resetBetBtn.style.background = "";
    }, 1500);
  });

  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const historyList = document.getElementById("historyList");

  fullscreenBtn.addEventListener("click", () => {
    if (historyList.classList.contains("fullscreen")) {
      historyList.classList.remove("fullscreen");
      document.body.classList.remove("fullscreen-mode");
      fullscreenBtn.textContent = "⛶";
    } else {
      historyList.classList.add("fullscreen");
      document.body.classList.add("fullscreen-mode");
      fullscreenBtn.textContent = "✖";
    }
  });

  startStopBtn.addEventListener("click", () => {
    isRunning = !isRunning;

    if (isRunning) {
      startStopBtn.textContent = "🛑 Stop Betting";
      startStopBtn.className = "btn-running";

      // Send config and start betting
      const betData = {
        amount: betAmount.value,
        cashout: cashoutAt.value,
        loss: onLoss.value,
        win: onWin.value,
        stopCrashAt: crashAt.value,
        stopCrashTimes: crashTimes.value,
        resumeAt: resumeAt.value,
        resumeAdjust: resumeAdjust.value,
        resetThreshold: resetThreshold.value,
        profitTimes: profitTimes.value,
        walletStopLoss: walletStopLoss.value,
        decimalPlaces: decimalPlaces.value,
      };

      autoBettingActive = true;
      
      // Switch to History tab to show betting activity
      switchTab("history");
      
      // Start timer
      startTimer();
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "fillBetData",
          data: betData,
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "startAutoBet",
        });
      });
    } else {
      startStopBtn.textContent = "🎯 Start Betting";
      startStopBtn.className = "btn-stopped";

      autoBettingActive = false;
      
      // Stop timer
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "stopAutoBet",
        });
      });
    }
  });
});

// Listen for history updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "addHistory") {
    console.log("Received history data:", message.data);
    addHistoryItem(message.data);
  }

  if (message.action === "updateButtonStatus") {
    const statusText = document.querySelector(".status-text");
    const statusDot = document.querySelector(".status-dot");
    const startStopBtn = document.getElementById("startStopBtn");
    const refreshNote = document.getElementById("refreshNote");
    const buttonStatus = document.getElementById("buttonStatus");

    if (statusText && statusDot && startStopBtn && refreshNote && buttonStatus) {
      statusText.textContent = message.data.buttonText;
      if (message.data.buttonText === "Ready") {
        // Ready = Not Connected = Red border
        statusDot.className = "status-dot red";
        statusDot.title = "Not Connected";
        startStopBtn.disabled = true;
        startStopBtn.style.opacity = "0.5";
        refreshNote.style.display = "block";
        buttonStatus.className = "button-status disconnected";
      } else {
        // Connected = Green border
        statusDot.className = "status-dot green";
        statusDot.title = "Connected";
        startStopBtn.disabled = false;
        startStopBtn.style.opacity = "1";
        refreshNote.style.display = "none";
        buttonStatus.className = "button-status connected";
      }
    }
  }

  if (message.action === "showBetStatus") {
    showBetNotification(message.data);
  }

  if (message.action === "updateCurrentBetAmount") {
    const currentBetElement = document.getElementById("currentBetAmount");
    if (currentBetElement) {
      const amount = parseFloat(message.data.amount).toFixed(decimalPlacesCount);
      const currency = message.data.currency || '$';
      currentBetElement.textContent = `Next Bet: ${currency}${amount}`;
    }
  }
  
  if (message.action === "updateDecimalPlaces") {
    decimalPlacesCount = message.data.decimalPlaces;
    // Refresh all displays
    updateProfitGraph();
    updateSuperSummary();
  }
  
  if (message.action === "updateWalletBalance") {
    const walletElement = document.getElementById("walletBalance");
    if (walletElement) {
      const balance = parseFloat(message.data.balance).toFixed(decimalPlacesCount);
      currentCurrency = message.data.currency || '$';
      walletElement.textContent = `Balance: ${currentCurrency}${balance}`;
      // Update all displays with new currency
      updateSuperSummary();
      updateProfitGraph();
    }
  }

  if (message.action === "resetProfitTracking") {
    // Only reset if auto betting is active
    if (autoBettingActive) {
      totalProfit = 0;
      totalLoss = 0;
      profitHistory = [];
      skipNextHistoryUpdate = true;
      
      // Update display
      updateProfitGraph();
      console.log("Profit tracking reset - starting fresh cycle");
    }
  }
  
  if (message.action === "sessionStarted") {
    sessionStartTime = new Date(message.data.startTime);
    superTotalProfit = 0;
    superTotalLoss = 0;
    superTotalBets = 0;
    totalProfit = 0;
    totalLoss = 0;
    profitHistory = [];
    updateSuperSummary();
    updateProfitGraph();
    startTimer();
  }
  
  if (message.action === "updateSuperData") {
    superTotalProfit = message.data.superProfit;
    superTotalLoss = message.data.superLoss;
    superTotalBets = message.data.superBets;
    updateSuperSummary();
  }
  
  if (message.action === "walletProtectionTriggered") {
    const notification = document.getElementById("betNotification");
    if (notification) {
      notification.textContent = `🛡️ Wallet Protection: ${message.data.lossPercentage}% loss reached!`;
      notification.className = "bet-notification error";
      notification.classList.remove("hidden");
    }
    
    // Stop the betting interface
    const startStopBtn = document.getElementById("startStopBtn");
    if (startStopBtn) {
      startStopBtn.textContent = "🎯 Start Betting";
      startStopBtn.className = "btn-stopped";
    }
    autoBettingActive = false;
  }
});

function showBetNotification(data) {
  const notification = document.getElementById("betNotification");

  if (!notification) return;

  if (data.type === "placed") {
    const amount = parseFloat(data.amount).toFixed(decimalPlacesCount);
    const currency = data.currency || '$';
    notification.textContent = `💰 Bet Placed: ${currency}${amount} @ ${data.cashout}x`;
    notification.className = "bet-notification placed";
  } else {
    notification.textContent = `⏸️ Bet Skipped: ${data.reason}`;
    notification.className = "bet-notification skipped";
  }

  setTimeout(() => {
    notification.classList.add("hidden");
  }, 3000);
}

function addHistoryItem(data) {
  console.log("Adding history item:", data);
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    console.error("History list element not found");
    return;
  }

  // Remove latest class from previous item
  const previousLatest = historyList.querySelector(".history-item.latest");
  if (previousLatest) {
    previousLatest.classList.remove("latest");
  }

  const item = document.createElement("div");
  item.className = "history-item latest";

  let status, details, colorClass, profitLoss = 0;
  if (data.skipped) {
    status = "Skipped";
    details = "No bet placed";
    colorClass = "history-skip";
  } else {
    const won =
      data.isWin || parseFloat(data.crashValue) >= parseFloat(data.cashoutAt);
    status = won ? "Won" : "Lost";
    details = `Bet: ₹${data.betAmount} | Cashout: ${data.cashoutAt}x`;
    colorClass = won ? "history-win" : "history-loss";
    
    // Calculate profit/loss
    if (won) {
      profitLoss = (parseFloat(data.betAmount) * parseFloat(data.cashoutAt)) - parseFloat(data.betAmount);
    } else {
      profitLoss = -parseFloat(data.betAmount);
    }
    
    // Only update profit tracking if auto betting is active
    if (autoBettingActive) {
      // Skip profit tracking update if we just reset
      if (skipNextHistoryUpdate) {
        skipNextHistoryUpdate = false;
        console.log("Skipping profit calculation for reset bet");
      } else {
        if (won) {
          totalProfit += profitLoss;
          superTotalProfit += profitLoss;
        } else {
          totalLoss += Math.abs(profitLoss);
          superTotalLoss += Math.abs(profitLoss);
        }
        superTotalBets++;
        
        // Update profit history for graph
        profitHistory.push(totalProfit - totalLoss);
        updateProfitGraph();
        updateSuperSummary();
      }
    }
  }

  item.classList.add(colorClass);

  const profitLossText = data.skipped ? '' : `<div class="history-profit ${profitLoss >= 0 ? 'profit' : 'loss'}">${profitLoss >= 0 ? '+' : ''}₹${formatNumber(Math.abs(profitLoss))}</div>`;

  item.innerHTML = `
    <div class="history-title">Crashed at ${data.crashValue}, ${status}</div>
    <div class="history-details">${details}</div>
    ${profitLossText}
    <div class="history-time">${data.timestamp}</div>
  `;

  historyList.insertBefore(item, historyList.firstChild);
  console.log("History item added to DOM");

  // Keep only last 50 items
  while (historyList.children.length > 50) {
    historyList.removeChild(historyList.lastChild);
  }
}

function updateProfitGraph() {
  // Update profit/loss labels
  document.getElementById('totalProfit').textContent = formatNumber(totalProfit);
  document.getElementById('totalLoss').textContent = formatNumber(totalLoss);
  document.getElementById('netProfit').textContent = formatNumber(totalProfit - totalLoss);
  
  // Update currency symbols
  document.getElementById('totalProfitCurrency').textContent = currentCurrency;
  document.getElementById('totalLossCurrency').textContent = currentCurrency;
  document.getElementById('netProfitCurrency').textContent = currentCurrency;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (profitHistory.length === 0) return;
  
  // Show last 20 data points for clarity
  const displayData = profitHistory.slice(-20);
  const barWidth = canvas.width / displayData.length;
  
  const maxVal = Math.max(...displayData, 0);
  const minVal = Math.min(...displayData, 0);
  const range = Math.max(maxVal - minVal, 1);
  const zeroY = canvas.height - ((-minVal) / range) * canvas.height;
  
  // Draw zero line
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, zeroY);
  ctx.lineTo(canvas.width, zeroY);
  ctx.stroke();
  
  // Draw bars
  displayData.forEach((value, index) => {
    const x = index * barWidth;
    const barHeight = Math.abs((value / range) * canvas.height * 0.8);
    const y = value >= 0 ? zeroY - barHeight : zeroY;
    
    // Color based on profit/loss
    ctx.fillStyle = value >= 0 ? '#22c55e' : '#dc2626';
    ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
    
    // Draw value on top of bar (for last 5 bars only)
    if (index >= displayData.length - 5) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      const textY = value >= 0 ? y - 2 : y + barHeight + 10;
      ctx.fillText(formatNumber(value), x + barWidth/2, textY);
    }
  });
}

function validateInputs() {
  const inputs = document.querySelectorAll('#settingsContent input[required]');
  const validationError = document.getElementById('validationError');
  let isValid = true;
  let errorMessages = [];
  
  inputs.forEach(input => {
    input.classList.remove('error');
    if (!input.value || !input.checkValidity()) {
      input.classList.add('error');
      const label = input.previousElementSibling.textContent;
      errorMessages.push(`${label} is required`);
      isValid = false;
    }
  });
  
  if (!isValid) {
    validationError.innerHTML = `❌ <strong>Validation Errors:</strong><br>• ${errorMessages.join('<br>• ')}`;
    validationError.classList.remove('hidden');
    setTimeout(() => {
      validationError.classList.add('hidden');
    }, 5000);
  } else {
    validationError.classList.add('hidden');
  }
  
  return isValid;
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (sessionStartTime) {
      const elapsed = new Date() - sessionStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      const timerElement = document.getElementById('sessionTimer');
      if (timerElement) {
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }, 1000);
}

function formatNumber(num) {
  return num.toFixed(decimalPlacesCount);
}

function updateSuperSummary() {
  document.getElementById('superProfit').textContent = formatNumber(superTotalProfit);
  document.getElementById('superLoss').textContent = formatNumber(superTotalLoss);
  document.getElementById('superNet').textContent = formatNumber(superTotalProfit - superTotalLoss);
  document.getElementById('superBets').textContent = superTotalBets;
  
  // Update currency symbols
  document.getElementById('superProfitCurrency').textContent = currentCurrency;
  document.getElementById('superLossCurrency').textContent = currentCurrency;
  document.getElementById('superNetCurrency').textContent = currentCurrency;
}

function switchTab(tabName) {
  // Hide validation error when switching tabs
  const validationError = document.getElementById('validationError');
  if (validationError) {
    validationError.classList.add('hidden');
  }
  
  // Remove active class from all tabs and content
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to selected tab and content
  document.getElementById(tabName + 'Tab').classList.add('active');
  document.getElementById(tabName + 'Content').classList.add('active');
}
