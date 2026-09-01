/**
 * LSDAC ICT Rota Generator & Smart Rotation Engine
 */
const RotaEngine = {
  getSabbathsForMonth(year, month) {
    const sabbaths = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      if (date.getDay() === 6) { // 6 = Saturday
        sabbaths.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }
    return sabbaths;
  },

  getNextAvailableSabbathDate() {
    const db = StorageService.getData();
    const rotas = db.rotas || [];
    if (rotas.length === 0) {
      const today = new Date();
      const diff = (6 - today.getDay() + 7) % 7;
      const nextSat = new Date();
      nextSat.setDate(today.getDate() + (diff === 0 ? 7 : diff));
      return this.formatDate(nextSat);
    }

    const dates = rotas.map(r => new Date(r.date)).sort((a, b) => b - a);
    const latestDate = new Date(dates[0]);
    latestDate.setDate(latestDate.getDate() + 7);
    return this.formatDate(latestDate);
  },

  formatDate(dateObj) {
    if (typeof dateObj === 'string') dateObj = new Date(dateObj);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatReadableDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  formatShortDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
  },

  /**
   * Auto-assigns participants for a single Sabbath date using fair-share workload distribution
   */
  autoAssignForDate(dateStr) {
    const db = StorageService.getData();
    const roles = db.settings.roles;
    const members = db.members.filter(m => m.status === 'Active');

    if (members.length === 0) {
      alert('Please add active ICT team members first!');
      return null;
    }

    const dutyHistory = {};
    members.forEach(m => { dutyHistory[m.id] = 0; });

    (db.rotas || []).forEach(rota => {
      Object.values(rota.assignments || {}).forEach(memberId => {
        if (dutyHistory[memberId] !== undefined) {
          dutyHistory[memberId]++;
        }
      });
    });

    const assignedThisSabbath = new Set();
    const assignments = {};

    roles.forEach(role => {
      const eligibleMembers = members.filter(m => {
        const hasSkill = m.skills && m.skills.includes(role.id);
        const isNotAssignedToday = !assignedThisSabbath.has(m.id);
        const isAvailable = !m.unavailableDates || !m.unavailableDates.includes(dateStr);
        return hasSkill && isNotAssignedToday && isAvailable;
      });

      if (eligibleMembers.length > 0) {
        eligibleMembers.sort((a, b) => (dutyHistory[a.id] || 0) - (dutyHistory[b.id] || 0));
        const chosen = eligibleMembers[0];
        assignments[role.id] = chosen.id;
        assignedThisSabbath.add(chosen.id);
        dutyHistory[chosen.id] = (dutyHistory[chosen.id] || 0) + 1;
      } else {
        const fallback = members.filter(m => !assignedThisSabbath.has(m.id) && (!m.unavailableDates || !m.unavailableDates.includes(dateStr)));
        if (fallback.length > 0) {
          fallback.sort((a, b) => (dutyHistory[a.id] || 0) - (dutyHistory[b.id] || 0));
          assignments[role.id] = fallback[0].id;
          assignedThisSabbath.add(fallback[0].id);
        } else {
          assignments[role.id] = null;
        }
      }
    });

    return assignments;
  },

  /**
   * Creates a new single week Sabbath rota
   */
  addNewSabbath(dateStr, shouldAutoAssign = true, theme = "Sabbath Divine Worship", notes = "") {
    const db = StorageService.getData();
    const existingIndex = db.rotas.findIndex(r => r.date === dateStr);

    let assignments = {};
    if (shouldAutoAssign) {
      assignments = this.autoAssignForDate(dateStr);
    } else {
      db.settings.roles.forEach(r => { assignments[r.id] = null; });
    }

    const rotaEntry = {
      id: 'rota_' + dateStr,
      date: dateStr,
      theme: theme || "Sabbath Divine Worship",
      preacher: "",
      dutyLeadNotes: notes || "Report to the ICT desk by 08:00 AM for booth warmup, wireless mic checks, and stream setup.",
      assignments: assignments,
      checkedIn: [],
      status: "Published",
      lastUpdated: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      db.rotas[existingIndex] = rotaEntry;
    } else {
      db.rotas.push(rotaEntry);
    }

    db.rotas.sort((a, b) => new Date(a.date) - new Date(b.date));
    StorageService.saveAll();
    return rotaEntry;
  },

  /**
   * Removes / Deletes a scheduled Sabbath
   */
  async deleteSabbath(dateStr) {
    const db = StorageService.getData();
    const idx = (db.rotas || []).findIndex(r => r.date === dateStr);
    if (idx < 0) return false;

    db.rotas.splice(idx, 1);
    await StorageService.saveAll();
    return true;
  },

  validateRota(rota) {
    const db = StorageService.getData();
    const conflicts = [];
    const memberRoleMap = {};

    Object.entries(rota.assignments || {}).forEach(([roleId, memberId]) => {
      if (!memberId) return;
      
      const member = db.members.find(m => m.id === memberId);
      const role = db.settings.roles.find(r => r.id === roleId);
      
      if (member) {
        if (member.unavailableDates && member.unavailableDates.includes(rota.date)) {
          conflicts.push(`${member.name} is marked unavailable on ${rota.date} (${role ? role.name : roleId})`);
        }
        if (memberRoleMap[memberId]) {
          const firstRole = db.settings.roles.find(r => r.id === memberRoleMap[memberId]);
          conflicts.push(`${member.name} is assigned to multiple duties: ${firstRole?.name} & ${role?.name}`);
        } else {
          memberRoleMap[memberId] = roleId;
        }
      }
    });

    return conflicts;
  }
};
