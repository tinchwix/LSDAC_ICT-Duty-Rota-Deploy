/**
 * LSDAC ICT Team Members Management Module
 */
const MembersModule = {
  renderMembersList(filterQuery = "") {
    const db = StorageService.getData();
    const container = document.getElementById('members-list-container');
    if (!container) return;

    let members = db.members || [];
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      members = members.filter(m => 
        m.name.toLowerCase().includes(q) || 
        (m.phone && m.phone.includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    }

    if (members.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 dark:text-slate-500">
          <i data-lucide="users" class="w-12 h-12 mx-auto mb-2 opacity-40"></i>
          <p class="text-base font-medium">No team members found</p>
          <p class="text-xs">Click "+ Add Member" to register ICT department personnel.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const isAdmin = AdminAuth.isAdmin;

    container.innerHTML = members.map(member => {
      const roleBadges = (member.skills || []).map(skillId => {
        const roleObj = db.settings.roles.find(r => r.id === skillId);
        if (!roleObj) return '';
        return `
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            ${roleObj.name}
          </span>
        `;
      }).join('');

      const dutyCount = db.rotas.reduce((acc, r) => {
        const rolesForMember = Object.values(r.assignments || {}).filter(mId => mId === member.id);
        return acc + rolesForMember.length;
      }, 0);

      const isUnavailable = (member.unavailableDates || []).length > 0;

      return `
        <div class="glass-card rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-500/50 transition duration-150">
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${member.avatarColor || 'from-blue-600 to-indigo-700'} flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                ${member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div class="truncate">
                <h3 class="font-bold text-slate-900 dark:text-white text-sm truncate">${member.name}</h3>
                <p class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <i data-lucide="phone" class="w-3 h-3"></i> ${member.phone || 'No phone'}
                </p>
              </div>
            </div>
            ${isAdmin ? `
              <div class="flex items-center space-x-0.5">
                <button onclick="MembersModule.openEditMemberModal('${member.id}')" class="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition" title="Edit Member">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="MembersModule.deleteMember('${member.id}')" class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition" title="Remove Member">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            ` : ''}
          </div>

          <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <span class="text-slate-400 text-[11px] font-medium">Roles (${(member.skills || []).length})</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                ${dutyCount} on Rota
              </span>
            </div>
            <div class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              ${roleBadges || '<span class="text-[11px] text-slate-400 italic">No roles selected</span>'}
            </div>
          </div>

          ${isUnavailable ? `
            <div class="mt-2.5 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <i data-lucide="calendar-off" class="w-3 h-3 flex-shrink-0"></i>
              <span>Unavailable: ${member.unavailableDates.join(', ')}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openAddMemberModal() {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      App.showToast("Admin login required to add members 🔒");
      return;
    }

    const db = StorageService.getData();
    document.getElementById('member-modal-title').innerText = "Add New ICT Team Member";
    document.getElementById('member-id').value = "";
    document.getElementById('member-name').value = "";
    document.getElementById('member-phone').value = "+254 ";
    document.getElementById('member-email').value = "";
    document.getElementById('member-unavailable').value = "";

    const skillsContainer = document.getElementById('member-skills-checkboxes');
    skillsContainer.innerHTML = db.settings.roles.map(role => `
      <label class="flex items-center space-x-2 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
        <input type="checkbox" name="skills" value="${role.id}" class="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5">
        <span class="font-medium text-slate-800 dark:text-slate-200 text-[11px]">${role.name}</span>
      </label>
    `).join('');

    document.getElementById('member-modal').classList.remove('hidden');
  },

  openEditMemberModal(id) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const member = db.members.find(m => m.id === id);
    if (!member) return;

    document.getElementById('member-modal-title').innerText = "Edit ICT Team Member";
    document.getElementById('member-id').value = member.id;
    document.getElementById('member-name').value = member.name;
    document.getElementById('member-phone').value = member.phone || '';
    document.getElementById('member-email').value = member.email || '';
    document.getElementById('member-unavailable').value = (member.unavailableDates || []).join(', ');

    const skillsContainer = document.getElementById('member-skills-checkboxes');
    skillsContainer.innerHTML = db.settings.roles.map(role => {
      const isChecked = (member.skills || []).includes(role.id) ? 'checked' : '';
      return `
        <label class="flex items-center space-x-2 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
          <input type="checkbox" name="skills" value="${role.id}" ${isChecked} class="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5">
          <span class="font-medium text-slate-800 dark:text-slate-200 text-[11px]">${role.name}</span>
        </label>
      `;
    }).join('');

    document.getElementById('member-modal').classList.remove('hidden');
  },

  closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
  },

  async saveMemberFromModal(e) {
    if (e) e.preventDefault();
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    const db = StorageService.getData();
    const id = document.getElementById('member-id').value;
    const name = document.getElementById('member-name').value.trim();
    const phone = document.getElementById('member-phone').value.trim();
    const email = document.getElementById('member-email').value.trim();
    const unavailStr = document.getElementById('member-unavailable').value.trim();
    
    const unavailDates = unavailStr ? unavailStr.split(',').map(s => s.trim()).filter(s => s) : [];
    const skillCheckboxes = document.querySelectorAll('#member-skills-checkboxes input[type="checkbox"]:checked');
    const selectedSkills = Array.from(skillCheckboxes).map(cb => cb.value);

    if (!name) {
      alert("Member name is required.");
      return;
    }

    const gradients = [
      "from-blue-600 to-indigo-700",
      "from-emerald-600 to-teal-700",
      "from-amber-600 to-orange-700",
      "from-purple-600 to-pink-700",
      "from-rose-600 to-red-700",
      "from-cyan-600 to-blue-700",
      "from-violet-600 to-purple-700",
      "from-teal-600 to-emerald-700"
    ];

    if (id) {
      const member = db.members.find(m => m.id === id);
      if (member) {
        member.name = name;
        member.phone = phone;
        member.email = email;
        member.skills = selectedSkills;
        member.unavailableDates = unavailDates;
      }
    } else {
      const newMember = {
        id: 'mem_' + Date.now(),
        name: name,
        phone: phone,
        email: email,
        skills: selectedSkills,
        status: 'Active',
        unavailableDates: unavailDates,
        avatarColor: gradients[Math.floor(Math.random() * gradients.length)]
      };
      db.members.push(newMember);
    }

    await StorageService.saveAll();
    this.closeMemberModal();
    this.renderMembersList();
    App.showToast("Team member updated!");
  },

  async deleteMember(id) {
    if (!AdminAuth.isAdmin) {
      AdminAuth.openLoginModal();
      return;
    }

    if (!confirm("Are you sure you want to remove this member from the team?")) return;
    const db = StorageService.getData();
    db.members = db.members.filter(m => m.id !== id);
    await StorageService.saveAll();
    this.renderMembersList();
    App.showToast("Member removed.");
  }
};
