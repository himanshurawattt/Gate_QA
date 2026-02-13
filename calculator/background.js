// background.js — Opens calculator in a standalone popup window

let calcWindowId = null;

// Check if the calculator window is still open
async function isCalcWindowOpen() {
  if (!calcWindowId) return false;
  try {
    const win = await chrome.windows.get(calcWindowId);
    return !!win;
  } catch {
    calcWindowId = null;
    return false;
  }
}

// Toggle calculator window on icon click
chrome.action.onClicked.addListener(async () => {
  const isOpen = await isCalcWindowOpen();

  if (isOpen) {
    // Focus the existing window
    chrome.windows.update(calcWindowId, { focused: true });
  } else {
    // Create a new popup window
    const win = await chrome.windows.create({
      url: chrome.runtime.getURL('calculator.html'),
      type: 'popup',
      width: 480,
      height: 280,
      top: 100,
      left: 100
    });
    calcWindowId = win.id;
  }
});

// Alt+C keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-calculator') {
    const isOpen = await isCalcWindowOpen();

    if (isOpen) {
      chrome.windows.remove(calcWindowId);
      calcWindowId = null;
    } else {
      const win = await chrome.windows.create({
        url: chrome.runtime.getURL('calculator.html'),
        type: 'popup',
        width: 480,
        height: 200,
        top: 100,
        left: 100
      });
      calcWindowId = win.id;
    }
  }
});

// Clean up when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === calcWindowId) {
    calcWindowId = null;
  }
});
