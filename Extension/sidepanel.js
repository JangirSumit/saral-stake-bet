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
  const saveBtn = document.getElementById("saveBtn");
  const resetBetBtn = document.getElementById("resetBetBtn");

  const startStopBtn = document.getElementById("startStopBtn");
  let isRunning = false;

  // Add collapse/expand functionality
  document
    .getElementById("configHeader")
    .addEventListener("click", () => togglePanel("config"));
  document
    .getElementById("stopHeader")
    .addEventListener("click", () => togglePanel("stop"));
  document
    .getElementById("resumeHeader")
    .addEventListener("click", () => togglePanel("resume"));
  document
    .getElementById("resetHeader")
    .addEventListener("click", () => togglePanel("reset"));

  saveBtn.addEventListener("click", () => {
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
      };

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

    if (statusText && statusDot && startStopBtn) {
      statusText.textContent = `Status: ${message.data.buttonText}`;
      if (message.data.buttonText === "Ready") {
        statusDot.className = "status-dot red";
        statusDot.title = "Not Connected";
        startStopBtn.disabled = true;
        startStopBtn.style.opacity = "0.5";
      } else {
        statusDot.className = "status-dot green";
        statusDot.title = "Connected";
        startStopBtn.disabled = false;
        startStopBtn.style.opacity = "1";
      }
    }
  }

  if (message.action === "showBetStatus") {
    showBetNotification(message.data);
  }

  if (message.action === "updateCurrentBetAmount") {
    const currentBetElement = document.getElementById("currentBetAmount");
    if (currentBetElement) {
      currentBetElement.textContent = `Next Bet: ₹${message.data.amount}`;
    }
  }
});

function showBetNotification(data) {
  const notification = document.getElementById("betNotification");

  if (!notification) return;

  if (data.type === "placed") {
    notification.textContent = `💰 Bet Placed: ₹${data.amount} @ ${data.cashout}x`;
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

  let status, details, colorClass;
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
  }

  item.classList.add(colorClass);

  item.innerHTML = `
    <div class="history-title">Crashed at ${data.crashValue}, ${status}</div>
    <div class="history-details">${details}</div>
    <div class="history-time">${data.timestamp}</div>
  `;

  historyList.insertBefore(item, historyList.firstChild);
  console.log("History item added to DOM");

  // Keep only last 50 items
  while (historyList.children.length > 50) {
    historyList.removeChild(historyList.lastChild);
  }
}

function togglePanel(panelId) {
  const content = document.getElementById(panelId + "Content");
  const toggle = document.getElementById(panelId + "Toggle");

  if (content.classList.contains("collapsed")) {
    content.classList.remove("collapsed");
    toggle.classList.remove("collapsed");
  } else {
    content.classList.add("collapsed");
    toggle.classList.add("collapsed");
  }
}
