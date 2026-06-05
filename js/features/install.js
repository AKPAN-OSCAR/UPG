// PWA Install Handler
let deferredPrompt = null;
let installButton = null;

function initInstallPrompt() {
  // Create install button if it doesn't exist in HTML
  installButton = document.getElementById('install-btn');
  
  if (!installButton) {
    // Dynamically inject button if you want it auto-created
    // Or skip this and just add <button id="install-btn"> to your HTML
    return;
  }

  // Hide button initially — only show when install is available
  installButton.style.display = 'none';

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User installed the PWA');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Reset — prompt can only be used once
    deferredPrompt = null;
    installButton.style.display = 'none';
  });
}

// Listen for the browser's install prompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Stop browser from auto-showing
  deferredPrompt = e;
  
  if (installButton) {
    installButton.style.display = 'block'; // Show your button
  }
});

// Hide button if app is already installed
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installButton) {
    installButton.style.display = 'none';
  }
  console.log('PWA was installed');
});

// Initialize
initInstallPrompt();
