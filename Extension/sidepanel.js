document.addEventListener("DOMContentLoaded", () => {
  const betAmount = document.getElementById("betAmount");
  const cashoutAt = document.getElementById("cashoutAt");
  const onLoss = document.getElementById("onLoss");
  const onWin = document.getElementById("onWin");
  const crashAt = document.getElementById("crashAt");
  const crashTimes = document.getElementById("crashTimes");
  const saveBtn = document.getElementById("saveBtn");

  const gameSidebar = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar"
  );
  const StartBetButton = document.querySelector(
    "[data-testid='game-frame'] .game-sidebar > button"
  );
  const statusSpan = StartBetButton.querySelector("span");
  const betAmountInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='input-game-amount']"
  );
  const profitInput = document.querySelector(
    "[data-testid='game-frame'] [data-testid='profit-input']"
  );
  const cashoutInput = [
    ...gameSidebar.querySelectorAll("label span[slot='label']"),
  ]
    .find((el) => el.textContent.trim() === "Cashout At")
    ?.closest("label")
    ?.querySelector("input");


  // saveBtn.addEventListener("click", () => {
  //   const betData = {
  //     amount: betAmount.value,
  //     cashout: cashoutInput.value,
  //     loss: onLoss.value,
  //     win: onWin.value,
  //     stopCrashAt: crashAt.value,
  //     stopCrashTimes: crashTimes.value,
  //   };
  //   chrome.storage.local.set({ betData }, () => {
  //     console.log("Bet started with stop rules");
  //   });
  // });
});
