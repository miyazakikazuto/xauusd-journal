// ===== FIREBASE =====
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAQk8zcp5pZFGwRXJO7ysjGu1hQL0CziRw",
  authDomain: "xauusd-jurnal.firebaseapp.com",
  projectId: "xauusd-jurnal",
  storageBucket: "xauusd-jurnal.firebasestorage.app",
  messagingSenderId: "977650715760",
  appId: "1:977650715760:web:c0c9ecad03409cd3a3b8b5"
};

let firebaseReady = false;
let firestore = null;
let fbUser = null;

function isFirebaseConfigured() {
  return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 10 &&
         FIREBASE_CONFIG.apiKey !== "isi-dari-firebase-console";
}

function initFirebase() {
  return new Promise(function(resolve) {
    var resolved = false;
    function done(status) {
      if (resolved) return;
      resolved = true;
      updateSyncStatus();
      resolve(status);
    }
    if (!isFirebaseConfigured()) { done('offline'); return; }
    if (window.location.protocol === 'file:') {
      console.warn('Firebase: buka via http:// atau https://, bukan file://');
      done('offline'); return;
    }
    setTimeout(function() { done('offline'); }, 15000);
    try {
      let app;
      try { app = firebase.initializeApp(FIREBASE_CONFIG); }
      catch (e) { app = firebase.app(); }
      firestore = firebase.firestore(app);
      const auth = firebase.auth(app);
      auth.onAuthStateChanged(function(user) {
        if (user) {
          fbUser = user;
          firebaseReady = true;
        } else {
          fbUser = null;
          firebaseReady = false;
        }
        updateSyncStatus();
        done(user ? 'logged_in' : 'not_logged_in');
      });
    } catch (e) {
      console.warn('Firebase: ' + e.message);
      done('offline');
    }
  });
}

function updateSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (firebaseReady && fbUser) {
    if (fbUser.email) {
      el.textContent = fbUser.email;
      el.className = 'header-badge badge-cloud';
      el.title = 'Tersambung sebagai ' + fbUser.email;
    } else {
      el.textContent = '☁️ Cloud';
      el.className = 'header-badge badge-cloud';
      el.title = 'Tersambung ke Firebase';
    }
  } else if (window.location.protocol === 'file:') {
    el.textContent = '💻 Local (file://)';
    el.className = 'header-badge badge-local';
    el.title = 'Buka via http:// agar Firebase bisa connect';
  } else if (isFirebaseConfigured()) {
    el.textContent = '⚠️ Offline';
    el.className = 'header-badge badge-offline';
  } else {
    el.textContent = '💻 Local';
    el.className = 'header-badge badge-local';
  }
}

function showLoading() {
  var isLocal = window.location.protocol === 'file:' || !window.location.href.startsWith('http');
  document.getElementById('loadingText').textContent = isLocal ? '📂 Memuat data lokal...' : '☁️ Menghubungkan ke cloud...';
  document.getElementById('loadingOverlay').classList.remove('hidden');
  document.getElementById('skipLoadingBtn').onclick = function() {
    hideLoading();
    loadProfiles();
    loadActiveProfile();
    loadTrades();
    renderInfoBar();
    renderProfileSelect();
    renderAll();
    setupFilterListeners();
    document.getElementById('tgl').value = new Date().toISOString().slice(0,10);
    loadFormDefaults();
    showFirstVisitModal();
  };
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

async function syncToFirestore() {
  if (!firebaseReady || !firestore || !fbUser) return;
  try {
    const batch = {};
    batch.profiles = profiles;
    batch.activeProfile = activeProfile;
    batch['trades_' + activeProfile] = trades;

    await firestore.collection('users').doc(fbUser.uid).set(batch, { merge: true });
  } catch (e) {
    console.warn('Firestore sync: ' + e.message);
  }
}

async function loadFromFirestore() {
  if (!firebaseReady || !firestore || !fbUser) return false;
  try {
    const snap = await firestore.collection('users').doc(fbUser.uid).get();
    if (!snap.exists) return false;
    const data = snap.data();
    if (data.profiles) {
      profiles = migrateProfiles(data.profiles);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    }
    if (data.activeProfile) {
      activeProfile = data.activeProfile;
      localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfile);
    }
    const tradeKey = 'trades_' + activeProfile;
    if (data[tradeKey]) {
      trades = data[tradeKey];
      localStorage.setItem(getTradeKey(), JSON.stringify(trades));
    }
    return true;
  } catch (e) {
    console.warn('Firestore load: ' + e.message);
    return false;
  }
}
