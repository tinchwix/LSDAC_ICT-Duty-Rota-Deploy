/**
 * LSDAC ICT Duty Rota Export & Communication Hub
 */
const ExportHub = {
  /**
   * Generates a clean, emoji-formatted WhatsApp message for a given Sabbath's rota
   */
  generateWhatsAppText(rotaDate) {
    const db = StorageService.getData();
    const rota = (db.rotas || []).find(r => r.date === rotaDate);
    if (!rota) return "No rota found for selected date.";

    const roles = db.settings.roles;
    const formattedDate = RotaEngine.formatReadableDate(rota.date);

    let msg = `✨ *LAVINGTON SDA CHURCH - ICT & MEDIA DEPARTMENT* ✨\n`;
    msg += `📋 *DUTY ROTA - ${formattedDate.toUpperCase()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (rota.theme) {
      msg += `📖 *Theme:* ${rota.theme}\n`;
    }
    if (rota.preacher) {
      msg += `🎙️ *Speaker / Preacher:* ${rota.preacher}\n\n`;
    }

    msg += `🛠️ *DUTY ASSIGNMENTS:*\n`;
    
    roles.forEach(role => {
      const assignedId = rota.assignments ? rota.assignments[role.id] : null;
      const member = db.members.find(m => m.id === assignedId);
      const memberName = member ? `*${member.name}* (${member.phone || ''})` : `_Unassigned_`;
      
      let icon = "🔹";
      if (role.category === "Audio") icon = "🔊";
      if (role.category === "Visuals") icon = "📽️";
      if (role.category === "Broadcast") icon = "🎥";
      if (role.category === "Media") icon = "📸";
      if (role.category === "Coordination") icon = "👑";
      if (role.category === "IT & Systems") icon = "💻";

      msg += `${icon} *${role.name}:* ${memberName}\n`;
    });

    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `⏰ *REPORTING TIME:* 08:00 AM sharp for system warmup, sound check & stream testing.\n`;
    if (rota.dutyLeadNotes) {
      msg += `📌 *Notes:* ${rota.dutyLeadNotes}\n`;
    }
    msg += `\n🙏 _"Whatever your hand finds to do, do it with all your might." - Eccl 9:10_\n`;
    msg += `_Have a blessed Sabbath in His service!_ 🕊️`;

    return msg;
  },

  copyWhatsAppRota(rotaDate) {
    const text = this.generateWhatsAppText(rotaDate);
    navigator.clipboard.writeText(text).then(() => {
      App.showToast("WhatsApp Rota copied to clipboard! 📋");
    }).catch(err => {
      console.error('Clipboard copy failed', err);
      prompt("Copy Rota manually:", text);
    });
  },

  /**
   * Generates standard .ics file for calendar import
   */
  downloadICalendar(rotaDate) {
    const db = StorageService.getData();
    const rota = (db.rotas || []).find(r => r.date === rotaDate);
    if (!rota) return;

    const startDate = rota.date.replace(/-/g, '') + "T080000Z";
    const endDate = rota.date.replace(/-/g, '') + "T170000Z";
    const summary = `LSDAC ICT Duty Rota - ${rota.date}`;
    
    let description = "ICT Duty Assignments:\\n";
    db.settings.roles.forEach(role => {
      const assignedId = rota.assignments ? rota.assignments[role.id] : null;
      const member = db.members.find(m => m.id === assignedId);
      description += `${role.name}: ${member ? member.name : 'Unassigned'}\\n`;
    });

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Lavington SDA Church//ICT Duty Rota//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "LOCATION:Lavington SDA Church, Nairobi, Kenya",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LSDAC_ICT_Rota_${rota.date}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast("Calendar event downloaded (.ics)");
  },

  /**
   * Downloads CSV Roster for church archives
   */
  downloadCSV() {
    const db = StorageService.getData();
    if (!db.rotas || db.rotas.length === 0) {
      alert("No rotas available to export.");
      return;
    }

    const headers = ["Sabbath Date", "Theme", "Preacher", ...db.settings.roles.map(r => r.name)];
    const rows = [headers];

    db.rotas.forEach(rota => {
      const row = [
        rota.date,
        `"${(rota.theme || '').replace(/"/g, '""')}"`,
        `"${(rota.preacher || '').replace(/"/g, '""')}"`,
        ...db.settings.roles.map(role => {
          const assignedId = rota.assignments ? rota.assignments[role.id] : null;
          const member = db.members.find(m => m.id === assignedId);
          return member ? `"${member.name}"` : '""';
        })
      ];
      rows.push(row);
    });

    const csvString = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `LSDAC_ICT_Duty_Roster_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast("CSV Roster exported successfully!");
  },

  printRota() {
    window.print();
  }
};
