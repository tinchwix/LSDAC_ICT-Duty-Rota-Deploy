/**
 * ============================================================
 * Storage & Sync Engine — LSDAC ICT Duty Rota
 * Supabase Realtime Database + localStorage fallback
 * ============================================================
 */

const StorageService = {
  db: null,
  supabase: null,
  configured: false,

  // ─── Check if Supabase credentials are set ──────────────────
  _isConfigured() {
    return (
      typeof SUPABASE_URL !== 'undefined' &&
      typeof SUPABASE_ANON !== 'undefined' &&
      !SUPABASE_URL.includes('PASTE_YOUR') &&
      SUPABASE_URL.startsWith('https://')
    );
  },

  // ─── Show a small sync status indicator in the UI ──────────
  _showSyncStatus(msg, color) {
    const el = document.getElementById('sync-status');
    if (el) {
      el.textContent = msg;
      el.style.color = color === 'green'  ? '#16a34a' :
                       color === 'orange' ? '#d97706' : '#dc2626';
    }
  },

  // ─── INIT: Connect to Supabase and load data ────────────────
  async init() {

    // 1. Try Supabase if credentials are set
    if (this._isConfigured()) {
      try {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        this.configured = true;
        this._showSyncStatus('⏳ Loading from Supabase...', 'orange');

        const { data: rows, error } = await this.supabase
          .from('rota_data')
          .select('data')
          .eq('id', 'main')
          .single();

        if (!error && rows && rows.data) {
          // ✅ Got real data from Supabase
          this.db = rows.data;
          localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
          this._showSyncStatus('✅ Supabase Connected', 'green');
          this._listenForUpdates();
          return this.db;
        } else {
          // Supabase table is empty — seed it from bundled default data
          console.log('Supabase table empty — seeding from default_data.json...');
          await this._seedSupabase();
          this._listenForUpdates();
          return this.db;
        }
      } catch (e) {
        console.warn('Supabase connection failed:', e);
        this._showSyncStatus('⚠️ Supabase error — Offline Mode', 'red');
      }
    } else {
      this._showSyncStatus('⚠️ Offline (Supabase not configured)', 'orange');
    }

    // 2. localStorage cache
    const cached = localStorage.getItem('lsdac_rota_cache_v2');
    if (cached) {
      try {
        this.db = JSON.parse(cached);
        this._showSyncStatus('📦 Loaded from cache (offline)', 'orange');
        return this.db;
      } catch (e) {
        console.warn('Cache corrupted:', e);
      }
    }

    // 3. Load bundled default_data.json
    try {
      const res = await fetch('./data/default_data.json');
      if (res.ok) {
        this.db = await res.json();
        localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
        this._showSyncStatus('📄 Loaded default data (offline)', 'orange');
        return this.db;
      }
    } catch (e) {
      console.warn('default_data.json fetch failed:', e);
    }

    // 4. Bare minimum fallback
    this.db = {
      settings: {
        churchName: "Lavington Seventh-day Adventist Church",
        churchAcronym: "LSDAC",
        department: "Media & Communication ICT Department",
        coordinator: "Aaron",
        period: "September – November 2026",
        roles: []
      },
      members: [],
      rotas: [],
      swaps: [],
      announcements: []
    };
    return this.db;
  },

  // ─── Seed Supabase with the official PDF roster data ────────
  async _seedSupabase() {
    try {
      const res = await fetch('./data/default_data.json');
      if (!res.ok) throw new Error('Could not load default_data.json');
      this.db = await res.json();

      const { error } = await this.supabase
        .from('rota_data')
        .upsert({ id: 'main', data: this.db, updated_at: new Date().toISOString() });

      if (error) throw error;

      localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
      this._showSyncStatus('✅ Supabase seeded with roster data', 'green');
      console.log('✅ Supabase seeded with all 44 members & 13 Sabbaths');
    } catch (e) {
      console.error('Supabase seeding error:', e);
      this._showSyncStatus('⚠️ Seed failed — check Supabase table', 'red');
    }
  },

  // ─── Real-time listener: refresh when another user saves ────
  _listenForUpdates() {
    if (!this.supabase) return;
    this.supabase
      .channel('rota_live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rota_data', filter: 'id=eq.main' },
        (payload) => {
          const newData = payload.new.data;
          if (newData && JSON.stringify(newData) !== JSON.stringify(this.db)) {
            this.db = newData;
            localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
            this._showSyncStatus('🔄 Live update received', 'green');
            if (typeof App !== 'undefined' && App.render) App.render();
          }
        }
      )
      .subscribe();
  },

  // ─── GET current in-memory data ─────────────────────────────
  getData() {
    return this.db;
  },

  // ─── SAVE: Write to Supabase + localStorage ─────────────────
  async saveAll() {
    if (!this.db) return false;

    // Always cache locally first (instant, offline-safe)
    localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));

    if (this.configured && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('rota_data')
          .upsert({ id: 'main', data: this.db, updated_at: new Date().toISOString() });

        if (error) throw error;
        this._showSyncStatus('✅ Saved to Supabase', 'green');
        return true;
      } catch (e) {
        console.error('Supabase save error:', e);
        this._showSyncStatus('⚠️ Save failed — stored locally only', 'red');
        return false;
      }
    }

    this._showSyncStatus('💾 Saved locally (Supabase not configured)', 'orange');
    return true;
  },

  // ─── Reset all data to the official PDF roster ───────────────
  async resetToDefault() {
    if (!confirm('Reset ALL data to the original official PDF roster? This cannot be undone.')) return;
    localStorage.removeItem('lsdac_rota_cache_v2');
    if (this.configured && this.supabase) {
      await this.supabase.from('rota_data').delete().eq('id', 'main');
    }
    window.location.reload();
  },

  // ─── Audit Log: record admin actions ────────────────────────
  logAudit(action, details) {
    try {
      const log = this.getAuditLog();
      log.unshift({
        ts: new Date().toISOString(),
        action,
        details
      });
      // Keep only last 50 entries
      localStorage.setItem('lsdac_audit_log', JSON.stringify(log.slice(0, 50)));
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  },

  getAuditLog() {
    try {
      return JSON.parse(localStorage.getItem('lsdac_audit_log') || '[]');
    } catch {
      return [];
    }
  },

  clearAuditLog() {
    localStorage.removeItem('lsdac_audit_log');
  },

  // ─── Undo: snapshot entire db into sessionStorage ───────────
  snapshotForUndo() {
    try {
      sessionStorage.setItem('lsdac_undo_snapshot', JSON.stringify(this.db));
    } catch (e) {
      console.warn('Undo snapshot error:', e);
    }
  },

  hasUndoSnapshot() {
    return !!sessionStorage.getItem('lsdac_undo_snapshot');
  },

  async undoLastChange() {
    const raw = sessionStorage.getItem('lsdac_undo_snapshot');
    if (!raw) return false;
    try {
      this.db = JSON.parse(raw);
      sessionStorage.removeItem('lsdac_undo_snapshot');
      await this.saveAll();
      this.logAudit('Undo', 'Reverted last change');
      return true;
    } catch (e) {
      console.error('Undo restore error:', e);
      return false;
    }
  }
};
