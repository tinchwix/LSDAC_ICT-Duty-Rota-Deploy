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
  showArchived: false,

  async init() {
    AdminAuth.init();
    await StorageService.init();
    
    const db = StorageService.getData();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort ascending to find the earliest current or upcoming Sabbath
    const rotas = [...(db.rotas || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    const upcomingSabbath = rotas.find(r => new Date(r.date) >= today);
    this.selectedDate = upcomingSabbath ? upcomingSabbath.date : (rotas[rotas.length - 1]?.date || '2026-09-05');

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

    // PWA Install Prompt handling
    let deferredPrompt = null;
    const pwaBtn = document.getElementById('pwa-install-btn');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaBtn) {
        pwaBtn.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }
    });

    if (pwaBtn) {
      pwaBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          pwaBtn.classList.add('hidden');
        }
        deferredPrompt = null;
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
    this.renderSkillGapAlerts();     // Feature 10
    this.renderDutyLoadChart();      // Feature 9
    this.renderAuditLog();           // Feature 12
    this.updateUndoButton();         // Feature 13
    if (window.lucide) lucide.createIcons();
  },

  toggleArchived() {
    this.showArchived = !this.showArchived;
    this.renderDynamicMonthPills();
    this.renderMatrixTables();
  },

  renderDynamicMonthPills() {
    const container = document.getElementById('matrix-month-pills-container');
    if (!container) return;

    const db = StorageService.getData();
    const rotas = db.rotas || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastCount = rotas.filter(r => new Date(r.date) < today).length;
    const activeCount = rotas.filter(r => new Date(r.date) >= today).length;

    const monthsSet = new Set();
    rotas.forEach(r => {
      if (r.date) monthsSet.add(r.date.substring(0, 7));
    });

    const monthsArr = Array.from(monthsSet).sort();

    let html = `
      <button onclick="App.filterMatrixMonth('ALL')" class="px-2.5 py-1 rounded-lg text-xs font-bold ${
        this.matrixMonthFilter === 'ALL' && !this.showArchived ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
      } transition whitespace-nowrap">
        Upcoming (${activeCount})
      </button>
    `;

    monthsArr.forEach(mStr => {
      const [y, m] = mStr.split('-');
      const d = new Date(parseInt(y), parseInt(m) - 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const count = rotas.filter(r => r.date.startsWith(mStr)).length;
      const isSelected = this.matrixMonthFilter === mStr && !this.showArchived;

      html += `
        <button onclick="App.filterMatrixMonth('${mStr}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold ${
          isSelected ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
        } transition whitespace-nowrap">
          ${label} (${count})
        </button>
      `;
    });

    if (pastCount > 0) {
      html += `
        <button onclick="App.toggleArchived()" class="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
          this.showArchived ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
        } transition whitespace-nowrap" title="Toggle past completed Sabbaths">
          <i data-lucide="archive" class="w-3 h-3"></i>
          Archived (${pastCount})
        </button>
      `;
    }

    container.innerHTML = html;
  },

  filterMatrixMonth(filter) {
    this.matrixMonthFilter = filter;
    this.showArchived = false;
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Split rotas into active (today & upcoming) and past (archived)
    const activeRotas = rotas.filter(r => new Date(r.date) >= today);
    const pastRotas = rotas.filter(r => new Date(r.date) < today);

    // Identify the immediate next/current Sabbath among upcoming rotas
    const sortedUpcoming = [...activeRotas].sort((a, b) => new Date(a.date) - new Date(b.date));
    const currentSabbath = sortedUpcoming.length > 0 ? sortedUpcoming[0] : null;

    // Filter by mode: if user clicked "Archived", show past rotas; otherwise active upcoming rotas
    let displayRotas = this.showArchived ? pastRotas : (activeRotas.length > 0 ? activeRotas : rotas);

    // If a month pill is selected (and not ALL), filter by month
    if (this.matrixMonthFilter !== 'ALL' && !this.showArchived) {
      displayRotas = displayRotas.filter(r => r.date.startsWith(this.matrixMonthFilter));
    }

    const monthsGrouped = {};
    displayRotas.forEach(r => {
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

    // In active view sort chronologically ascending; in archived view sort descending (most recent past first)
    let monthsList = Object.values(monthsGrouped).sort((a, b) => {
      return this.showArchived ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
    });

    monthsList.forEach(m => {
      m.rotas.sort((a, b) => {
        return this.showArchived ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
      });
    });

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

    if (displayRotas.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <i data-lucide="${this.showArchived ? 'archive' : 'calendar-x'}" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
          <p class="font-bold">${this.showArchived ? 'No archived past Sabbaths.' : 'No upcoming Sabbaths scheduled.'}</p>
          ${!this.showArchived ? `
            <button onclick="App.openAddSabbathModal()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
              + Add Sabbath Week
            </button>
          ` : `
            <button onclick="App.filterMatrixMonth('ALL')" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm">
              Back to Upcoming Sabbaths
            </button>
          `}
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Archive notice banner when viewing archive
    let bannerHtml = '';
    if (this.showArchived) {
      bannerHtml = `
        <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <i data-lucide="archive" class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0"></i>
            <span><strong>Archived Past Sabbaths</strong> (${pastRotas.length}) — Viewing past completed duty records.</span>
          </div>
          <button onclick="App.filterMatrixMonth('ALL')" class="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700">
            Show Upcoming
          </button>
        </div>
      `;
    }

    if (this.matrixDisplayMode === 'cards') {
      const monthsHtml = monthsList.map(month => {
        const cardsHtml = month.rotas.map(rota => {
          const dateObj = new Date(rota.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          const isCurrent = currentSabbath && rota.date === currentSabbath.date;
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
            <div class="glass-card rounded-xl p-3.5 border ${
              isCurrent 
                ? 'border-blue-600 dark:border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20 shadow-md' 
                : (isSelected ? 'border-blue-400 ring-1 ring-blue-400/20' : 'border-slate-200 dark:border-slate-800')
            } space-y-3">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div class="flex items-center space-x-2 truncate">
                  <span class="w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600'} flex-shrink-0"></span>
                  <h4 class="font-extrabold text-sm text-slate-900 dark:text-white truncate font-heading">${formattedDate}</h4>
                  ${isCurrent ? `
                    <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wide border border-emerald-300 dark:border-emerald-800">
                      ★ CURRENT / NEXT
                    </span>
                  ` : ''}
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

      container.innerHTML = bannerHtml + monthsHtml;

    } else {
      // Table Grid Mode
      const columns = [
        { id: "date", name: "DATE", width: "w-32" },
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

      const tablesHtml = monthsList.map(month => {
        const rowsHtml = month.rotas.map((rota, idx) => {
          const dateObj = new Date(rota.date);
          const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
          const isCurrent = currentSabbath && rota.date === currentSabbath.date;
          const isSelected = rota.date === this.selectedDate;

          return `
            <tr class="hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition border-b border-slate-200/80 dark:border-slate-800 ${
              isCurrent 
                ? 'bg-blue-50/90 dark:bg-blue-950/40 ring-1 ring-blue-500/40 font-semibold' 
                : (isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : (idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/40'))
            }">
              <td class="px-3 py-2.5 text-xs font-black text-blue-900 dark:text-blue-300 whitespace-nowrap">
                <button onclick="App.jumpToBoothView('${rota.date}')" class="text-left hover:underline flex items-center gap-1.5" title="Click to view booth details">
                  <span>${formattedDate}</span>
                  ${isCurrent ? `
                    <span class="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-white">LIVE</span>
                  ` : ''}
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

      container.innerHTML = bannerHtml + tablesHtml;
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

    StorageService.snapshotForUndo();
    const success = await RotaEngine.deleteSabbath(dateStr);
    if (success) {
      StorageService.logAudit('Delete Sabbath', `Removed rota for ${dateStr}`);
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
      StorageService.snapshotForUndo();
      rota.assignments = assignments;
      rota.lastUpdated = new Date().toISOString();
      await StorageService.saveAll();
      StorageService.logAudit('Auto-Fill', `All roles auto-assigned for ${this.selectedDate}`);
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
    const containerEl = document.getElementById('sabbath-countdown-container');
    const iconEl = document.getElementById('sabbath-countdown-icon');
    if (!countdownEl) return;

    const updateTimer = () => {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 6 is Saturday
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const timeInMinutes = currentHour * 60 + currentMin;

      // Sabbath service is active on Saturday from 08:00 AM (480 mins) to 18:30 PM (1110 mins)
      const isSabbathServiceNow = (day === 6 && timeInMinutes >= 480 && timeInMinutes <= 1110);

      if (isSabbathServiceNow) {
        if (containerEl) {
          containerEl.className = "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200 font-bold transition-all animate-pulse";
        }
        if (iconEl) {
          iconEl.setAttribute('data-lucide', 'radio');
          iconEl.className = "w-3.5 h-3.5 flex-shrink-0 text-rose-600";
        }
        countdownEl.innerHTML = `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>🔴 SABBATH WORSHIP SERVICE IN SESSION — ICT BOOTH ACTIVE</span>`;
        return;
      }

      // If outside service hours, reset container styling to amber countdown
      if (containerEl && !containerEl.classList.contains('bg-amber-50')) {
        containerEl.className = "flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-semibold transition-all";
        if (iconEl) {
          iconEl.setAttribute('data-lucide', 'clock');
          iconEl.className = "w-3.5 h-3.5 flex-shrink-0 text-amber-600 animate-pulse";
        }
      }

      // Target next Saturday 08:00 AM
      const target = new Date(now);
      let daysUntilSabbath = (6 - day + 7) % 7;
      target.setDate(now.getDate() + daysUntilSabbath);
      target.setHours(8, 0, 0, 0);

      // If today is Saturday and 8:00 AM has already passed (after 18:30), target next Saturday
      if (now >= target) {
        target.setDate(target.getDate() + 7);
      }

      const totalSec = Math.max(0, Math.floor((target - now) / 1000));
      const days = Math.floor(totalSec / (3600 * 24));
      const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = Math.floor(totalSec % 60);

      countdownEl.innerText = `${days}d ${hours}h ${mins}m ${secs}s to Sabbath 08:00 AM`;
    };

    updateTimer();
    setInterval(updateTimer, 1000);
  },

  renderMonthSelector() {
    const selector = document.getElementById('month-selector-pills');
    if (!selector) return;

    const db = StorageService.getData();
    const rotas = db.rotas || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort upcoming first (ascending), then past
    const sortedRotas = [...rotas].sort((a, b) => new Date(a.date) - new Date(b.date));

    selector.innerHTML = sortedRotas.map(r => {
      const isSelected = r.date === this.selectedDate;
      const isPast = new Date(r.date) < today;
      const d = new Date(r.date);
      const dayName = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      return `
        <button onclick="App.selectSabbathDate('${r.date}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
          isSelected 
            ? 'bg-blue-600 text-white shadow-md' 
            : (isPast 
                ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50')
        }">
          ${isPast ? '<i data-lucide="history" class="w-2.5 h-2.5 opacity-60"></i>' : ''}
          ${dayName}
        </button>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
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

    this.checkAssignConflicts();
    document.getElementById('assign-modal').classList.remove('hidden');
  },

  checkAssignConflicts() {
    const alertBox = document.getElementById('assign-conflict-alert');
    if (!alertBox) return;

    const roleId = document.getElementById('assign-role-id').value;
    const memberId = document.getElementById('assign-member-select').value;

    if (!memberId) {
      alertBox.classList.add('hidden');
      alertBox.innerHTML = '';
      return;
    }

    const conflicts = RotaEngine.getMemberAssignmentConflicts(this.selectedDate, roleId, memberId);
    if (conflicts.length > 0) {
      alertBox.innerHTML = conflicts.map(c => `<div>${c}</div>`).join('');
      alertBox.classList.remove('hidden');
    } else {
      alertBox.classList.add('hidden');
      alertBox.innerHTML = '';
    }
  },

  closeAssignModal() {
    const alertBox = document.getElementById('assign-conflict-alert');
    if (alertBox) {
      alertBox.classList.add('hidden');
      alertBox.innerHTML = '';
    }
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
      StorageService.snapshotForUndo();
      const roleObj = db.settings.roles.find(r => r.id === roleId);
      const memberObj = db.members.find(m => m.id === memberId);
      const roleName = roleObj ? roleObj.name : roleId;
      const memberName = memberObj ? memberObj.name : 'Unassigned';

      rota.assignments = rota.assignments || {};
      rota.assignments[roleId] = memberId || null;
      rota.lastUpdated = new Date().toISOString();
      await StorageService.saveAll();
      StorageService.logAudit('Assignment Change', `${roleName} assigned to ${memberName} (${this.selectedDate})`);
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

    StorageService.snapshotForUndo();
    rota.theme = theme;
    rota.dutyLeadNotes = notes;
    await StorageService.saveAll();
    StorageService.logAudit('Update Notes', `Updated theme/notes for ${this.selectedDate}`);
    this.updateUndoButton();
    this.renderAuditLog();
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
  },

  // ─── Feature 10: Skill Gap Alerts ─────────────────────────────
  renderSkillGapAlerts() {
    const container = document.getElementById('skill-gap-alerts');
    if (!container) return;

    const db = StorageService.getData();
    if (!db || !db.rotas || !db.members) {
      container.innerHTML = '';
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingRotas = db.rotas.filter(r => r.date >= todayStr).slice(0, 4);
    const criticalRoleIds = ['audio', 'switcher', 'camera', 'online'];
    const activeMembers = db.members.filter(m => m.status === 'Active');

    const gapWarnings = [];

    upcomingRotas.forEach(rota => {
      criticalRoleIds.forEach(roleId => {
        const assignedMemberId = rota.assignments ? rota.assignments[roleId] : null;
        if (!assignedMemberId) {
          // Check if any qualified member is available
          const qualifiedAvailable = activeMembers.filter(m => {
            const hasSkill = m.skills && m.skills.includes(roleId);
            const isAvailable = !m.unavailableDates || !m.unavailableDates.includes(rota.date);
            return hasSkill && isAvailable;
          });

          const roleObj = db.settings.roles.find(r => r.id === roleId);
          const roleName = roleObj ? roleObj.name : roleId;
          const formattedDate = RotaEngine.formatReadableDate(rota.date);

          if (qualifiedAvailable.length === 0) {
            gapWarnings.push({
              level: 'critical',
              date: rota.date,
              msg: `🚨 <strong>No qualified & available personnel</strong> for <strong>${roleName}</strong> on ${formattedDate}!`
            });
          } else {
            gapWarnings.push({
              level: 'warning',
              date: rota.date,
              msg: `⚠️ <strong>${roleName}</strong> is unassigned on ${formattedDate} (${qualifiedAvailable.length} qualified member${qualifiedAvailable.length > 1 ? 's' : ''} available)`
            });
          }
        }
      });
    });

    if (gapWarnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Render alerts
    container.innerHTML = gapWarnings.slice(0, 3).map(w => `
      <div class="p-2.5 sm:p-3 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs ${
        w.level === 'critical'
          ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
          : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
      }">
        <div class="flex items-center gap-2">
          <i data-lucide="${w.level === 'critical' ? 'alert-triangle' : 'info'}" class="w-4 h-4 flex-shrink-0 ${w.level === 'critical' ? 'text-rose-600' : 'text-amber-600'}"></i>
          <span>${w.msg}</span>
        </div>
        <button onclick="App.jumpToBoothView('${w.date}')" class="px-2 py-1 rounded text-[10px] font-bold underline hover:opacity-80 flex-shrink-0">
          Assign Now →
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  // ─── Feature 9: Duty Load Dashboard ───────────────────────────
  toggleDutyLoadChart() {
    const body = document.getElementById('duty-load-body');
    const chevron = document.getElementById('duty-load-chevron');
    if (!body) return;
    const isHidden = body.classList.contains('hidden');
    if (isHidden) {
      body.classList.remove('hidden');
      if (chevron) chevron.classList.add('rotate-180');
      this.renderDutyLoadChart();
    } else {
      body.classList.add('hidden');
      if (chevron) chevron.classList.remove('rotate-180');
    }
  },

  renderDutyLoadChart() {
    const container = document.getElementById('duty-load-chart');
    if (!container) return;

    const db = StorageService.getData();
    if (!db || !db.members) return;

    const members = db.members.filter(m => m.status === 'Active');
    const dutyCounts = {};
    members.forEach(m => { dutyCounts[m.id] = 0; });

    (db.rotas || []).forEach(rota => {
      Object.values(rota.assignments || {}).forEach(memberId => {
        if (memberId && dutyCounts[memberId] !== undefined) {
          dutyCounts[memberId]++;
        }
      });
    });

    // Sort by duties descending
    const sortedMembers = [...members].sort((a, b) => (dutyCounts[b.id] || 0) - (dutyCounts[a.id] || 0));
    const maxDuty = Math.max(1, ...Object.values(dutyCounts));

    container.innerHTML = sortedMembers.map(m => {
      const count = dutyCounts[m.id] || 0;
      const pct = Math.min(100, Math.round((count / maxDuty) * 100));

      let barColor = 'bg-emerald-500';
      let tagColor = 'text-emerald-700 dark:text-emerald-300';
      if (count >= 6) {
        barColor = 'bg-rose-500';
        tagColor = 'text-rose-700 dark:text-rose-300 font-bold';
      } else if (count >= 3) {
        barColor = 'bg-amber-500';
        tagColor = 'text-amber-700 dark:text-amber-300';
      }

      return `
        <div class="flex items-center gap-2 text-xs py-0.5">
          <div class="w-32 sm:w-44 truncate font-medium text-slate-800 dark:text-slate-200" title="${m.name}">
            ${m.name}
          </div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
            <div class="${barColor} h-3 rounded-full transition-all duration-300" style="width: ${Math.max(4, pct)}%"></div>
          </div>
          <div class="w-16 text-right text-[11px] ${tagColor}">
            ${count} ${count === 1 ? 'duty' : 'duties'}
          </div>
        </div>
      `;
    }).join('');
  },

  // ─── Feature 12: Audit Log ────────────────────────────────────
  toggleAuditLog() {
    const body = document.getElementById('audit-log-body');
    const chevron = document.getElementById('audit-log-chevron');
    if (!body) return;
    const isHidden = body.classList.contains('hidden');
    if (isHidden) {
      body.classList.remove('hidden');
      if (chevron) chevron.classList.add('rotate-180');
      this.renderAuditLog();
    } else {
      body.classList.add('hidden');
      if (chevron) chevron.classList.remove('rotate-180');
    }
  },

  renderAuditLog() {
    const panel = document.getElementById('audit-log-panel');
    const entriesContainer = document.getElementById('audit-log-entries');
    if (!panel || !entriesContainer) return;

    // Only visible in Admin mode
    if (!AdminAuth.isAdmin) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');

    const logs = StorageService.getAuditLog();
    if (logs.length === 0) {
      entriesContainer.innerHTML = `<p class="p-3 text-xs text-slate-400 text-center italic">No changes recorded in audit history yet.</p>`;
      return;
    }

    entriesContainer.innerHTML = logs.map(item => {
      const timeStr = new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = new Date(item.ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `
        <div class="p-2 sm:p-2.5 flex items-start justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-850">
          <div>
            <div class="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
              <span class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-mono text-[9px] uppercase">${item.action}</span>
              <span>${item.details}</span>
            </div>
            <span class="text-[10px] text-slate-400">${dateStr} at ${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  clearAuditLog() {
    if (!confirm('Clear recent audit log history?')) return;
    StorageService.clearAuditLog();
    this.renderAuditLog();
    App.showToast("Audit log cleared.");
  },

  // ─── Feature 13: Undo Last Change ─────────────────────────────
  updateUndoButton() {
    const undoBtn = document.getElementById('undo-btn');
    if (!undoBtn) return;
    if (AdminAuth.isAdmin && StorageService.hasUndoSnapshot()) {
      undoBtn.classList.remove('hidden');
    } else {
      undoBtn.classList.add('hidden');
    }
  },

  async undoLastChange() {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    if (!StorageService.hasUndoSnapshot()) {
      App.showToast("No change to undo.");
      return;
    }

    if (!confirm("Revert your last action and restore previous schedule state?")) {
      return;
    }

    const success = await StorageService.undoLastChange();
    if (success) {
      this.renderAll();
      App.showToast("Last change undone successfully! ↩️");
    } else {
      App.showToast("Failed to restore previous state.");
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
