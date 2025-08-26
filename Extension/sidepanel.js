document.addEventListener("DOMContentLoaded", () => {
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const saveBtn = document.getElementById("saveBtn");
  const dataDiv = document.getElementById("data");

  saveBtn.addEventListener("click", () => {
    const betData = {
      amount: betAmount.value,
      cashout: cashoutAt.value,
      loss: onLoss.value,
      win: onWin.value,
    };
    chrome.storage.local.set({ betData }, () => {
      dataDiv.innerHTML = `<span class="amount">🎯 Bet Saved:</span> $${betData.amount}`;
      betAmount.value = cashoutAt.value = onLoss.value = onWin.value = "";
    });
  });
});
