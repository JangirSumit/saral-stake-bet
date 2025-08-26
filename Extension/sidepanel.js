document.addEventListener('DOMContentLoaded', () => {
  const dataInput = document.getElementById('dataInput');
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const dataDiv = document.getElementById('data');

  saveBtn.addEventListener('click', () => {
    const data = dataInput.value;
    if (data) {
      chrome.storage.local.set({ betData: data }, () => {
        dataDiv.innerHTML = `<span class="amount">🎯 Bet Saved:</span> ${data}`;
        dataInput.value = '';
      });
    }
  });

  loadBtn.addEventListener('click', () => {
    chrome.storage.local.get(['betData'], (result) => {
      dataDiv.innerHTML = result.betData ? `<span class="amount">💲 Last Bet:</span> ${result.betData}` : '🚫 No betting history found';
    });
  });
});