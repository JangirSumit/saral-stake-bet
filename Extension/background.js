function isCrashGameUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const allowedHosts = new Set(["stake.ac", "stake.bet"]);
    return allowedHosts.has(parsed.hostname) && parsed.pathname.includes("/casino/games/crash");
  } catch {
    return false;
  }
}

function buildCrashGameUrl(url) {
  try {
    const parsed = new URL(url);
    const allowedHosts = new Set(["stake.ac", "stake.bet"]);
    if (!allowedHosts.has(parsed.hostname)) {
      return "https://stake.ac/casino/games/crash";
    }
    return `${parsed.origin}/casino/games/crash`;
  } catch {
    return "https://stake.ac/casino/games/crash";
  }
}

chrome.action.onClicked.addListener((tab) => {
  // Navigate to crash game if not already there
  if (!isCrashGameUrl(tab.url)) {
    const crashUrl = buildCrashGameUrl(tab.url);
    chrome.tabs.update(tab.id, {
      url: crashUrl
    }, () => {
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  } else {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
