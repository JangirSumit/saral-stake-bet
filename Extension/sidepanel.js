document.addEventListener("DOMContentLoaded", () => {
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const crashAt = document.getElementById("crashAt");
  const crashTimes = document.getElementById("crashTimes");
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
    };
    
    chrome.storage.local.set({ betData }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "fillBetData", data: betData });
      });
    });
  });

  startStopBtn.addEventListener("click", () => {
    isRunning = !isRunning;
    
    if (isRunning) {
      startStopBtn.textContent = "🛑 Stop Betting";
      startStopBtn.className = "btn-running";
    } else {
      startStopBtn.textContent = "🎯 Start Betting";
      startStopBtn.className = "btn-stopped";
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: isRunning ? "startAutoBet" : "stopAutoBet" 
      });
    });
  });
});
