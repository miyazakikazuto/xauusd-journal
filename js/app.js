// ===== APP INIT & EVENT LISTENERS =====
async function initApp() {
  try {
    showLoading();

    const fbStatus = await initFirebase();

    if (fbStatus === 'logged_in') {
      const loaded = await loadFromFirestore();
      if (!loaded) loadProfiles();
    } else if (fbStatus === 'not_logged_in') {
      loadProfiles();
      loadActiveProfile();
      loadTrades();
      renderInfoBar();
      renderProfileSelect();
      renderAll();
      setupFilterListeners();
      document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
      loadFormDefaults();
      hideLoading();
      document.getElementById('modalAuth').classList.add('active');
      return;
    } else {
      loadProfiles();
    }

    loadActiveProfile();
    loadTrades();
    renderInfoBar();
    renderProfileSelect();
    renderAll();
    setupFilterListeners();

    document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
    loadFormDefaults();
    hideLoading();
    showFirstVisitModal();
  } catch (err) {
    console.error('Init error:', err);
    var msg = document.querySelector('#loadingOverlay div:last-child');
    if (msg) msg.textContent = '⚠️ Gagal memuat: ' + err.message;
    hideLoading();
    showFlash('Gagal inisialisasi: ' + err.message, 'error');
  }
}

initApp();

// Trade table event delegation (sort, expand, actions)
document.getElementById('tradeBody').addEventListener('click', function(e) {
  var editBtn = e.target.closest('[data-edit]');
  var delBtn = e.target.closest('[data-delete]');
  var detailBtn = e.target.closest('[data-detail]');
  if (editBtn) editTrade(editBtn.dataset.edit);
  if (delBtn) deleteTrade(delBtn.dataset.delete);
  if (detailBtn) toggleExpand(detailBtn.dataset.detail);
});

document.querySelector('#trades table').addEventListener('click', function(e) {
  var th = e.target.closest('th.sortable');
  if (th) {
    var col = th.dataset.sort;
    if (sortState.col === col) {
      sortState.asc = !sortState.asc;
    } else {
      sortState.col = col;
      sortState.asc = false;
    }
    renderTable();
  }
});

// Modal click-outside
document.getElementById('modalAddAccount').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modalAddAccount');
});
document.getElementById('modalAuth').addEventListener('click', function(e) {
  if (e.target === this) closeModal('modalAuth');
});

// Settings profile select change
document.getElementById('settingsProfileSelect') && document.getElementById('settingsProfileSelect').addEventListener('change', function() {
  var p = profiles.find(function(x) { return x.name === this.value; }.bind(this));
  if (p) {
    document.getElementById('settingsProfileName').value = p.name;
    document.getElementById('settingsProfileMode').value = p.mode;
    document.getElementById('settingsProfileType').value = p.accountType;
  }
});

// Profile select change
document.getElementById('profileSelect').addEventListener('change', function() {
  if (this.value === '__logout__') { logoutAccount(); return; }
  switchProfile(this.value);
});

// Modal confirm
document.getElementById('modalConfirmBtn').addEventListener('click', function() {
  if (pendingAction) { pendingAction(); pendingAction = null; }
  closeModal();
});

// Modal overlay click-outside
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModal('modalOverlay');
    closeModal('modalAddAccount');
    closeModal('modalAuth');
  }
});

// Tab switching
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(function(reg) {
    reg.update();

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    reg.addEventListener('updatefound', function() {
      var newSW = reg.installing;
      newSW.addEventListener('statechange', function() {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showFlash('🔄 Update tersedia — memperbarui...', 'info');
        }
      });
    });
  });
}
