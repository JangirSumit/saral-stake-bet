// Profit tracking variables (global scope)
let totalProfit = 0;
let totalLoss = 0;
let profitHistory = [];
let canvas, ctx;
let skipNextHistoryUpdate = false;
let autoBettingActive = false;
let sessionStartTime = null;
let timerInterval = null;
let cycleStartTime = null;
let cycleTimerInterval = null;
let cycleBets = 0;
let superTotalProfit = 0;
let superTotalLoss = 0;
let superTotalBets = 0;
let maxSubSessionLoss = 0;
let decimalPlacesCount = 0;
let currentCurrency = '$';

function isCrashGameUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes("/casino/games/crash") || parsed.pathname.endsWith("/crash");
  } catch {
    return false;
  }
}

function buildCrashGameUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/casino/games/crash`;
  } catch {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Auto-navigate to crash game when sidepanel opens
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && !isCrashGameUrl(currentTab.url)) {
      const crashUrl = buildCrashGameUrl(currentTab.url);
      if (!crashUrl) return;
      chrome.tabs.update(currentTab.id, {
        url: crashUrl
      });
    }
  });
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const crashAt = document.getElementById("crashAt");
  const crashTimes = document.getElementById("crashTimes");
  const resumeAt = document.getElementById("resumeAt");
  const resumeAdjust = document.getElementById("resumeAdjust");
  const resumeBelowAt = document.getElementById("resumeBelowAt");
  const resumeBelowTimes = document.getElementById("resumeBelowTimes");
  const resetThreshold = document.getElementById("resetThreshold");
  const profitTimes = document.getElementById("profitTimes");
  const lossResetAmount = document.getElementById("lossResetAmount");
  const walletStopLoss = document.getElementById("walletStopLoss");
  const decimalPlaces = document.getElementById("decimalPlaces");
  // const resetBetBtn = document.getElementById("resetBetBtn");
  const screenshotBtn = document.getElementById("screenshotBtn");
  const downloadLogsBtn = document.getElementById("downloadLogsBtn");

  const startStopBtn = document.getElementById("startStopBtn");
  let isRunning = false;
  
  // Initialize canvas and context
  canvas = document.getElementById('profitChart');
  ctx = canvas.getContext('2d');

  // Tab switching functionality
  document.getElementById("settingsTab").addEventListener("click", () => switchTab("settings"));
  document.getElementById("historyTab").addEventListener("click", () => switchTab("history"));
  document.getElementById("helpTab").addEventListener("click", () => switchTab("help"));
  
  // Help panel toggle functionality
  document.querySelectorAll('.panel-header').forEach(header => {
    header.addEventListener('click', () => {
      const panelName = header.getAttribute('data-panel');
      if (panelName) {
        togglePanel(panelName);
      }
    });
  });
  
  // Initialize dialog functionality
  initializeDialog();
  
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
      if (data.resumeBelowAt) resumeBelowAt.value = data.resumeBelowAt;
      if (data.resumeBelowTimes) resumeBelowTimes.value = data.resumeBelowTimes;
      if (data.resetThreshold) resetThreshold.value = data.resetThreshold;
      if (data.profitTimes) profitTimes.value = data.profitTimes;
      if (data.lossResetAmount) lossResetAmount.value = data.lossResetAmount;
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


  /*
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
  */

  screenshotBtn.addEventListener("click", () => {
    takeSidepanelScreenshot();
  });

  downloadLogsBtn.addEventListener("click", () => {
    downloadConsoleLogs();
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
      startStopBtn.textContent = "⏹️ Stop";
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
        resumeBelowAt: resumeBelowAt.value,
        resumeBelowTimes: resumeBelowTimes.value,
        resetThreshold: resetThreshold.value,
        profitTimes: profitTimes.value,
        lossResetAmount: lossResetAmount.value,
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
      startStopBtn.textContent = "▶️ Start";
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
  }
  
  if (message.action === "updateWalletBalance") {
    const walletElement = document.getElementById("walletBalance");
    if (walletElement) {
      const balance = parseFloat(message.data.balance).toFixed(decimalPlacesCount);
      currentCurrency = message.data.currency || '$';
      walletElement.textContent = `Balance: ${currentCurrency}${balance}`;
      // Update all displays with new currency
    }
  }

  if (message.action === "resetProfitTracking") {
    // Only reset if auto betting is active
    if (autoBettingActive) {
      totalProfit = 0;
      totalLoss = 0;
      profitHistory = [];
      skipNextHistoryUpdate = true;
      
      // Reset cycle tracking
      cycleBets = 0;
      cycleStartTime = new Date();
      startCycleTimer();
      
      // Update display
      updateProfitGraph();
      updateCycleDisplay();
      console.log("Profit tracking reset - starting fresh cycle");
    }
  }
  
  if (message.action === "sessionStarted") {
    sessionStartTime = new Date(message.data.startTime);
    superTotalProfit = 0;
    superTotalLoss = 0;
    superTotalBets = 0;
    maxSubSessionLoss = 0;
    totalProfit = 0;
    totalLoss = 0;
    profitHistory = [];
    updateSuperSummary();
    updateProfitGraph();
    startTimer();
  }
  
  if (message.action === "updateSuperData") {
    console.log("Received super data update:", message.data);
    superTotalProfit = message.data.superProfit;
    superTotalLoss = message.data.superLoss;
    superTotalBets = message.data.superBets;
    updateSuperSummary();
  }
  
  if (message.action === "updateSubSessionData") {
    document.getElementById('subResets').textContent = message.data.resets;
    updateResetsList(message.data.lossDetails);
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
      startStopBtn.textContent = "▶️ Start";
      startStopBtn.className = "btn-stopped";
    }
    autoBettingActive = false;
    
    // Stop timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  if (message.action === "connectionLost") {
    const notification = document.getElementById("betNotification");
    if (notification) {
      notification.textContent = "⚠️ Connection lost - Auto betting stopped";
      notification.className = "bet-notification error";
      notification.classList.remove("hidden");
    }
    
    // Stop the betting interface
    const startStopBtn = document.getElementById("startStopBtn");
    if (startStopBtn) {
      startStopBtn.textContent = "▶️ Start";
      startStopBtn.className = "btn-stopped";
    }
    autoBettingActive = false;
    
    // Stop timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  
  if (message.action === "refreshRequired") {
    const notification = document.getElementById("betNotification");
    if (notification) {
      notification.textContent = "🔄 Page refreshing - Bet button disabled";
      notification.className = "bet-notification error";
      notification.classList.remove("hidden");
    }
  }
  
  if (message.action === "sessionRestored") {
    const notification = document.getElementById("betNotification");
    if (notification) {
      notification.textContent = "⚙️ Session restored - Auto betting resumed";
      notification.className = "bet-notification placed";
      notification.classList.remove("hidden");
      setTimeout(() => notification.classList.add("hidden"), 3000);
    }
    
    // Update UI with restored state
    if (message.data.startTime) {
      sessionStartTime = new Date(message.data.startTime);
      startTimer();
    }
    
    const currentBetElement = document.getElementById("currentBetAmount");
    if (currentBetElement && message.data.currentBetAmount) {
      currentBetElement.textContent = `Next Bet: $${message.data.currentBetAmount}`;
    }
  }
  
  if (message.action === "updateRefreshData") {
    document.getElementById('totalRefreshes').textContent = message.data.refreshes;
    updateRefreshList(message.data.refreshDetails);
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
    details = `Bet: ${currentCurrency}${data.betAmount} | Cashout: ${data.cashoutAt}x`;
    colorClass = won ? "history-win" : "history-loss";
    
    // Calculate profit/loss
    if (won) {
      profitLoss = (parseFloat(data.betAmount) * parseFloat(data.cashoutAt)) - parseFloat(data.betAmount);
    } else {
      profitLoss = -parseFloat(data.betAmount);
    }
    
    // Only update cycle tracking if auto betting is active
    if (autoBettingActive && !data.skipped) {
      // Skip profit tracking update if we just reset
      if (skipNextHistoryUpdate) {
        skipNextHistoryUpdate = false;
        console.log("Skipping profit calculation for reset bet");
      } else {
        if (won) {
          totalProfit += profitLoss;
        } else {
          totalLoss += Math.abs(profitLoss);
        }
        cycleBets++;
        
        // Update profit history for graph
        profitHistory.push(totalProfit - totalLoss);
        
        // Track max loss across sub-sessions
        const currentNet = totalProfit - totalLoss;
        if (currentNet < maxSubSessionLoss) {
          maxSubSessionLoss = currentNet;
        }
        
        updateProfitGraph();
        updateCycleDisplay();
      }
    }
  }

  item.classList.add(colorClass);

  const profitLossText = data.skipped ? '' : `<div class="history-profit ${profitLoss >= 0 ? 'profit' : 'loss'}">${profitLoss >= 0 ? '+' : ''}${currentCurrency}${formatNumber(Math.abs(profitLoss))}</div>`;

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
  console.log("updating super summary", superTotalProfit, superTotalLoss, superTotalBets);

  document.getElementById('superProfit').textContent = formatNumber(superTotalProfit);
  document.getElementById('superLoss').textContent = formatNumber(superTotalLoss);
  document.getElementById('maxLoss').textContent = formatNumber(Math.abs(maxSubSessionLoss));
  document.getElementById('superNet').textContent = formatNumber(superTotalProfit - superTotalLoss);
  document.getElementById('superBets').textContent = superTotalBets;
  
  // Update currency symbols
  document.getElementById('superProfitCurrency').textContent = currentCurrency;
  document.getElementById('superLossCurrency').textContent = currentCurrency;
  document.getElementById('maxLossCurrency').textContent = currentCurrency;
  document.getElementById('superNetCurrency').textContent = currentCurrency;
}

function takeSidepanelScreenshot() {
  showScreenshotFallback();
}

function showScreenshotFallback() {
  let csvContent = 'BETTING SESSION REPORT\n';
  csvContent += `Session Started,${sessionStartTime ? sessionStartTime.toLocaleString() : 'Not Available'}\n`;
  csvContent += `Report Downloaded,${new Date().toLocaleString()}\n\n`;
  
  // Session Summary
  csvContent += 'SESSION SUMMARY\n';
  csvContent += `Session Time,${document.getElementById('sessionTimer')?.textContent || '00:00:00'}\n`;
  csvContent += `Wallet Balance,${document.getElementById('walletBalance')?.textContent || 'Balance: $0.00'}\n`;
  csvContent += `Total Profit,${document.getElementById('superProfitCurrency')?.textContent || '$'}${document.getElementById('superProfit')?.textContent || '0.00'}\n`;
  csvContent += `Total Loss,${document.getElementById('superLossCurrency')?.textContent || '$'}${document.getElementById('superLoss')?.textContent || '0.00'}\n`;
  csvContent += `Net Profit/Loss,${document.getElementById('superNetCurrency')?.textContent || '$'}${document.getElementById('superNet')?.textContent || '0.00'}\n`;
  csvContent += `Max Loss Reached,${document.getElementById('maxLossCurrency')?.textContent || '$'}${document.getElementById('maxLoss')?.textContent || '0.00'}\n`;
  csvContent += `Total Bets Placed,${document.getElementById('superBets')?.textContent || '0'}\n`;
  csvContent += `Sub-Session Resets,${document.getElementById('subResets')?.textContent || '0'}\n\n`;
  
  // Current Settings
  csvContent += 'CURRENT SETTINGS\n';
  csvContent += `Bet Amount,${document.getElementById('betAmount')?.value || 'Not Set'}\n`;
  csvContent += `Cashout At,${document.getElementById('cashoutAt')?.value || 'Not Set'}x\n`;
  csvContent += `On Loss %,${document.getElementById('onLoss')?.value || 'Not Set'}%\n`;
  csvContent += `On Win %,${document.getElementById('onWin')?.value || 'Not Set'}%\n`;
  csvContent += `Stop After Crash At,${document.getElementById('crashAt')?.value || 'Not Set'}x\n`;
  csvContent += `Stop After Times,${document.getElementById('crashTimes')?.value || 'Not Set'}\n`;
  csvContent += `Resume At Crash,${document.getElementById('resumeAt')?.value || 'Not Set'}x\n`;
  csvContent += `Resume Bet Adjust,${document.getElementById('resumeAdjust')?.value || 'Not Set'}%\n`;
  csvContent += `Reset Threshold,${document.getElementById('resetThreshold')?.value || 'Not Set'}%\n`;
  csvContent += `Profit Reset Times,${document.getElementById('profitTimes')?.value || 'Not Set'}\n`;
  csvContent += `Wallet Stop Loss,${document.getElementById('walletStopLoss')?.value || 'Not Set'}%\n`;
  csvContent += `Decimal Places,${document.getElementById('decimalPlaces')?.value || 'Not Set'}\n\n`;
  
  // Sub-Session Resets
  csvContent += 'SUB-SESSION RESETS\n';
  const subResets = document.getElementById('subResets')?.textContent || '0';
  csvContent += `Total Resets,${subResets}\n`;
  
  // Get reset details from dialog if available
  const lossDetailsList = document.getElementById('lossDetailsList');
  if (lossDetailsList && lossDetailsList.children.length > 0) {
    csvContent += 'Reset #,Time,Loss Amount,Bet Before,Bet After\n';
    Array.from(lossDetailsList.children).forEach(item => {
      const header = item.querySelector('.reset-header')?.textContent || '';
      const details = item.querySelector('.reset-details')?.textContent || '';
      
      // Parse reset number and time
      const resetMatch = header.match(/Reset #(\d+) - (.+)/);
      const resetNum = resetMatch ? resetMatch[1] : '';
      const resetTime = resetMatch ? resetMatch[2] : '';
      
      // Parse loss and bet amounts
      const lossMatch = details.match(/Loss: [\$₹]?([\d.]+)/);
      const betMatch = details.match(/Bet: [\$₹]?([\d.]+) → [\$₹]?([\d.]+)/);
      const lossAmount = lossMatch ? lossMatch[1] : '';
      const betBefore = betMatch ? betMatch[1] : '';
      const betAfter = betMatch ? betMatch[2] : '';
      
      csvContent += `${resetNum},${resetTime},${lossAmount},${betBefore},${betAfter}\n`;
    });
  }
  csvContent += '\n';
  
  // Betting History
  csvContent += 'BETTING HISTORY\n';
  csvContent += 'Time,Status,Crash Value,Bet Amount,Cashout Target,Profit/Loss,Details\n';
  
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    const time = item.querySelector('.history-time')?.textContent || '';
    const title = item.querySelector('.history-title')?.textContent || '';
    const details = item.querySelector('.history-details')?.textContent || '';
    const profitLoss = item.querySelector('.history-profit')?.textContent || '0.00';
    
    // Parse crash value and status from title
    const crashMatch = title.match(/Crashed at ([\d.]+)/);
    const crashValue = crashMatch ? crashMatch[1] : '';
    const status = title.includes('Won') ? 'Won' : title.includes('Lost') ? 'Lost' : 'Skipped';
    
    // Parse bet details
    const betMatch = details.match(/Bet: ([\$₹]?[\d.]+)/);
    const cashoutMatch = details.match(/Cashout: ([\d.]+)x/);
    const betAmount = betMatch ? betMatch[1] : '';
    const cashoutTarget = cashoutMatch ? cashoutMatch[1] + 'x' : '';
    
    csvContent += `${time},${status},${crashValue}x,${betAmount},${cashoutTarget},${profitLoss},"${details}"\n`;
  });
  
  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = `betting-report-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  const notification = document.getElementById("betNotification");
  if (notification) {
    notification.textContent = "📄 Complete report exported!";
    notification.className = "bet-notification placed";
    notification.classList.remove("hidden");
    setTimeout(() => notification.classList.add("hidden"), 3000);
  }
}

function startCycleTimer() {
  if (cycleTimerInterval) clearInterval(cycleTimerInterval);
  
  cycleTimerInterval = setInterval(() => {
    if (cycleStartTime) {
      const elapsed = new Date() - cycleStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      const timerElement = document.getElementById('cycleTimer');
      if (timerElement) {
        timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }, 1000);
}

function updateCycleDisplay() {
  const cycleBetsElement = document.getElementById('cycleBets');
  if (cycleBetsElement) {
    cycleBetsElement.textContent = cycleBets;
  }
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

// Global function for HTML onclick handlers
function togglePanel(panelName) {
  const content = document.getElementById(panelName + 'Content');
  const toggle = document.getElementById(panelName + 'Toggle');
  
  if (content && toggle) {
    content.classList.toggle('collapsed');
    toggle.classList.toggle('collapsed');
  }
}

function updateResetsList(lossDetails) {
  const lossDetailsList = document.getElementById('lossDetailsList');
  if (!lossDetailsList) return;
  
  lossDetailsList.innerHTML = '';
  
  if (lossDetails && lossDetails.length > 0) {
    lossDetails.forEach(reset => {
      const resetItem = document.createElement('div');
      resetItem.className = 'reset-item';
      resetItem.innerHTML = `
        <div class="reset-header">Reset #${reset.resetNumber} - ${reset.timestamp}</div>
        <div class="reset-details">Loss: ${currentCurrency}${formatNumber(reset.lossAmount)} | Bet: ${currentCurrency}${formatNumber(reset.betAmountBefore)} → ${currentCurrency}${formatNumber(reset.betAmountAfter)}</div>
      `;
      lossDetailsList.appendChild(resetItem);
    });
  } else {
    lossDetailsList.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">No loss resets yet</div>';
  }
}

function updateRefreshList(refreshDetails) {
  const refreshDetailsList = document.getElementById('refreshDetailsList');
  if (!refreshDetailsList) return;
  
  refreshDetailsList.innerHTML = '';
  
  if (refreshDetails && refreshDetails.length > 0) {
    refreshDetails.forEach(refresh => {
      const refreshItem = document.createElement('div');
      refreshItem.className = 'reset-item';
      
      let snapshotHtml = '';
      if (refresh.snapshot) {
        const sessionHours = Math.floor(refresh.snapshot.sessionTime / 3600);
        const sessionMins = Math.floor((refresh.snapshot.sessionTime % 3600) / 60);
        const sessionSecs = refresh.snapshot.sessionTime % 60;
        const sessionTimeStr = `${sessionHours.toString().padStart(2, '0')}:${sessionMins.toString().padStart(2, '0')}:${sessionSecs.toString().padStart(2, '0')}`;
        
        snapshotHtml = `
          <div class="reset-details">Reason: ${refresh.reason}</div>
          <div class="reset-details" style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
            Session: ${sessionTimeStr} | Profit: ${currentCurrency}${formatNumber(refresh.snapshot.superProfit)} | Loss: ${currentCurrency}${formatNumber(refresh.snapshot.superLoss)} | Bets: ${refresh.snapshot.superBets} | Next Bet: ${currentCurrency}${formatNumber(refresh.snapshot.currentBetAmount)}
          </div>
        `;
      } else {
        snapshotHtml = `<div class="reset-details">Reason: ${refresh.reason}</div>`;
      }
      
      refreshItem.innerHTML = `
        <div class="reset-header">Refresh #${refresh.refreshNumber} - ${refresh.timestamp}</div>
        ${snapshotHtml}
      `;
      refreshDetailsList.appendChild(refreshItem);
    });
  } else {
    refreshDetailsList.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">No page refreshes yet</div>';
  }
}

function downloadConsoleLogs() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "getConsoleLogs"
    }, (response) => {
      if (response && response.logs) {
        const logContent = response.logs.join('\n');
        const blob = new Blob([logContent], { type: 'text/plain' });
        const link = document.createElement('a');
        link.download = `console-logs-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        const notification = document.getElementById("betNotification");
        if (notification) {
          notification.textContent = "📋 Console logs downloaded!";
          notification.className = "bet-notification placed";
          notification.classList.remove("hidden");
          setTimeout(() => notification.classList.add("hidden"), 3000);
        }
      }
    });
  });
}

function initializeDialog() {
  const subResets = document.getElementById('subResets');
  const lossDialog = document.getElementById('lossDetailsDialog');
  const closeLossBtn = document.getElementById('closeLossDialog');
  
  const totalRefreshes = document.getElementById('totalRefreshes');
  const refreshDialog = document.getElementById('refreshDetailsDialog');
  const closeRefreshBtn = document.getElementById('closeRefreshDialog');
  
  if (subResets) {
    subResets.addEventListener('click', () => {
      if (lossDialog) {
        lossDialog.style.display = 'block';
      }
    });
  }
  
  if (totalRefreshes) {
    totalRefreshes.addEventListener('click', () => {
      if (refreshDialog) {
        refreshDialog.style.display = 'block';
      }
    });
  }
  
  if (closeLossBtn) {
    closeLossBtn.addEventListener('click', () => {
      if (lossDialog) {
        lossDialog.style.display = 'none';
      }
    });
  }
  
  if (closeRefreshBtn) {
    closeRefreshBtn.addEventListener('click', () => {
      if (refreshDialog) {
        refreshDialog.style.display = 'none';
      }
    });
  }
  
  if (lossDialog) {
    lossDialog.addEventListener('click', (e) => {
      if (e.target === lossDialog) {
        lossDialog.style.display = 'none';
      }
    });
  }
  
  if (refreshDialog) {
    refreshDialog.addEventListener('click', (e) => {
      if (e.target === refreshDialog) {
        refreshDialog.style.display = 'none';
      }
    });
  }
}
