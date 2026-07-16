// ===== PROFILE MANAGEMENT =====
const PROFILES_KEY = 'xauusd_journal_profiles';
const ACTIVE_PROFILE_KEY = 'xauusd_journal_active_profile';
let activeProfile = '';
let profiles = [];

function getTradeKey() { return 'xauusd_journal_trades_' + activeProfile; }

function getCurrentProfile() {
  return profiles.find(p => p.name === activeProfile) || null;
}

function getCurrentAccountType() {
  const p = getCurrentProfile();
  return p ? p.accountType : 'USD';
}

function getCurrentMode() {
  const p = getCurrentProfile();
  return p ? p.mode : 'Real';
}

function migrateProfiles(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return arr;
  if (typeof arr[0] === 'string') {
    return arr.map(function(name) {
      return { name: name, mode: 'Real', accountType: 'USD' };
    });
  }
  return arr;
}

function loadProfiles() {
  try {
    const saved = localStorage.getItem(PROFILES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        profiles = parsed.map(function(name) {
          return { name: name, mode: 'Real', accountType: 'USD' };
        });
        saveProfiles();
      } else {
        profiles = parsed;
      }
      return;
    }
    profiles = [];
  } catch { profiles = []; }
}

function saveProfiles() {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  syncToFirestore();
}

function loadActiveProfile() {
  try {
    const saved = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (saved && profiles.some(p => p.name === saved)) activeProfile = saved;
    else if (profiles.length > 0) activeProfile = profiles[0].name;
    else activeProfile = '';
  } catch {}
}

function saveActiveProfile() {
  localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfile);
  syncToFirestore();
}

function renderProfileSelect() {
  const sel = document.getElementById('profileSelect');
  if (!sel) return;
  sel.innerHTML = profiles.map(function(p) {
    return '<option value="' + escapeHtml(p.name) + '" ' + (p.name === activeProfile ? 'selected' : '') + '>👤 ' + escapeHtml(p.name) + '</option>';
  }).join('') + (profiles.length > 0 ? '<option value="__logout__" disabled>──────────</option><option value="__logout__">🚪 Logout</option>' : '');
}

function renderInfoBar() {
  const el = document.getElementById('profileInfoBar');
  if (!el) return;
  const p = getCurrentProfile();
  if (p) {
    el.textContent = '👤 ' + p.name + ' • ' + (p.mode === 'Demo' ? '🎮' : '💰') + ' ' + p.mode + ' • ' + (p.accountType === 'IDR' ? '🇮🇩' : p.accountType === 'USDCent' ? '💵' : '🇺🇸') + ' ' + p.accountType;
  } else {
    el.textContent = '👤 —';
  }
  const hiddenSelect = document.getElementById('accountType');
  if (hiddenSelect && p) hiddenSelect.value = p.accountType;
  updateAccountLabels();
}

function switchProfile(name) {
  if (name === activeProfile || !profiles.some(p => p.name === name)) return;
  saveTrades();
  activeProfile = name;
  saveActiveProfile();
  loadTrades();
  renderInfoBar();
  renderProfileSelect();
  renderAll();
}

function addAccount() {
  const nameEl = document.getElementById('newAccountName');
  const modeEl = document.getElementById('newAccountMode');
  const typeEl = document.getElementById('newAccountType');
  const name = (nameEl.value || '').trim();
  if (!name) { showFlash('Nama akun harus diisi', 'error'); return; }
  if (profiles.some(p => p.name === name)) { showFlash('Nama akun sudah ada', 'error'); return; }
  profiles.push({ name: name, mode: modeEl.value, accountType: typeEl.value });
  saveProfiles();
  switchProfile(name);
  closeModal('modalAddAccount');
  nameEl.value = '';
  showFlash('Akun "' + name + '" berhasil dibuat', 'success');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.auth-form').forEach(function(el) { el.style.display = 'none'; });
  document.querySelector('.auth-tab[onclick*="' + tab + '"]').classList.add('active');
  document.getElementById('authForm' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = '';
}

function registerUser() {
  var email = document.getElementById('regEmail').value;
  var pass = document.getElementById('regPassword').value;
  var name = (document.getElementById('regName').value || '').trim();
  var mode = document.getElementById('regMode').value;
  var type = document.getElementById('regAccountType').value;
  if (!email || !pass || !name) { showFlash('Isi semua field', 'error'); return; }
  if (pass.length < 6) { showFlash('Password min 6 karakter', 'error'); return; }
  showFlash('📝 Mendaftarkan...', 'info');
  firebase.auth().createUserWithEmailAndPassword(email, pass).then(function(cred) {
    fbUser = cred.user;
    firebaseReady = true;
    profiles = [{ name: name, mode: mode, accountType: type }];
    activeProfile = name;
    saveProfiles();
    saveActiveProfile();
    updateSyncStatus();
    closeModal('modalAuth');
    loadFromFirestore().then(function() {
      renderInfoBar();
      renderProfileSelect();
      renderAll();
      showFlash('✅ Akun "' + name + '" berhasil dibuat!', 'success');
    });
  }).catch(function(e) {
    showFlash('Gagal daftar: ' + e.message, 'error');
  });
}

function loginUser() {
  var email = document.getElementById('loginEmail').value;
  var pass = document.getElementById('loginPassword').value;
  if (!email || !pass) { showFlash('Isi email dan password', 'error'); return; }
  showFlash('🔐 Memproses login...', 'info');
  firebase.auth().signInWithEmailAndPassword(email, pass).then(function() {
    window.location.reload();
  }).catch(function(e) {
    showFlash('Gagal login: ' + e.message, 'error');
  });
}

function skipAuth() {
  showFlash('⏭ Melanjutkan tanpa akun...', 'info');
  firebase.auth().signInAnonymously().then(function() {
    window.location.reload();
  }).catch(function(e) {
    showFlash('Gagal: ' + e.message, 'error');
  });
}

function logoutAccount() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  activeProfile = '';
  trades = [];
  renderAll();
  renderProfileSelect();
  renderInfoBar();
  if (firebase.auth) {
    firebase.auth().signOut().then(function() { window.location.reload(); });
  }
}

function showFirstVisitModal() {
  if (profiles.length === 0) {
    document.getElementById('modalAddAccount').classList.add('active');
  }
}

function renderSettings() {
  var emailEl = document.getElementById('settingsEmail');
  if (emailEl && fbUser) emailEl.textContent = fbUser.email || 'Anonymous';
  var selEdit = document.getElementById('settingsProfileSelect');
  var nameInput = document.getElementById('settingsProfileName');
  var selDel = document.getElementById('settingsDeleteProfile');
  if (selEdit) {
    selEdit.innerHTML = profiles.map(function(p) { return '<option value="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</option>'; }).join('');
    var cur = getCurrentProfile();
    if (cur) {
      selEdit.value = cur.name;
      if (nameInput) nameInput.value = cur.name;
      document.getElementById('settingsProfileMode').value = cur.mode;
      document.getElementById('settingsProfileType').value = cur.accountType;
    }
  }
  if (selDel) {
    selDel.innerHTML = profiles.map(function(p) { return '<option value="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</option>'; }).join('');
  }
  try {
    var d = JSON.parse(localStorage.getItem('xauusd_form_defaults'));
    if (d) {
      document.getElementById('settingsDefaultLot').value = d.lot || '0.01';
      document.getElementById('settingsDefaultCompliance').value = d.compliance || 'Yes';
      document.getElementById('settingsDefaultEmotion').value = d.emotion || 'Percaya Diri';
    }
  } catch {}
}

function changePassword() {
  var pass = document.getElementById('settingsNewPass').value;
  if (!pass || pass.length < 6) { showFlash('Password minimal 6 karakter', 'error'); return; }
  if (!firebase.auth().currentUser) { showFlash('Tidak terautentikasi', 'error'); return; }
  firebase.auth().currentUser.updatePassword(pass).then(function() {
    showFlash('✅ Password berhasil diubah', 'success');
    document.getElementById('settingsNewPass').value = '';
  }).catch(function(e) {
    showFlash('Gagal: ' + e.message, 'error');
  });
}

function saveProfileSettings() {
  var originalName = document.getElementById('settingsProfileSelect').value;
  var newName = document.getElementById('settingsProfileName').value.trim();
  var mode = document.getElementById('settingsProfileMode').value;
  var type = document.getElementById('settingsProfileType').value;
  var p = profiles.find(function(x) { return x.name === originalName; });
  if (!p) { showFlash('Profile tidak ditemukan', 'error'); return; }
  if (!newName) { showFlash('Nama profile tidak boleh kosong', 'error'); return; }
  if (newName !== originalName && profiles.some(function(x) { return x.name === newName; })) {
    showFlash('Nama "' + newName + '" sudah dipakai', 'error'); return;
  }
  if (newName !== originalName) {
    var oldKey = 'xauusd_journal_trades_' + originalName;
    var newKey = 'xauusd_journal_trades_' + newName;
    var tradesData = JSON.parse(localStorage.getItem(oldKey) || '[]');
    localStorage.setItem(newKey, JSON.stringify(tradesData));
    localStorage.removeItem(oldKey);
    p.name = newName;
    if (activeProfile === originalName) {
      activeProfile = newName;
      saveActiveProfile();
    }
    if (firebaseReady && firestore && fbUser) {
      var updates = {};
      updates['trades_' + newName] = tradesData;
      firestore.collection('users').doc(fbUser.uid).set({
        profiles: profiles,
        ['trades_' + newName]: tradesData
      }, { merge: true }).then(function() {
        firestore.collection('users').doc(fbUser.uid).update({
          ['trades_' + originalName]: firebase.firestore.FieldValue.delete()
        }).catch(function(e) { console.error('Firebase delete old key:', e); });
      }).catch(function(e) { console.error('Firebase set rename:', e); });
    }
  }
  p.mode = mode;
  p.accountType = type;
  saveProfiles();
  if (activeProfile === newName || activeProfile === originalName) {
    renderInfoBar();
    updateAccountLabels();
  }
  renderSettings();
  renderProfileSelect();
  showFlash('✅ Profile "' + (newName || originalName) + '" diupdate', 'success');
}

function deleteProfile(name) {
  if (!name || profiles.length <= 1) { showFlash('Tidak bisa menghapus profile terakhir', 'error'); return; }
  openModal('🗑 Hapus Profile', 'Hapus "' + name + '" dan semua tradenya?', 'Hapus', 'btn-danger', function() {
    profiles = profiles.filter(function(p) { return p.name !== name; });
    localStorage.removeItem('xauusd_journal_trades_' + name);
    if (firebaseReady && firestore && fbUser) {
      firestore.collection('users').doc(fbUser.uid).update({
        ['trades_' + name]: firebase.firestore.FieldValue.delete()
      }).catch(function(e) { console.error('Firebase delete profile trades:', e); });
    }
    if (activeProfile === name) {
      activeProfile = profiles.length > 0 ? profiles[0].name : '';
      saveActiveProfile();
    }
    saveProfiles();
    renderSettings();
    renderProfileSelect();
    renderInfoBar();
    renderAll();
    showFlash('✅ Profile "' + name + '" dihapus', 'success');
  });
}

function saveFormDefaults() {
  var d = {
    lot: document.getElementById('settingsDefaultLot').value,
    compliance: document.getElementById('settingsDefaultCompliance').value,
    emotion: document.getElementById('settingsDefaultEmotion').value
  };
  localStorage.setItem('xauusd_form_defaults', JSON.stringify(d));
  showFlash('✅ Default form tersimpan', 'success');
}

function loadFormDefaults() {
  try {
    var d = JSON.parse(localStorage.getItem('xauusd_form_defaults'));
    if (d) {
      if (d.lot) document.getElementById('lot').value = d.lot;
      if (d.compliance) document.getElementById('compliance').value = d.compliance;
      if (d.emotion) document.getElementById('emotion').value = d.emotion;
    }
  } catch {}
}

function backupAll() {
  var data = { profiles: profiles, trades: {} };
  profiles.forEach(function(p) {
    var key = 'xauusd_journal_trades_' + p.name;
    try {
      var t = JSON.parse(localStorage.getItem(key) || '[]');
      data.trades[p.name] = t;
    } catch { data.trades[p.name] = []; }
  });
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'trading-journal-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showFlash('✅ Backup selesai', 'success');
}

function restoreAll(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.profiles || !data.trades) throw new Error('Format tidak valid');
      var count = data.profiles.length;
      openModal('📤 Restore Data', 'Restore ' + count + ' profile? Semua data saat ini akan diganti.', 'Restore', 'btn-gold', function() {
        profiles = migrateProfiles(data.profiles);
        saveProfiles();
        profiles.forEach(function(p) {
          var key = 'xauusd_journal_trades_' + p.name;
          if (data.trades[p.name]) {
            localStorage.setItem(key, JSON.stringify(data.trades[p.name]));
            if (firebaseReady && firestore && fbUser) {
              firestore.collection('users').doc(fbUser.uid).set({
                profiles: profiles,
                ['trades_' + p.name]: data.trades[p.name]
              }, { merge: true }).catch(function(e) { console.error('Firebase restore:', e); });
            }
          }
        });
        activeProfile = profiles.length > 0 ? profiles[0].name : '';
        saveActiveProfile();
        window.location.reload();
      });
    } catch (err) {
      showFlash('Gagal restore: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function resetAllData() {
  openModal('🗑 Reset Semua', 'Hapus SEMUA data dari cloud + local? Tidak bisa dikembalikan.', 'Reset', 'btn-danger', function() {
    if (firebaseReady && firestore && fbUser) {
      firestore.collection('users').doc(fbUser.uid).delete().catch(function(e) { console.error('Firebase delete all:', e); });
    }
    localStorage.clear();
    ['xauusd_journal_profiles','xauusd_journal_active_profile','xauusd_form_defaults'].forEach(function(k) { localStorage.removeItem(k); });
    Object.keys(localStorage).filter(function(k) { return k.startsWith('xauusd_journal_trades_'); }).forEach(function(k) { localStorage.removeItem(k); });
    profiles = [];
    trades = [];
    activeProfile = '';
    renderAll();
    renderProfileSelect();
    renderInfoBar();
    showFlash('🗑 Semua data dihapus', 'info');
    window.location.reload();
  });
}
