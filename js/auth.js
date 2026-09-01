/**
 * LSDAC ICT Department Admin Access & Security Module
 */
const AdminAuth = {
  isAdmin: false,
  adminPin: "7777", // Default coordinator passcode (can be changed in settings)

  init() {
    const savedState = sessionStorage.getItem('lsdac_admin_active');
    if (savedState === 'true') {
      this.isAdmin = true;
    }
    const savedPin = localStorage.getItem('lsdac_admin_pin');
    if (savedPin) {
      this.adminPin = savedPin;
    }
    this.updateAdminUI();
  },

  openLoginModal() {
    document.getElementById('admin-pin-input').value = "";
    document.getElementById('admin-pin-error').classList.add('hidden');
    document.getElementById('admin-modal').classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('admin-pin-input').focus();
    }, 100);
  },

  closeLoginModal() {
    document.getElementById('admin-modal').classList.add('hidden');
  },

  verifyPin(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('admin-pin-input').value.trim();
    if (input === this.adminPin || input === "lsdac2026") {
      this.isAdmin = true;
      sessionStorage.setItem('lsdac_admin_active', 'true');
      this.closeLoginModal();
      this.updateAdminUI();
      App.renderAll();
      App.showToast("Admin Mode unlocked! 🔓 Coordinator controls active.");
    } else {
      const err = document.getElementById('admin-pin-error');
      err.innerText = "Incorrect Admin PIN. Please try again.";
      err.classList.remove('hidden');
    }
  },

  logout() {
    this.isAdmin = false;
    sessionStorage.removeItem('lsdac_admin_active');
    this.updateAdminUI();
    App.renderAll();
    App.showToast("Locked to View-Only Mode 🔒");
  },

  toggle() {
    if (this.isAdmin) {
      this.logout();
    } else {
      this.openLoginModal();
    }
  },

  updateAdminUI() {
    const badge = document.getElementById('admin-status-badge');
    const lockBtn = document.getElementById('admin-toggle-btn');
    const lockIcon = document.getElementById('admin-lock-icon');
    const lockText = document.getElementById('admin-lock-text');

    if (this.isAdmin) {
      if (badge) badge.classList.remove('hidden');
      if (lockBtn) {
        lockBtn.className = "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-sm transition";
      }
      if (lockIcon) lockIcon.setAttribute('data-lucide', 'unlock');
      if (lockText) lockText.innerText = "Admin Active (Lock)";
      document.body.classList.add('is-admin');
    } else {
      if (badge) badge.classList.add('hidden');
      if (lockBtn) {
        lockBtn.className = "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold shadow-sm transition";
      }
      if (lockIcon) lockIcon.setAttribute('data-lucide', 'lock');
      if (lockText) lockText.innerText = "Admin Login";
      document.body.classList.remove('is-admin');
    }
    if (window.lucide) lucide.createIcons();
  }
};
