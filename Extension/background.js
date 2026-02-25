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

chrome.action.onClicked.addListener((tab) => {
  // Navigate to crash game if not already there
  if (!isCrashGameUrl(tab.url)) {
    const crashUrl = buildCrashGameUrl(tab.url);
    if (!crashUrl) {
      chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    }
    chrome.tabs.update(tab.id, {
      url: crashUrl
    }, () => {
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  } else {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
