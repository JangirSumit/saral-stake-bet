// Configuration management
let savedConfigs = {};
let currentConfigName = null;

// Load saved configurations on startup
chrome.storage.local.get(['savedConfigs', 'currentConfigName'], (result) => {
  if (result.savedConfigs) {
    savedConfigs = result.savedConfigs;
    updateConfigDropdown();
  }
  if (result.currentConfigName) {
    currentConfigName = result.currentConfigName;
    document.getElementById('configSelect').value = currentConfigName;
  }
});

// Export configuration
document.getElementById('exportBtn').addEventListener('click', () => {
  const select = document.getElementById('configSelect');
  const selectedName = select.value;
  const config = getCurrentConfig();
  const dataStr = JSON.stringify(config, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  
  // Use config name if selected, otherwise use date
  const fileName = selectedName 
    ? `${selectedName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    : `stake-config-${new Date().toISOString().slice(0,10)}.json`;
  
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
});

// Import configuration
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        loadConfigToForm(config);
        showNotification('✅ Configuration imported successfully!');
      } catch (error) {
        showNotification('❌ Invalid configuration file!');
      }
    };
    reader.readAsText(file);
  }
});

// Save configuration
document.getElementById('saveConfigBtn').addEventListener('click', () => {
  const select = document.getElementById('configSelect');
  const selectedName = select.value;
  
  if (selectedName) {
    savedConfigs[selectedName] = getCurrentConfig();
    currentConfigName = selectedName;
    chrome.storage.local.set({savedConfigs, currentConfigName}, () => {
      showNotification(`✅ "${selectedName}" updated!`);
    });
  } else {
    showNotification('⚠️ Select a config to update!');
  }
});

// Save as new configuration
document.getElementById('saveNewBtn').addEventListener('click', () => {
  const name = prompt('Enter new configuration name:');
  
  if (name && name.trim()) {
    const trimmedName = name.trim();
    savedConfigs[trimmedName] = getCurrentConfig();
    currentConfigName = trimmedName;
    chrome.storage.local.set({savedConfigs, currentConfigName}, () => {
      updateConfigDropdown();
      document.getElementById('configSelect').value = trimmedName;
      showNotification(`✅ "${trimmedName}" saved!`);
    });
  }
});

// Delete configuration
document.getElementById('deleteConfigBtn').addEventListener('click', () => {
  const select = document.getElementById('configSelect');
  const name = select.value;
  
  if (name && confirm(`Delete "${name}"?`)) {
    delete savedConfigs[name];
    if (currentConfigName === name) currentConfigName = null;
    chrome.storage.local.set({savedConfigs, currentConfigName}, () => {
      updateConfigDropdown();
      select.value = '';
      showNotification(`✅ "${name}" deleted!`);
    });
  }
});

// Load configuration on select
document.getElementById('configSelect').addEventListener('change', (e) => {
  const name = e.target.value;
  if (name && savedConfigs[name]) {
    loadConfigToForm(savedConfigs[name], name);
    showNotification(`🔄 Loaded "${name}"!`);
  }
});

function getCurrentConfig() {
  return {
    BetAmount: parseFloat(document.getElementById('betAmount').value) || 0,
    CashoutAt: parseFloat(document.getElementById('cashoutAt').value) || 0,
    OnLoss: parseFloat(document.getElementById('onLoss').value) || 0,
    OnWin: parseFloat(document.getElementById('onWin').value) || 0,
    CrashAt: parseFloat(document.getElementById('crashAt').value) || 0,
    CrashTimes: parseInt(document.getElementById('crashTimes').value) || 0,
    ResumeAt: parseFloat(document.getElementById('resumeAt').value) || 0,
    ResumeAdjust: parseFloat(document.getElementById('resumeAdjust').value) || 0,
    ResumeBelowAt: parseFloat(document.getElementById('resumeBelowAt').value) || 0,
    ResumeBelowTimes: parseInt(document.getElementById('resumeBelowTimes').value) || 0,
    ResetThreshold: parseFloat(document.getElementById('resetThreshold').value) || 0,
    ProfitTimes: parseInt(document.getElementById('profitTimes').value) || 0,
    LossResetAmount: parseFloat(document.getElementById('lossResetAmount').value) || 0,
    WalletStopLoss: parseFloat(document.getElementById('walletStopLoss').value) || 0,
    DecimalPlaces: parseInt(document.getElementById('decimalPlaces').value) || 0
  };
}

function loadConfigToForm(config, configName = null) {
  document.getElementById('betAmount').value = config.BetAmount || config.amount || '';
  document.getElementById('cashoutAt').value = config.CashoutAt || config.cashout || '';
  document.getElementById('onLoss').value = config.OnLoss || config.onLoss || '';
  document.getElementById('onWin').value = config.OnWin || config.onWin || '';
  document.getElementById('crashAt').value = config.CrashAt || config.crashAt || '';
  document.getElementById('crashTimes').value = config.CrashTimes || config.crashTimes || '';
  document.getElementById('resumeAt').value = config.ResumeAt || config.resumeAt || '';
  document.getElementById('resumeAdjust').value = config.ResumeAdjust || config.resumeAdjust || '';
  document.getElementById('resumeBelowAt').value = config.ResumeBelowAt || config.resumeBelowAt || '';
  document.getElementById('resumeBelowTimes').value = config.ResumeBelowTimes || config.resumeBelowTimes || '';
  document.getElementById('resetThreshold').value = config.ResetThreshold || config.resetThreshold || '';
  document.getElementById('profitTimes').value = config.ProfitTimes || config.profitTimes || '';
  document.getElementById('lossResetAmount').value = config.LossResetAmount || config.lossResetAmount || '';
  document.getElementById('walletStopLoss').value = config.WalletStopLoss || config.walletStopLoss || '';
  document.getElementById('decimalPlaces').value = config.DecimalPlaces || config.decimalPlaces || '';
  
  if (configName) {
    currentConfigName = configName;
    chrome.storage.local.set({currentConfigName});
    stopAndResetGame();
  }
}

function updateConfigDropdown() {
  const select = document.getElementById('configSelect');
  const currentValue = select.value;
  
  select.innerHTML = '<option value="">Select configuration...</option>';
  Object.keys(savedConfigs).sort().forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  
  if (currentValue && savedConfigs[currentValue]) {
    select.value = currentValue;
  }
}

function showNotification(message) {
  const notification = document.getElementById('betNotification');
  if (notification) {
    notification.textContent = message;
    notification.className = 'bet-notification placed';
    notification.classList.remove('hidden');
    setTimeout(() => notification.classList.add('hidden'), 3000);
  }
}



function stopAndResetGame() {
  // Stop auto betting
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "stopAutoBet"
    });
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "resetGameVariables"
    });
  });
  
  // Update UI to stopped state
  const startStopBtn = document.getElementById('startStopBtn');
  if (startStopBtn) {
    startStopBtn.textContent = '▶️ Start';
    startStopBtn.className = 'btn-stopped';
  }
  
  // Reset sidepanel variables
  if (typeof autoBettingActive !== 'undefined') {
    autoBettingActive = false;
  }
  if (typeof timerInterval !== 'undefined' && timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (typeof totalProfit !== 'undefined') {
    totalProfit = 0;
    totalLoss = 0;
    profitHistory = [];
    cycleBets = 0;
    if (typeof updateProfitGraph === 'function') updateProfitGraph();
    if (typeof updateCycleDisplay === 'function') updateCycleDisplay();
  }
  
  showNotification('⚠️ Game stopped - Start manually with new config');
}

function resetGameVariables() {
  // Reset all game tracking variables when switching configs
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "resetGameVariables"
    });
  });
  
  // Reset sidepanel variables if available
  if (typeof totalProfit !== 'undefined') {
    totalProfit = 0;
    totalLoss = 0;
    profitHistory = [];
    cycleBets = 0;
    if (typeof updateProfitGraph === 'function') updateProfitGraph();
    if (typeof updateCycleDisplay === 'function') updateCycleDisplay();
  }
}