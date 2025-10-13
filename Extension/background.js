chrome.action.onClicked.addListener((tab) => {
  // Navigate to crash game if not already there
  if (!tab.url.includes('stake.bet/casino/games/crash')) {
    chrome.tabs.update(tab.id, {
      url: 'https://stake.bet/casino/games/crash'
    }, () => {
      chrome.sidePanel.open({ windowId: tab.windowId });
    });
  } else {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});