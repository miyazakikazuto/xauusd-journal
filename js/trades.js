// ===== TRADE STORAGE & RENDER =====
let trades = [];
let pendingAction = null;
let editingId = null;
let sortState = { col: 'date', asc: false };

function sortTrades(arr) {
  var col = sortState.col;
  var dir = sortState.asc ? 1 : -1;
  return [...arr].sort(function(a, b) {
    var va, vb;
    switch (col) {
      case 'pair': va = (a.pair || '').toUpperCase(); vb = (b.pair || '').toUpperCase(); break;
      case 'direction': va = a.direction === 'BUY' ? 0 : 1; vb = b.direction === 'BUY' ? 0 : 1; break;
      case 'date':
        va = (a.date || '') + 'T' + (a.createdAt || '').split('T')[1] || '00:00';
        vb = (b.date || '') + 'T' + (b.createdAt || '').split('T')[1] || '00:00';
        break;
      case 'entry': va = parseFloat(a.entry) || 0; vb = parseFloat(b.entry) || 0; break;
      case 'usd': va = parseFloat(a.usd) || 0; vb = parseFloat(b.usd) || 0; break;
      default: va = a.date || ''; vb = b.date || '';
    }
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });
}

function loadTrades() {
  try {
    const data = localStorage.getItem(getTradeKey());
    trades = data ? JSON.parse(data) : [];
  } catch { trades = []; }
}

async function saveTrades() {
  localStorage.setItem(getTradeKey(), JSON.stringify(trades));
  await syncToFirestore();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const p = dateStr.split('-');
  if (p.length !== 3) return dateStr;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function formatTimestamp(iso) {
  if (!iso) return '-';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch { return '-'; }
}

function calcPercentChange(entry, exit) {
  var e = parseFloat(entry), x = parseFloat(exit);
  if (isNaN(e) || isNaN(x) || e === 0) return '';
  var pct = (x - e) / e * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function getCoinClass(pair) {
  var upper = (pair || '').toUpperCase();
  if (upper.includes('XAU') || upper.includes('GOLD')) return 'coin-gold';
  if (upper.includes('XAG') || upper.includes('SILVER')) return 'coin-silver';
  if (upper.includes('BTC')) return 'coin-orange';
  if (upper.includes('ETH')) return 'coin-purple';
  return 'coin-blue';
}

function getPipMultiplier(pair) {
  const upper = (pair || 'XAUUSD').toUpperCase();
  if (upper.includes('XAU') || upper.includes('GOLD')) return 100;
  if (upper.includes('JPY')) return 100;
  if (upper.includes('XAG') || upper.includes('SILVER')) return 10;
  if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL')) return 1;
  return 10000;
}

function getPipValue(pair) {
  const upper = (pair || 'XAUUSD').toUpperCase();
  if (upper.includes('XAU') || upper.includes('GOLD')) return 10;
  if (upper.includes('XAG') || upper.includes('SILVER')) return 5;
  if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL')) return 1;
  return 10;
}

function calcResult(entry, exit, dir) {
  const e = parseFloat(entry), x = parseFloat(exit);
  if (isNaN(e) || isNaN(x)) return { result: '-', signedPips: 0 };
  const diff = x - e;
  const signedPips = dir === 'SELL' ? -diff : diff;
  let result = 'BE';
  if (signedPips > 0.0001) result = 'Win';
  else if (signedPips < -0.0001) result = 'Loss';
  const multiplier = getPipMultiplier(document?.getElementById('pair')?.value || 'XAUUSD');
  return { result, signedPips: Math.round(signedPips * multiplier * 10) / 10 };
}

function getPipsFromExit() {
  const entry = parseFloat(document.getElementById('entry').value);
  const exit = parseFloat(document.getElementById('exit').value);
  const dir = document.getElementById('arah').value;
  if (isNaN(entry) || isNaN(exit) || !dir) return '';
  const { signedPips } = calcResult(entry, exit, dir);
  return signedPips;
}

function autoUpdatePips() {
  const pipsField = document.getElementById('pips');
  const pips = getPipsFromExit();
  pipsField.value = pips !== '' ? pips : '';
  autoUpdateUSD();
}

function autoUpdateUSD() {
  const accountType = getCurrentAccountType();
  if (accountType === 'IDR') {
    document.getElementById('usd').value = '';
    document.getElementById('usd').placeholder = 'isi manual';
    return;
  }
  document.getElementById('usd').placeholder = 'auto';
  const pips = parseFloat(document.getElementById('pips').value);
  const lot = parseFloat(document.getElementById('lot').value);
  const pair = document.getElementById('pair').value;
  if (!isNaN(pips) && !isNaN(lot) && lot > 0) {
    const pipValue = getPipValue(pair);
    let result = pips * lot * pipValue;
    if (accountType === 'USDCent') result /= 100;
    document.getElementById('usd').value = Math.round(result * 100) / 100;
  }
}

function updateAccountLabels() {
  const type = document.getElementById('accountType').value;
  const label = document.getElementById('usdLabel');
  const mappings = {
    'USD': 'USD P/L <span class="text-muted">(auto)</span>',
    'USDCent': 'USD P/L <span class="text-muted">(auto ÷100)</span>',
    'IDR': 'IDR P/L <span class="text-muted">(manual)</span>'
  };
  label.innerHTML = mappings[type] || mappings.USD;
  const statLabel = document.querySelector('.stat-card:nth-child(4) .label');
  if (statLabel) statLabel.textContent = type === 'IDR' ? 'Total P/L (IDR)' : 'Total P/L';
  const th = document.querySelector('th.sortable[data-sort="usd"]');
  if (th) {
    var pnlLabel = 'PnL';
    if (type === 'IDR') pnlLabel = 'PnL (IDR)';
    else if (type === 'USDCent') pnlLabel = 'PnL (¢)';
    th.childNodes[0].textContent = pnlLabel;
  }
}

document.getElementById('entry').addEventListener('input', autoUpdatePips);
document.getElementById('exit').addEventListener('input', autoUpdatePips);
document.getElementById('arah').addEventListener('input', autoUpdatePips);
document.getElementById('pair').addEventListener('change', autoUpdatePips);
document.getElementById('lot').addEventListener('input', autoUpdateUSD);

function renderStats() {
  const total = trades.length;
  const wins = trades.filter(t => t.result === 'Win').length;
  const losses = trades.filter(t => t.result === 'Loss').length;
  const bes = trades.filter(t => t.result === 'BE').length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalPips = trades.reduce((s, t) => s + (parseFloat(t.pips) || 0), 0);
  const totalUSD = trades.reduce((s, t) => s + (parseFloat(t.usd) || 0), 0);
  const avgPips = total > 0 ? (totalPips / total) : 0;
  const compliant = trades.filter(t => t.compliance === 'Yes').length;
  const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

  const sorted = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  let curWin = 0, curLoss = 0;
  for (const t of sorted) {
    if (t.result === 'Win') { curWin++; curLoss = 0; }
    else if (t.result === 'Loss') { curLoss++; curWin = 0; }
  }
  var lastResult = sorted.length > 0 ? sorted[sorted.length - 1].result : null;
  if (lastResult === 'BE') { curWin = 0; curLoss = 0; }

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statWinRate').textContent = winRate + '%';
  const pipEl = document.getElementById('statPips');
  pipEl.textContent = (totalPips >= 0 ? '+' : '') + totalPips.toFixed(1);
  pipEl.className = 'value ' + (totalPips > 0 ? 'win' : totalPips < 0 ? 'loss' : 'neutral');
  const usdEl = document.getElementById('statUSD');
  const accountType = getCurrentAccountType();
  const symbol = accountType === 'IDR' ? 'Rp' : '$';
  usdEl.textContent = (totalUSD >= 0 ? '+' : '') + symbol + totalUSD.toFixed(2);
  usdEl.className = 'value ' + (totalUSD > 0 ? 'win' : totalUSD < 0 ? 'loss' : 'neutral');
  document.getElementById('statAvgPips').textContent = avgPips.toFixed(1);
  document.getElementById('statWinStreak').textContent = curWin;
  document.getElementById('statLossStreak').textContent = curLoss;
  document.getElementById('statCompliance').textContent = complianceRate + '%';
}

function getFilteredTrades() {
  var pair = document.getElementById('filterPair').value;
  var result = document.getElementById('filterResult').value;
  var sesi = document.getElementById('filterSesi').value;
  var search = document.getElementById('filterSearch').value.toLowerCase();
  return trades.filter(function(t) {
    if (pair !== 'All' && t.pair !== pair) return false;
    if (result !== 'All' && t.result !== result) return false;
    if (sesi !== 'All' && t.session !== sesi) return false;
    if (search && !t.pair.toLowerCase().includes(search) &&
        !(t.setup || '').toLowerCase().includes(search) &&
        !(t.note || '').toLowerCase().includes(search)) return false;
    return true;
  });
}

function resetFilters() {
  document.getElementById('filterPair').value = 'All';
  document.getElementById('filterResult').value = 'All';
  document.getElementById('filterSesi').value = 'All';
  document.getElementById('filterSearch').value = '';
  renderTable();
}

function setupFilterListeners() {
  ['filterPair', 'filterResult', 'filterSesi'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', renderTable);
  });
  document.getElementById('filterSearch').addEventListener('input', renderTable);
}

function renderSortIcon() {
  ['pair', 'direction', 'date', 'entry', 'usd'].forEach(function(col) {
    var el = document.getElementById('si-' + col);
    if (el) {
      el.className = 'sort-icon' + (sortState.col === col ? (sortState.asc ? ' asc' : ' desc') : '');
    }
  });
}

function toggleExpand(id) {
  var detail = document.getElementById('detail-' + id);
  var toggle = document.querySelector('[data-detail="' + id + '"]');
  if (detail && toggle) {
    var hidden = detail.hasAttribute('hidden');
    if (hidden) {
      detail.removeAttribute('hidden');
      toggle.classList.add('open');
    } else {
      detail.setAttribute('hidden', '');
      toggle.classList.remove('open');
    }
  }
}

function renderTable() {
  var filtered = getFilteredTrades();
  var tbody = document.getElementById('tradeBody');
  var empty = document.getElementById('emptyState');
  var emptyFilter = document.getElementById('emptyFilter');
  var countEl = document.getElementById('filterCount');

  if (trades.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    emptyFilter.style.display = 'none';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'none';
    emptyFilter.style.display = 'block';
    if (countEl) countEl.textContent = '0 dari ' + trades.length + ' trade';
    return;
  }

  empty.style.display = 'none';
  emptyFilter.style.display = 'none';
  if (countEl) countEl.textContent = filtered.length + ' dari ' + trades.length + ' trade';

  var sorted = sortTrades(filtered);
  renderSortIcon();

  var symbol = getCurrentAccountType() === 'IDR' ? 'Rp' : '$';

  tbody.innerHTML = sorted.map(function(t) {
    var pctChange = calcPercentChange(t.entry, t.exit);
    var pctClass = '';
    if (pctChange) {
      var pctVal = parseFloat(pctChange);
      pctClass = pctVal > 0 ? 'text-win' : pctVal < 0 ? 'text-loss' : '';
    }
    var usdVal = parseFloat(t.usd);
    var isProfit = usdVal > 0;
    var isLoss = usdVal < 0;
    var pnlClass = isProfit ? 'pnl-profit' : isLoss ? 'pnl-loss' : 'pnl-be';
    var usdDisplay = t.usd != null ? (usdVal >= 0 ? '+' : '') + symbol + usdVal.toFixed(2) : '-';
    var dirClass = t.direction === 'BUY' ? 'long' : 'short';
    var dirArrow = t.direction === 'BUY' ? '↗' : '↘';
    var pipsVal = parseFloat(t.pips) || 0;
    var detailId = escapeHtml(t.id);

    var mainRow = '<tr class="main-row">' +
      '<td><span class="expand-toggle" data-detail="' + detailId + '">›</span></td>' +
      '<td><span class="coin-row"><span class="coin-icon ' + getCoinClass(t.pair) + '">' + t.pair.charAt(0) + '</span><span class="coin-label">' + escapeHtml(t.pair) + '</span></span></td>' +
      '<td><span class="side-arrow ' + dirClass + '">' + dirArrow + '</span> ' + escapeHtml(t.lot || '0.01') + '<br><span class="side-size">' + usdDisplay + '</span></td>' +
      '<td>' + escapeHtml(formatDateDisplay(t.date)) + ' <span class="connector">→</span><br><span class="side-size">' + escapeHtml(formatTimestamp(t.createdAt)) + '</span></td>' +
      '<td>' + escapeHtml(String(t.entry || '-')) + ' <span class="connector">→</span> ' + escapeHtml(String(t.exit || '-')) + (pctChange ? '<br><span class="pct-change ' + pctClass + '">' + pctChange + '</span>' : '') + '</td>' +
      '<td><span class="pnl-badge ' + pnlClass + '">' + usdDisplay + '</span></td>' +
      '</tr>';

    var detailRow = '<tr class="detail-row" id="detail-' + detailId + '" hidden>' +
      '<td colspan="6"><div class="detail-grid">' +
      '<div class="detail-item"><span class="detail-label">Session</span><span class="detail-value">' + escapeHtml(t.session || '-') + '</span></div>' +
      '<div class="detail-item"><span class="detail-label">Setup</span><span class="detail-value">' + escapeHtml(t.setup || '-') + '</span></div>' +
      '<div class="detail-item"><span class="detail-label">SL → TP</span><span class="detail-value">' + escapeHtml(t.sl || '-') + ' → ' + escapeHtml(t.tp || '-') + '</span></div>' +
      '<div class="detail-item"><span class="detail-label">Pips</span><span class="detail-value">' + (pipsVal > 0 ? '+' : '') + escapeHtml(t.pips || '0') + '</span></div>' +
      '<div class="detail-item"><span class="detail-label">Plan</span><span class="detail-value">' + escapeHtml(t.compliance || '-') + '</span></div>' +
      '<div class="detail-item"><span class="detail-label">Emotion</span><span class="detail-value">' + escapeHtml(t.emotion || '-') + '</span></div>' +
      (t.note ? '<div class="detail-item detail-full"><span class="detail-label">Note</span><span class="detail-value">' + escapeHtml(t.note) + '</span></div>' : '') +
      '<div class="detail-item detail-full detail-actions">' +
      '<button class="btn btn-xs btn-secondary" data-edit="' + detailId + '">✏️ Edit</button>' +
      '<button class="btn btn-xs btn-danger" data-delete="' + detailId + '">✕ Hapus</button>' +
      '</div>' +
      '</div></td></tr>';

    return mainRow + detailRow;
  }).join('');
}

function renderAll() {
  renderStats();
  renderTable();
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

function showFlash(msg, type) {
  const div = document.createElement('div');
  div.className = 'flash flash-' + type;
  div.textContent = msg;
  div.setAttribute('role', 'alert');
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function openModal(title, body, confirmText, confirmClass, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  const btn = document.getElementById('modalConfirmBtn');
  btn.textContent = confirmText;
  btn.className = 'btn ' + confirmClass;
  pendingAction = onConfirm;
  document.getElementById('modalOverlay').classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id || 'modalOverlay');
  if (el) el.classList.remove('active');
  pendingAction = null;
}

function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function(el) {
    el.classList.remove('active');
    el.setAttribute('aria-selected', 'false');
  });
  var tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  var btn = document.querySelector('[data-tab="' + name + '"]');
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  if (name === 'pengaturan') renderSettings();
}

function deleteTrade(id) {
  openModal('Hapus Trade', 'Yakin ingin menghapus trade ini? Data tidak bisa dikembalikan.', 'Hapus', 'btn-danger', function() {
    trades = trades.filter(t => t.id !== id);
    saveTrades();
    renderAll();
    showFlash('Trade berhasil dihapus', 'info');
  });
}

function editTrade(id) {
  const t = trades.find(function(tx) { return tx.id === id; });
  if (!t) return;
  editingId = id;
  document.getElementById('tgl').value = t.date;
  document.getElementById('sesi').value = t.session;
  document.getElementById('pair').value = t.pair;
  document.getElementById('setup').value = t.setup || '';
  document.getElementById('arah').value = t.direction;
  document.getElementById('entry').value = t.entry;
  document.getElementById('sl').value = t.sl || '';
  document.getElementById('tp').value = t.tp || '';
  document.getElementById('exit').value = t.exit;
  document.getElementById('lot').value = t.lot || '0.01';
  document.getElementById('usd').value = t.usd != null ? t.usd : '';
  document.getElementById('compliance').value = t.compliance;
  document.getElementById('emotion').value = t.emotion;
  document.getElementById('note').value = t.note || '';
  document.getElementById('formTitle').textContent = '✏️ EDIT TRADE';
  document.getElementById('submitBtn').textContent = '✏️ Update Trade';
  document.getElementById('cancelEditBtn').style.display = '';
  document.getElementById('resetBtn').style.display = 'none';
  autoUpdatePips();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  switchTab('input');
}

function cancelEdit() {
  if (editingId) {
    openModal('↩ Batal Edit', 'Yakin ingin membatalkan perubahan? Data yang diedit tidak akan tersimpan.', 'Ya, Batal', 'btn-secondary', function() {
      doCancelEdit();
    });
    return;
  }
  doCancelEdit();
}

function doCancelEdit() {
  editingId = null;
  document.getElementById('tradeForm').reset();
  document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('pair').selectedIndex = 0;
  loadFormDefaults();
  document.getElementById('formTitle').textContent = '📝 INPUT TRADE';
  document.getElementById('submitBtn').textContent = '💾 Simpan Trade';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('resetBtn').style.display = '';
}

function resetForm() {
  document.getElementById('tradeForm').reset();
  document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
  document.getElementById('pair').selectedIndex = 0;
  loadFormDefaults();
}

function confirmClear() {
  if (trades.length === 0) { showFlash('Belum ada data untuk dihapus', 'info'); return; }
  openModal('Hapus Semua Data', `Yakin ingin menghapus ${trades.length} trade? Data tidak bisa dikembalikan.`, 'Hapus Semua', 'btn-danger', function() {
    trades = [];
    saveTrades();
    renderAll();
    showFlash('Semua data berhasil dihapus', 'info');
  });
}

function exportJSON() {
  if (trades.length === 0) { showFlash('Belum ada data untuk di-export', 'info'); return; }
  const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-journal-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showFlash('Data berhasil di-export', 'success');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Format tidak valid');
      if (data.length === 0) { showFlash('File kosong', 'info'); return; }
      data.forEach((t, i) => {
        if (!t.id) t.id = generateId();
        if (!t.date) throw new Error('Trade #' + (i+1) + ' tidak memiliki tanggal');
      });
      openModal('📤 Import Trade', 'Import ' + data.length + ' trade? Trade dengan ID yang sama akan dilewati.', 'Import', 'btn-gold', function() {
        if (editingId) { cancelEdit(); }
        var existingIds = new Set(trades.map(function(t) { return t.id; }));
        var before = trades.length;
        data.forEach(function(t) {
          if (!existingIds.has(t.id)) {
            trades.push(t);
            existingIds.add(t.id);
          }
        });
        saveTrades();
        renderAll();
        showFlash('Berhasil import ' + (trades.length - before) + ' trade (dilewati: ' + (data.length - (trades.length - before)) + ')', 'success');
      });
    } catch (err) {
      showFlash('Gagal import: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

document.getElementById('tradeForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('submitBtn');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = '⏳ Menyimpan...';

  const date = document.getElementById('tgl').value;
  const session = document.getElementById('sesi').value;
  const pair = document.getElementById('pair').value.trim();
  const setup = document.getElementById('setup').value.trim();
  const direction = document.getElementById('arah').value;
  const entry = document.getElementById('entry').value;
  const sl = document.getElementById('sl').value;
  const tp = document.getElementById('tp').value;
  const exit = document.getElementById('exit').value;
  const pips = document.getElementById('pips').value;
  const lot = document.getElementById('lot').value;
  const usd = document.getElementById('usd').value;
  const compliance = document.getElementById('compliance').value;
  const emotion = document.getElementById('emotion').value;
  const note = document.getElementById('note').value.trim();

  if (!date || !session || !pair || !direction || !entry || !exit) {
    showFlash('Harap isi field wajib: Tanggal, Sesi, Pair, Arah, Entry, Exit', 'error');
    btn.disabled = false;
    btn.textContent = editingId ? '✏️ Update Trade' : '💾 Simpan Trade';
    return;
  }

  const entryNum = parseFloat(entry);
  const exitNum = parseFloat(exit);
  if (isNaN(entryNum) || isNaN(exitNum)) {
    showFlash('Entry dan Exit harus berupa angka', 'error');
    btn.disabled = false;
    btn.textContent = editingId ? '✏️ Update Trade' : '💾 Simpan Trade';
    return;
  }

  let result;
  let finalPips = parseFloat(pips);
  if (!isNaN(finalPips)) {
    result = finalPips > 0.0001 ? 'Win' : finalPips < -0.0001 ? 'Loss' : 'BE';
  } else {
    const calc = calcResult(entry, exit, direction);
    result = calc.result;
    finalPips = calc.signedPips;
  }

  try {
    if (editingId) {
      var idx = trades.findIndex(function(tx) { return tx.id === editingId; });
      if (idx !== -1) {
        trades[idx] = {
          id: editingId,
          date: date,
          session: session,
          pair: pair,
          setup: setup,
          direction: direction,
          entry: entryNum,
          sl: sl || '',
          tp: tp || '',
          exit: exitNum,
          pips: finalPips,
          lot: lot || '0.01',
          usd: usd || '0',
          result: result,
          compliance: compliance,
          emotion: emotion,
          note: note,
          createdAt: trades[idx].createdAt
        };
      }
      await saveTrades();
      renderAll();
      showFlash('Trade berhasil diupdate!', 'success');
      doCancelEdit();
    } else {
      var trade = {
        id: generateId(),
        date: date,
        session: session,
        pair: pair,
        setup: setup,
        direction: direction,
        entry: entryNum,
        sl: sl || '',
        tp: tp || '',
        exit: exitNum,
        pips: finalPips,
        lot: lot || '0.01',
        usd: usd || '0',
        result: result,
        compliance: compliance,
        emotion: emotion,
        note: note,
        createdAt: new Date().toISOString()
      };
      trades.push(trade);
      await saveTrades();
      renderAll();
      showFlash('Trade berhasil disimpan!', 'success');
      this.reset();
      document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
      document.getElementById('pair').selectedIndex = 0;
      loadFormDefaults();
    }
  } catch (err) {
    showFlash('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? '✏️ Update Trade' : '💾 Simpan Trade';
  }
});
