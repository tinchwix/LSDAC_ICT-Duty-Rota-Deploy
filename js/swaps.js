/**
 * LSDAC ICT Duty Swap & Cover Request Module
 */
const SwapsModule = {
  renderSwapsList() {
    const db = StorageService.getData();
    const container = document.getElementById('swaps-list-container');
    if (!container) return;

    const swaps = db.swaps || [];
    const isAdmin = AdminAuth.isAdmin;

    if (swaps.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400 dark:text-slate-500">
          <i data-lucide="repeat" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
          <p class="text-sm font-medium">No pending swap requests</p>
          <p class="text-xs">If an ICT member is unavailable on their scheduled Sabbath, submit a swap request below.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = swaps.map(swap => {
      const requester = db.members.find(m => m.id === swap.requesterId);
      const replacement = db.members.find(m => m.id === swap.replacementId);
      const role = db.settings.roles.find(r => r.id === swap.roleId);

      const statusBadge = swap.status === 'Approved' 
        ? '<span class="px-2 py-0.5 text-[11px] rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> Approved</span>'
        : swap.status === 'Declined'
        ? '<span class="px-2 py-0.5 text-[11px] rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1"><i data-lucide="x-circle" class="w-3 h-3"></i> Declined</span>'
        : '<span class="px-2 py-0.5 text-[11px] rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> Pending</span>';

      return `
        <div class="glass-card p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div class="space-y-1 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-slate-900 dark:text-white text-sm">${requester?.name || 'Member'}</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-400"></i>
              <span class="font-bold text-blue-600 dark:text-blue-400 text-sm">${replacement?.name || 'Open Cover (Any qualified)'}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
              <span class="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                <i data-lucide="calendar" class="w-3 h-3 text-blue-600"></i> ${RotaEngine.formatReadableDate(swap.sabbathDate)}
              </span>
              <span class="flex items-center gap-1">
                <i data-lucide="tag" class="w-3 h-3"></i> ${role?.name || swap.roleId}
              </span>
            </div>
            ${swap.reason ? `<p class="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg mt-1">"${swap.reason}"</p>` : ''}
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            ${statusBadge}
            ${swap.status === 'Pending' ? (isAdmin ? `
              <button onclick="SwapsModule.approveSwap('${swap.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold shadow-sm transition">
                Approve
              </button>
              <button onclick="SwapsModule.declineSwap('${swap.id}')" class="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 active:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-semibold transition">
                Decline
              </button>
            ` : `
              <button onclick="AdminAuth.openLoginModal()" class="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                <i data-lucide="lock" class="w-3 h-3"></i> Admin to Approve
              </button>
            `) : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openRequestSwapModal() {
    const db = StorageService.getData();
    const requesterSelect = document.getElementById('swap-requester-select');
    const replacementSelect = document.getElementById('swap-replacement-select');
    const sabbathSelect = document.getElementById('swap-sabbath-select');
    const roleSelect = document.getElementById('swap-role-select');

    requesterSelect.innerHTML = db.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    replacementSelect.innerHTML = `<option value="">-- Open Cover (Any available) --</option>` + db.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    roleSelect.innerHTML = db.settings.roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

    const upcomingSabbaths = db.rotas.length > 0 
      ? db.rotas.map(r => r.date)
      : [RotaEngine.getNextAvailableSabbathDate()];

    sabbathSelect.innerHTML = upcomingSabbaths.map(d => `<option value="${d}">${RotaEngine.formatReadableDate(d)}</option>`).join('');

    document.getElementById('swap-reason').value = "";
    document.getElementById('swap-modal').classList.remove('hidden');
  },

  closeRequestSwapModal() {
    document.getElementById('swap-modal').classList.add('hidden');
  },

  async submitSwapRequest(e) {
    if (e) e.preventDefault();
    const db = StorageService.getData();

    const requesterId = document.getElementById('swap-requester-select').value;
    const replacementId = document.getElementById('swap-replacement-select').value;
    const sabbathDate = document.getElementById('swap-sabbath-select').value;
    const roleId = document.getElementById('swap-role-select').value;
    const reason = document.getElementById('swap-reason').value.trim();

    if (requesterId === replacementId && replacementId) {
      alert("Requester and replacement cannot be the same member.");
      return;
    }

    const swapEntry = {
      id: 'swap_' + Date.now(),
      requesterId,
      replacementId,
      sabbathDate,
      roleId,
      reason,
      status: 'Pending',
      timestamp: new Date().toISOString()
    };

    db.swaps = db.swaps || [];
    db.swaps.unshift(swapEntry);

    await StorageService.saveAll();
    this.closeRequestSwapModal();
    this.renderSwapsList();
    App.showToast("Swap request submitted! Awaiting coordinator approval.");
  },

  async approveSwap(swapId) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const swap = (db.swaps || []).find(s => s.id === swapId);
    if (!swap) return;

    swap.status = 'Approved';

    if (swap.replacementId) {
      const rota = db.rotas.find(r => r.date === swap.sabbathDate);
      if (rota && rota.assignments) {
        rota.assignments[swap.roleId] = swap.replacementId;
      }
    }

    await StorageService.saveAll();
    this.renderSwapsList();
    App.renderAll();
    App.showToast("Swap approved & Rota updated! 🎯");
  },

  async declineSwap(swapId) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const swap = (db.swaps || []).find(s => s.id === swapId);
    if (!swap) return;

    swap.status = 'Declined';
    await StorageService.saveAll();
    this.renderSwapsList();
    App.showToast("Swap request declined.");
  }
};
