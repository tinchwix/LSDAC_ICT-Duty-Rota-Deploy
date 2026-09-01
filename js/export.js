/**
 * LSDAC ICT Duty Rota Export & Communication Hub
 * Includes High-Resolution Printable Sheets for Lamination & Bulletins
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

  /**
   * Opens a high-resolution, print-optimized window for full Quarter Rota (for Booth Lamination & Notice Board)
   */
  printFullQuarterMatrix() {
    const db = StorageService.getData();
    const rotas = [...(db.rotas || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    const roles = db.settings.roles || [];

    let tableRows = '';
    rotas.forEach(rota => {
      const d = new Date(rota.date + 'T00:00:00');
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      
      let cells = `<td style="padding: 6px 8px; font-weight: bold; white-space: nowrap; border: 1px solid #333; background: #f4f4f4;">${dateStr}</td>`;
      
      roles.forEach(role => {
        const assignedId = rota.assignments ? rota.assignments[role.id] : null;
        const member = (db.members || []).find(m => m.id === assignedId);
        const name = member ? member.name : '-';
        cells += `<td style="padding: 6px 8px; border: 1px solid #333; font-size: 11px;">${name}</td>`;
      });

      tableRows += `<tr>${cells}</tr>`;
    });

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LSDAC Media & ICT Duty Roster - Q4 2026</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 10px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header h1 {
            margin: 0 0 4px 0;
            font-size: 18px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header h2 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 11px;
            color: #444;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          th {
            background-color: #1e3a8a !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            border: 1px solid #000;
            padding: 7px 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            text-align: left;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            border-top: 1px solid #666;
            padding-top: 6px;
            color: #333;
          }
          .notes {
            font-size: 10px;
            margin-bottom: 8px;
            background: #fdf8e6;
            border: 1px solid #e2cb83;
            padding: 6px 10px;
            border-radius: 4px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lavington Seventh-day Adventist Church</h1>
          <h2>MEDIA & COMMUNICATION ICT DUTY ROSTER</h2>
          <p>Schedule for September – November 2026 | Coordinator: Aaron</p>
        </div>

        <div class="notes">
          <strong>⚠️ Instructions:</strong> All personnel on duty must report to the AV Control Booth by <strong>08:00 AM sharp</strong>. In case of unavailability, arrange a swap with another qualified member and notify the coordinator.
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Sabbath Date</th>
              ${roles.map(r => `<th>${r.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          <div>✝ <em>"Whatever your hand finds to do, do it with all your might." - Ecclesiastes 9:10</em></div>
          <div>LSDAC Media Ministry • Generated: ${new Date().toLocaleDateString('en-GB')}</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      alert("Please allow popups to open the printable roster sheet.");
    }
  },

  /**
   * Opens high-resolution single Sabbath Bulletin insert (A4 / Half page)
   */
  printSingleSabbath(rotaDate) {
    const db = StorageService.getData();
    const rota = (db.rotas || []).find(r => r.date === rotaDate);
    if (!rota) {
      alert("Please select a valid Sabbath date first.");
      return;
    }

    const roles = db.settings.roles || [];
    const formattedDate = RotaEngine.formatReadableDate(rota.date);

    let roleCards = '';
    roles.forEach(role => {
      const assignedId = rota.assignments ? rota.assignments[role.id] : null;
      const member = (db.members || []).find(m => m.id === assignedId);
      const name = member ? member.name : 'Unassigned';
      const phone = member && member.phone ? member.phone : '';

      roleCards += `
        <div style="border: 1px solid #333; padding: 10px; border-radius: 6px; background: #fafafa; -webkit-print-color-adjust: exact;">
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #1e3a8a;">${role.name}</div>
          <div style="font-size: 14px; font-weight: 700; margin-top: 4px;">${name}</div>
          ${phone ? `<div style="font-size: 11px; color: #555; margin-top: 2px;">📞 ${phone}</div>` : ''}
        </div>
      `;
    });

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LSDAC Rota - ${formattedDate}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 10px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .header h1 {
            margin: 0 0 4px 0;
            font-size: 18px;
            text-transform: uppercase;
          }
          .header h2 {
            margin: 0 0 4px 0;
            font-size: 15px;
            color: #1e3a8a;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .info-box {
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
            font-size: 12px;
            -webkit-print-color-adjust: exact;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lavington Seventh-day Adventist Church</h1>
          <h2>MEDIA & ICT DUTY ROSTER — ${formattedDate.toUpperCase()}</h2>
          <p style="margin: 0; font-size: 12px; color: #444;">Quarter 4 (September – November 2026)</p>
        </div>

        <div class="info-box">
          ${rota.theme ? `<div><strong>📖 Sermon / Theme:</strong> ${rota.theme}</div>` : ''}
          ${rota.preacher ? `<div><strong>🎙️ Speaker:</strong> ${rota.preacher}</div>` : ''}
          <div><strong>⏰ Reporting Time:</strong> 08:00 AM sharp at the Control Booth</div>
          ${rota.dutyLeadNotes ? `<div><strong>📌 Notes:</strong> ${rota.dutyLeadNotes}</div>` : ''}
        </div>

        <h3 style="font-size: 13px; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.5px;">Booth Station Assignments:</h3>
        <div class="grid">
          ${roleCards}
        </div>

        <div class="footer">
          <em>"Whatever your hand finds to do, do it with all your might." — Ecclesiastes 9:10</em>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      alert("Please allow popups to open the printable bulletin sheet.");
    }
  },

  printRota() {
    this.printFullQuarterMatrix();
  }
};
