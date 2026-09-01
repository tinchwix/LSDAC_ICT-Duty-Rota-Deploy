/**
 * LSDAC Media & Communication ICT Duty Rota - Core Application Controller
 * Optimized for Mobile Screens & Desktop Booth Displays
 */
const App = {
  currentTab: 'matrix',
  selectedDate: '2026-09-05',
  matrixMonthFilter: 'ALL',
  matrixSearchQuery: '',
  matrixDisplayMode: window.innerWidth < 768 ? 'cards' : 'table',

  async init() {
    AdminAuth.init();
    await StorageService.init();
    
    const db = StorageService.getData();
    const today = new Date();
    const upcomingSabbath = (db.rotas || []).find(r => new Date(r.date) >= new Date(today.setHours(0,0,0,0)));
    this.selectedDate = upcomingSabbath ? upcomingSabbath.date : (db.rotas[0]?.date || '2026-09-05');

    this.bindEvents();
    this.startSabbathCountdown();
    this.renderAll();
  },

  bindEvents() {
    // Dark mode toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('lsdac_theme', isDark ? 'dark' : 'light');
      });
      if (localStorage.getItem('lsdac_theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }

    // Search input for members
    const memberSearch = document.getElementById('member-search-input');
    if (memberSearch) {
      memberSearch.addEventListener('input', (e) => {
        MembersModule.renderMembersList(e.target.value);
      });
    }

    // Window resize listener
    window.addEventListener('resize', () => {
      if (window.innerWidth < 768 && this.matrixDisplayMode === 'table' && !this.userExplicitMode) {
        this.matrixDisplayMode = 'cards';
        this.updateModeButtons();
        this.renderMatrixTables();
      }
    });
  },

  setMatrixDisplayMode(mode) {
    this.matrixDisplayMode = mode;
    this.userExplicitMode = true;
    this.updateModeButtons();
    this.renderMatrixTables();
  },

  updateModeButtons() {
    const btnCards = document.getElementById('btn-mode-cards');
    const btnTable = document.getElementById('btn-mode-table');
    if (!btnCards || !btnTable) return;

    if (this.matrixDisplayMode === 'cards') {
      btnCards.className = "px-2 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs";
      btnTable.className = "px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 dark:text-slate-400";
    } else {
      btnTable.className = "px-2 py-1 rounded-md text-[11px] font-bold bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs";
      btnCards.className = "px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 dark:text-slate-400";
    }
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.getAttribute('data-tab');
      if (target === tabName) {
        link.classList.add('bg-blue-700', 'text-white', 'shadow-sm');
        link.classList.remove('text-slate-300', 'hover:bg-blue-800/60');
      } else {
        link.classList.remove('bg-blue-700', 'text-white', 'shadow-sm');
        link.classList.add('text-slate-300', 'hover:bg-blue-800/60');
      }
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = btn.getAttribute('data-tab');
      if (target === tabName) {
        btn.classList.add('text-blue-400', 'font-bold');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-blue-400', 'font-bold');
        btn.classList.add('text-slate-400');
      }
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.add('hidden');
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
      activeView.classList.remove('hidden');
    }

    this.renderAll();
  },

  renderAll() {
    this.updateModeButtons();
    this.renderDynamicMonthPills();
    this.renderMatrixTables();
    this.renderCurrentRotaView();
    this.renderMonthSelector();
    MembersModule.renderMembersList();
    SwapsModule.renderSwapsList();
    AdminAuth.updateAdminUI();
    if (window.lucide) lucide.createIcons();
  },

  renderDynamicMonthPills() {
    const container = document.getElementById('matrix-month-pills-container');
    if (!container) return;

    const db = StorageService.getData();
    const rotas = db.rotas || [];

    const monthsSet = new Set();
    rotas.forEach(r => {
      if (r.date) monthsSet.add(r.date.substring(0, 7));
    });

    const monthsArr = Array.from(monthsSet).sort();

    let html = `
      <button onclick="App.filterMatrixMonth('ALL')" class="px-2.5 py-1 rounded-lg text-xs font-bold ${
        this.matrixMonthFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
      } transition whitespace-nowrap">
        All (${rotas.length})
      </button>
    `;

    monthsArr.forEach(mStr => {
      const [y, m] = mStr.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const count = rotas.filter(r => r.date.startsWith(mStr)).length;
      const isSelected = this.matrixMonthFilter === mStr;

      html += `
        <button onclick="App.filterMatrixMonth('${mStr}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold ${
          isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
        } transition whitespace-nowrap">
          ${label} (${count})
        </button>
      `;
    });

    container.innerHTML = html;
  },

  filterMatrixMonth(filter) {
    this.matrixMonthFilter = filter;
    this.renderDynamicMonthPills();
    this.renderMatrixTables();
  },

  searchMatrix(query) {
    this.matrixSearchQuery = (query || '').toLowerCase().trim();
    this.renderMatrixTables();
  },

  renderMatrixTables() {
    const container = document.getElementById('matrix-tables-container');
    if (!container) return;

    const db = StorageService.getData();
    const rotas = db.rotas || [];
    const isAdmin = AdminAuth.isAdmin;

    const monthsGrouped = {};
    rotas.forEach(r => {
      const mKey = r.date.substring(0, 7);
      if (!monthsGrouped[mKey]) {
        const [y, m] = mKey.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
        monthsGrouped[mKey] = {
          key: mKey,
          title: dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase(),
          rotas: []
        };
      }
      monthsGrouped[mKey].rotas.push(r);
    });

    let monthsList = Object.values(monthsGrouped).sort((a, b) => a.key.localeCompare(b.key));
    if (this.matrixMonthFilter !== 'ALL') {
      monthsList = monthsList.filter(m => m.key === this.matrixMonthFilter);
    }

    const roleDefinitions = [
      { key: 'audio', label: 'Audio Console', icon: 'volume-2', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
      { key: 'switcher', label: 'Video Switcher', icon: 'video', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30' },
      { key: 'camera', label: 'Camera Operator', icon: 'camera', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' },
      { key: 'presentation', label: 'Presentation', icon: 'projector', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
      { key: 'stage', label: 'Stage Audio', icon: 'mic', color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' },
      { key: 'online', label: 'Online Stream', icon: 'globe', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30' },
      { key: 'conf_mon', label: 'Confidence Mon', icon: 'tv', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
      { key: 'overflow', label: 'Overflow AV', icon: 'radio', color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30' }
    ];

    if (monthsList.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i data-lucide="calendar-x" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
          <p class="font-bold">No Sabbaths scheduled.</p>
          <button onclick="App.openAddSabbathModal()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">
            + Add Sabbath Week
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (this.matrixDisplayMode === 'cards') {
      container.innerHTML = monthsList.map(month => {
        const cardsHtml = month.rotas.map(rota => {
          const dateObj = new Date(rota.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          const isSelected = rota.date === this.selectedDate;

          const slotsHtml = roleDefinitions.map(rDef => {
            const assignedId = rota.assignments ? rota.assignments[rDef.key] : null;
            const member = db.members.find(m => m.id === assignedId);
            const name = member ? member.name : (assignedId || 'Unassigned');
            const isMatch = this.matrixSearchQuery && name.toLowerCase().includes(this.matrixSearchQuery);

            return `
              <div class="p-2 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between ${isMatch ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 ring-2 ring-amber-400' : 'bg-slate-50/70 dark:bg-slate-800/40'}">
                <div class="flex items-center space-x-2 truncate">
                  <span class="w-6 h-6 rounded-md flex items-center justify-center text-xs flex-shrink-0 ${rDef.color}">
                    <i data-lucide="${rDef.icon}" class="w-3.5 h-3.5"></i>
                  </span>
                  <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">${rDef.label}</span>
                </div>
                <span class="text-xs font-bold text-slate-900 dark:text-white truncate ml-2">${name}</span>
              </div>
            `;
          }).join('');

          return `
            <div class="glass-card rounded-xl p-3.5 border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'} space-y-3">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center space-x-2 truncate">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0"></span>
                  <h4 class="font-extrabold text-sm text-slate-900 dark:text-white truncate font-heading">${formattedDate}</h4>
                </div>
                <div class="flex items-center space-x-1 flex-shrink-0">
                  <button onclick="ExportHub.copyWhatsAppRota('${rota.date}')" class="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 active:bg-emerald-100" title="Share WhatsApp">
                    <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="App.jumpToBoothView('${rota.date}')" class="px-2.5 py-1 rounded-md bg-blue-600 active:bg-blue-700 text-white text-[11px] font-bold">
                    Booth View
                  </button>
                  ${isAdmin ? `
                    <button onclick="App.deleteSabbathPrompt('${rota.date}')" class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition" title="Remove Sabbath Week">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  ` : ''}
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${slotsHtml}
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="space-y-3">
            <div class="flex items-center justify-between px-1">
              <h3 class="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">${month.title}</h3>
              <span class="text-[11px] text-blue-600 dark:text-blue-400 font-bold">${month.rotas.length} Sabbaths</span>
            </div>
            <div class="space-y-3">
              ${cardsHtml}
            </div>
          </div>
        `;
      }).join('');

    } else {
      // Table Grid Mode
      const columns = [
        { id: "date", name: "DATE", width: "w-28" },
        { id: "audio", name: "AUDIO", width: "w-36" },
        { id: "switcher", name: "SWITCHER", width: "w-36" },
        { id: "camera", name: "CAMERA", width: "w-36" },
        { id: "presentation", name: "PRESENTATION", width: "w-36" },
        { id: "stage", name: "STAGE", width: "w-32" },
        { id: "online", name: "ONLINE", width: "w-32" },
        { id: "conf_mon", name: "CONF. MON.", width: "w-32" },
        { id: "overflow", name: "OVERFLOW", width: "w-32" },
        ...(isAdmin ? [{ id: "actions", name: "ACTIONS", width: "w-16" }] : [])
      ];

      container.innerHTML = monthsList.map(month => {
        const rowsHtml = month.rotas.map((rota, idx) => {
          const dateObj = new Date(rota.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          const isSelected = rota.date === this.selectedDate;

          return `
            <tr class="hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition border-b border-slate-200/80 dark:border-slate-800 ${isSelected ? 'bg-blue-50/80 dark:bg-blue-900/20' : (idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/40')}">
              <td class="px-3 py-2.5 text-xs font-black text-blue-900 dark:text-blue-300 whitespace-nowrap">
                <button onclick="App.jumpToBoothView('${rota.date}')" class="text-left hover:underline flex items-center gap-1" title="Click to view booth details">
                  <span>${formattedDate}</span>
                  <i data-lucide="chevron-right" class="w-3 h-3 opacity-60"></i>
                </button>
              </td>
              ${['audio', 'switcher', 'camera', 'presentation', 'stage', 'online', 'conf_mon', 'overflow'].map(roleKey => {
                const assignedId = rota.assignments ? rota.assignments[roleKey] : null;
                const member = db.members.find(m => m.id === assignedId);
                const name = member ? member.name : (assignedId || '-');
                const isMatch = this.matrixSearchQuery && name.toLowerCase().includes(this.matrixSearchQuery);

                return `
                  <td class="px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                    <span class="inline-block px-1.5 py-0.5 rounded ${isMatch ? 'bg-amber-300 text-slate-950 font-bold ring-2 ring-amber-500' : ''}">
                      ${name}
                    </span>
                  </td>
                `;
              }).join('')}
              ${isAdmin ? `
                <td class="px-3 py-2.5 text-xs text-right">
                  <button onclick="App.deleteSabbathPrompt('${rota.date}')" class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" title="Delete Week">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </td>
              ` : ''}
            </tr>
          `;
        }).join('');

        return `
          <div class="glass-card rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div class="px-4 py-3 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div class="flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <h3 class="font-extrabold text-xs sm:text-sm tracking-wider font-heading">${month.title}</h3>
              </div>
              <span class="text-[11px] text-blue-200 font-semibold">${month.rotas.length} Sabbaths</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-slate-800/90 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    ${columns.map(col => `<th class="px-3 py-2.5 ${col.width}">${col.name}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) lucide.createIcons();
  },

  openAddSabbathModal() {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      App.showToast("Admin login required to add Sabbath weeks 🔒");
      return;
    }

    const nextDate = RotaEngine.getNextAvailableSabbathDate();
    document.getElementById('new-sabbath-date').value = nextDate;
    document.getElementById('new-sabbath-theme').value = "Sabbath Divine Worship";
    document.getElementById('new-sabbath-auto-assign').checked = true;
    document.getElementById('add-sabbath-modal').classList.remove('hidden');
  },

  closeAddSabbathModal() {
    document.getElementById('add-sabbath-modal').classList.add('hidden');
  },

  async saveNewSabbath(e) {
    if (e) e.preventDefault();
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const date = document.getElementById('new-sabbath-date').value;
    const theme = document.getElementById('new-sabbath-theme').value.trim();
    const autoAssign = document.getElementById('new-sabbath-auto-assign').checked;

    if (!date) {
      alert("Please select a date.");
      return;
    }

    const newRota = RotaEngine.addNewSabbath(date, autoAssign, theme);
    this.selectedDate = newRota.date;
    this.closeAddSabbathModal();
    this.renderAll();
    App.showToast(`Sabbath ${newRota.date} added with auto-assigned participants! 🚀`);
  },

  async deleteSabbathPrompt(dateStr) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      App.showToast("Admin permissions required to delete weeks 🔒");
      return;
    }

    const formatted = RotaEngine.formatReadableDate(dateStr);
    if (!confirm(`⚠️ Are you sure you want to permanently remove the duty rota for ${formatted}?`)) {
      return;
    }

    const success = await RotaEngine.deleteSabbath(dateStr);
    if (success) {
      const db = StorageService.getData();
      this.selectedDate = db.rotas.length > 0 ? db.rotas[0].date : RotaEngine.formatDate(new Date());
      this.renderAll();
      App.showToast(`Sabbath ${dateStr} removed from roster.`);
    }
  },

  async autoFillCurrentSabbath() {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      App.showToast("Admin permissions required to auto-assign 🔒");
      return;
    }

    if (!confirm(`Auto-assign qualified ICT members for ${RotaEngine.formatReadableDate(this.selectedDate)} based on fair rotation?`)) {
      return;
    }
    const assignments = RotaEngine.autoAssignForDate(this.selectedDate);
    const db = StorageService.getData();
    const rota = db.rotas.find(r => r.date === this.selectedDate);
    if (rota && assignments) {
      rota.assignments = assignments;
      rota.lastUpdated = new Date().toISOString();
      await StorageService.saveAll();
      this.renderAll();
      App.showToast("All roles auto-assigned successfully! 🎯");
    }
  },

  jumpToBoothView(dateStr) {
    this.selectedDate = dateStr;
    this.switchTab('rota');
  },

  startSabbathCountdown() {
    const countdownEl = document.getElementById('sabbath-countdown');
    if (!countdownEl) return;

    const updateTimer = () => {
      const now = new Date();
      const nextSabbath = new Date();
      const day = now.getDay();
      const diff = (6 - day + 7) % 7;
      
      nextSabbath.setDate(now.getDate() + (diff === 0 && now.getHours() >= 18 ? 7 : diff));
      nextSabbath.setHours(8, 0, 0, 0);

      const totalSec = Math.max(0, Math.floor((nextSabbath - now) / 1000));
      const days = Math.floor(totalSec / (3600 * 24));
      const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);

      countdownEl.innerText = `${days}d ${hours}h ${mins}m to Sabbath 08:00 AM`;
    };

    updateTimer();
    setInterval(updateTimer, 60000);
  },

  renderMonthSelector() {
    const selector = document.getElementById('month-selector-pills');
    if (!selector) return;

    const db = StorageService.getData();
    const rotas = db.rotas || [];

    selector.innerHTML = rotas.map(r => {
      const isSelected = r.date === this.selectedDate;
      const d = new Date(r.date);
      const dayName = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      return `
        <button onclick="App.selectSabbathDate('${r.date}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
          isSelected 
            ? 'bg-blue-600 text-white shadow-md' 
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
        }">
          ${dayName}
        </button>
      `;
    }).join('');
  },

  selectSabbathDate(dateStr) {
    this.selectedDate = dateStr;
    this.renderMonthSelector();
    this.renderCurrentRotaView();
  },

  renderCurrentRotaView() {
    const db = StorageService.getData();
    const container = document.getElementById('rota-grid-container');
    const headerTitle = document.getElementById('rota-header-date');
    const themeEl = document.getElementById('rota-theme-display');
    const notesEl = document.getElementById('rota-notes-display');
    const printDate = document.getElementById('print-date-display');
    const isAdmin = AdminAuth.isAdmin;

    if (!container) return;

    const rota = (db.rotas || []).find(r => r.date === this.selectedDate) || db.rotas[0];
    if (!rota) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
          <p class="font-bold">No Rota found for this date.</p>
          <button onclick="App.openAddSabbathModal()" class="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold">
            + Create Rota
          </button>
        </div>
      `;
      return;
    }

    this.selectedDate = rota.date;
    const formattedLongDate = RotaEngine.formatReadableDate(rota.date);
    if (headerTitle) headerTitle.innerText = formattedLongDate;
    if (printDate) printDate.innerText = formattedLongDate;
    if (themeEl) {
      themeEl.value = rota.theme || "";
      themeEl.readOnly = !isAdmin;
    }
    if (notesEl) {
      notesEl.value = rota.dutyLeadNotes || "";
      notesEl.readOnly = !isAdmin;
    }

    const roles = db.settings.roles;
    container.innerHTML = roles.map(role => {
      const assignedId = rota.assignments ? rota.assignments[role.id] : null;
      const assignedMember = db.members.find(m => m.id === assignedId);
      const isCheckedIn = (rota.checkedIn || []).includes(assignedId);

      return `
        <div class="duty-slot glass-card rounded-xl p-3.5 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-1.5 mb-1.5">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${role.badgeColor}">
                <i data-lucide="${role.icon || 'shield'}" class="w-3 h-3"></i>
                ${role.category}
              </span>
              ${isAdmin ? `
                <button onclick="App.openAssignModal('${role.id}')" class="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Change Assignment">
                  <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>

            <h4 class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-snug">${role.name}</h4>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">${role.description}</p>
          </div>

          <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            ${assignedMember ? `
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 truncate">
                  <div class="w-7 h-7 rounded-lg bg-gradient-to-br ${assignedMember.avatarColor || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-bold text-[10px] shadow-sm flex-shrink-0">
                    ${assignedMember.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div class="truncate">
                    <p class="text-xs font-bold text-slate-900 dark:text-white truncate">${assignedMember.name}</p>
                  </div>
                </div>
                <button onclick="App.toggleCheckIn('${rota.date}', '${assignedMember.id}')" class="p-1 rounded-md transition flex-shrink-0 ${
                  isCheckedIn 
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }" title="${isCheckedIn ? 'Checked in at Booth' : 'Mark Check-In'}">
                  <i data-lucide="${isCheckedIn ? 'check-circle' : 'circle'}" class="w-4 h-4"></i>
                </button>
              </div>
            ` : `
              <div class="flex items-center justify-between py-0.5">
                <span class="text-[11px] text-rose-500 font-semibold flex items-center gap-1">
                  <i data-lucide="alert-circle" class="w-3 h-3"></i> Unassigned
                </span>
                ${isAdmin ? `
                  <button onclick="App.openAssignModal('${role.id}')" class="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                    + Assign
                  </button>
                ` : ''}
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openAssignModal(roleId) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const role = db.settings.roles.find(r => r.id === roleId);
    if (!role) return;

    document.getElementById('assign-modal-role-title').innerText = `Assign: ${role.name}`;
    document.getElementById('assign-role-id').value = roleId;

    const select = document.getElementById('assign-member-select');
    const qualifiedMembers = db.members.filter(m => m.status === 'Active' && m.skills && m.skills.includes(roleId));
    const otherMembers = db.members.filter(m => m.status === 'Active' && (!m.skills || !m.skills.includes(roleId)));

    let html = `<option value="">-- Remove / Unassigned --</option>`;
    if (qualifiedMembers.length > 0) {
      html += `<optgroup label="Qualified in ${role.name}">`;
      qualifiedMembers.forEach(m => {
        html += `<option value="${m.id}">⭐ ${m.name}</option>`;
      });
      html += `</optgroup>`;
    }
    if (otherMembers.length > 0) {
      html += `<optgroup label="All ICT Team Members">`;
      otherMembers.forEach(m => {
        html += `<option value="${m.id}">${m.name}</option>`;
      });
      html += `</optgroup>`;
    }

    select.innerHTML = html;

    const rota = db.rotas.find(r => r.date === this.selectedDate);
    if (rota && rota.assignments && rota.assignments[roleId]) {
      select.value = rota.assignments[roleId];
    } else {
      select.value = "";
    }

    document.getElementById('assign-modal').classList.remove('hidden');
  },

  closeAssignModal() {
    document.getElementById('assign-modal').classList.add('hidden');
  },

  async saveSlotAssignment(e) {
    if (e) e.preventDefault();
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const roleId = document.getElementById('assign-role-id').value;
    const memberId = document.getElementById('assign-member-select').value;

    const rota = db.rotas.find(r => r.date === this.selectedDate);
    if (rota) {
      rota.assignments = rota.assignments || {};
      rota.assignments[roleId] = memberId || null;
      rota.lastUpdated = new Date().toISOString();
      await StorageService.saveAll();
      this.closeAssignModal();
      this.renderAll();
      App.showToast("Duty assignment updated!");
    }
  },

  async toggleCheckIn(rotaDate, memberId) {
    const db = StorageService.getData();
    const rota = db.rotas.find(r => r.date === rotaDate);
    if (!rota) return;

    rota.checkedIn = rota.checkedIn || [];
    const idx = rota.checkedIn.indexOf(memberId);
    if (idx >= 0) {
      rota.checkedIn.splice(idx, 1);
      App.showToast("Check-in removed");
    } else {
      rota.checkedIn.push(memberId);
      App.showToast("Marked present at booth! 🎯");
    }

    await StorageService.saveAll();
    this.renderCurrentRotaView();
  },

  async saveRotaNotes() {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const rota = db.rotas.find(r => r.date === this.selectedDate);
    if (!rota) return;

    const theme = document.getElementById('rota-theme-display').value.trim();
    const notes = document.getElementById('rota-notes-display').value.trim();

    rota.theme = theme;
    rota.dutyLeadNotes = notes;
    await StorageService.saveAll();
    App.showToast("Sabbath details saved.");
  },

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = "fixed bottom-16 sm:bottom-5 right-4 z-50 px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs shadow-2xl flex items-center gap-2 animate-fade-in border border-slate-700/50";
    toast.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> <span>${message}</span>`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
