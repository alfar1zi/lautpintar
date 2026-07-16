console.log('LautPintar loaded');

let currentUser = null;
let currentHarbor = null;
let currentCoords = null;

function initApp() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', initApp);
