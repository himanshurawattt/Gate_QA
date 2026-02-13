// content.js — Injected into webpages to create/toggle the floating calculator

(function () {
  const calcId = 'tcs-calculator-container';
  const existing = document.getElementById(calcId);

  if (existing) {
    existing.remove();
    chrome.storage.local.set({ calcOpen: false });
    return;
  }

  const container = document.createElement('div');
  container.id = calcId;
  const calcUrl = chrome.runtime.getURL('calculator.html');
  // Header with Help button removed
  container.innerHTML = `
    <div id="tcs-calc-header">
      <span id="tcs-calc-title">TCS Scientific Calculator</span>
      <div id="tcs-calc-controls">
        <button id="tcs-calc-minimize" class="win-ctrl" title="Minimize">─</button>
        <button id="tcs-calc-close" class="win-ctrl" title="Close">✕</button>
      </div>
    </div>
    <div id="tcs-calc-iframe-wrap">
      <iframe 
        id="tcs-calc-iframe"
        src="${calcUrl}"
        frameborder="0"
        scrolling="no"
      ></iframe>
    </div>
  `;

  // ... (style object assign remains same) ...
  Object.assign(container.style, {
    position: 'fixed',
    width: '460px',
    height: '290px',
    zIndex: '2147483647',
    backgroundColor: '#f0f0f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    borderRadius: '4px',
    overflow: 'hidden',
    top: '50px',
    right: '50px'
  });

  document.documentElement.appendChild(container);

  // Prevent clicks inside calculator from bubbling to page (conceptually safer)
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  container.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Save open state and tab id
  chrome.storage.local.set({ calcOpen: true });
  chrome.runtime.sendMessage({ action: 'saveTabId' });

  // Inject styles (Help styles removed)
  const style = document.createElement('style');
  style.textContent = `
    /* Header Styles */
    #tcs-calc-header {
      background: linear-gradient(to bottom, #73A6F7, #2E7BE8);
      color: #fff;
      padding: 0 10px;
      height: 32px;
      cursor: move;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
      font-family: Arial, sans-serif;
    }
    #tcs-calc-title {
      font-weight: 400;
      font-size: 13px;
    }
    #tcs-calc-controls {
      display: flex;
      gap: 0;
      align-items: center;
      height: 100%;
    }
    /* Window Controls */
    .win-ctrl {
      background: transparent;
      border: none;
      color: #fff;
      width: 32px;
      height: 32px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      transition: background 0.1s;
    }
    .win-ctrl:hover { background: rgba(255,255,255,0.2); }
    #tcs-calc-close:hover { background: #E81123 !important; }

    #tcs-calc-iframe-wrap {
      width: 100%;
      height: calc(100% - 32px);
      background: #f0f0f0;
    }
    #tcs-calc-iframe { width: 100%; height: 100%; border: none; }

    #tcs-calculator-container.minimized { height: 32px !important; }
    #tcs-calculator-container.minimized #tcs-calc-iframe-wrap { display: none; }
  `;
  document.head.appendChild(style);

  // Restore saved position
  chrome.storage.local.get('calcPosition', (data) => {
    if (data.calcPosition) {
      container.style.top = data.calcPosition.top;
      container.style.left = data.calcPosition.left;
      container.style.right = 'auto';
    }
  });

  // Drag functionality
  const header = document.getElementById('tcs-calc-header');
  let isDragging = false, initialX, initialY;

  header.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    initialX = e.clientX - container.offsetLeft;
    initialY = e.clientY - container.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      e.preventDefault();
      container.style.left = (e.clientX - initialX) + 'px';
      container.style.top = (e.clientY - initialY) + 'px';
      container.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      chrome.storage.local.set({
        calcPosition: {
          top: container.style.top,
          left: container.style.left
        }
      });
    }
  });

  // Close & Minimize (Help listener removed)
  document.getElementById('tcs-calc-close').addEventListener('click', () => {
    container.remove();
    chrome.storage.local.set({ calcOpen: false });
  });
  document.getElementById('tcs-calc-minimize').addEventListener('click', () => {
    container.classList.toggle('minimized');
  });
})();
