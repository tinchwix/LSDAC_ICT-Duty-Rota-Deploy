/**
 * Storage & Sync Engine for LSDAC ICT Duty Rota
 * 100% GitHub Pages Static Hosting & Local Python Server Compatible
 */
const StorageService = {
  db: null,
  isOnline: false,

  async init() {
    // 1. Check if user already has saved/updated data in browser localStorage
    const cached = localStorage.getItem('lsdac_rota_cache_v2');
    if (cached) {
      try {
        this.db = JSON.parse(cached);
        return this.db;
      } catch (e) {
        console.warn('Cache corrupted, re-fetching default data...', e);
      }
    }

    // 2. Try loading from static JSON database (GitHub Pages / Web Host)
    try {
      const staticRes = await fetch('./data/default_data.json');
      if (staticRes.ok) {
        this.db = await staticRes.json();
        localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
        return this.db;
      }
    } catch (e) {
      console.warn('Static data fetch failed, checking API...', e);
    }

    // 3. Try Python REST API server if running locally
    try {
      const apiRes = await fetch('/api/data');
      if (apiRes.ok) {
        this.db = await apiRes.json();
        this.isOnline = true;
        localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));
        return this.db;
      }
    } catch (e) {
      console.warn('Local API server offline');
    }

    // 4. Embedded fallback if all network requests fail
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

  getData() {
    return this.db;
  },

  async saveAll() {
    if (!this.db) return false;
    localStorage.setItem('lsdac_rota_cache_v2', JSON.stringify(this.db));

    // If local server is running, also persist to disk
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.db)
      });
      if (res.ok) {
        this.isOnline = true;
        return true;
      }
    } catch (e) {
      this.isOnline = false;
    }
    return true;
  },

  resetToDefault() {
    localStorage.removeItem('lsdac_rota_cache_v2');
    window.location.reload();
  }
};
