document.addEventListener("DOMContentLoaded", () => {
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const crashAt = document.getElementById("crashAt");
  const crashTimes = document.getElementById("crashTimes");
  const resumeAt = document.getElementById("resumeAt");
  const saveBtn = document.getElementById("saveBtn");

  const startStopBtn = document.getElementById("startStopBtn");
  let isRunning = false;

  saveBtn.addEventListener("click", () => {
    const betData = {
      amount: betAmount.value,
      cashout: cashoutAt.value,
      loss: onLoss.value,
      win: onWin.value,
      stopCrashAt: crashAt.value,
      stopCrashTimes: crashTimes.value,
      resumeAt: resumeAt.value,
    };

    chrome.storage.local.set({ betData });
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
    const statusElement = document.getElementById("buttonStatus");
    if (statusElement) {
      statusElement.textContent = `Status: ${message.data.buttonText}`;
    }
  }
});

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
    const won = data.isWin || parseFloat(data.crashValue) >= parseFloat(data.cashoutAt);
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

  // Keep only last 100 items
  while (historyList.children.length > 100) {
    historyList.removeChild(historyList.lastChild);
  }
}
