/* MediTrack — script.js
   - Dark mode
   - Local login (Option A)
   - Firebase Google login (Option B)
   - SMS scheduling (API-ready)
   - Medicine DB autocomplete
   - Improved scheduling handling
*/

// ---------- Firebase (replace with your config to enable Option B) ----------
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  // ... add rest of your config
};
let firebaseEnabled = false;
try {
  if (firebase && firebase.initializeApp) {
    firebase.initializeApp(FIREBASE_CONFIG);
    var auth = firebase.auth();
    var db = firebase.firestore();
    firebaseEnabled = true;
  }
} catch(e){ console.log('Firebase not configured or not loaded', e); }

// ---------- State ----------
let reminders = []; // current user's reminders
const reminderList = document.getElementById("reminderList");
const toastRoot = document.getElementById("toast");
const mapStatus = document.getElementById("mapStatus");
const medsList = document.getElementById('meds-list');
let scheduledTimers = {}; // id -> timeout id
let currentUser = null; // {type:'local'/'firebase', id: 'username' or uid}

// ---------- Sample medicine DB (you can expand / fetch) ----------
const MEDICINES_CORE = [
  "Paracetamol", "Ibuprofen", "Amoxicillin", "Metformin", "Aspirin",
  "Cetirizine", "Azithromycin", "Omeprazole", "Atorvastatin", "Vitamin C"
];

// ---------- Helpers ----------
function saveLocalAll(userId, data){
  localStorage.setItem(`meditrack_reminders_${userId}`, JSON.stringify(data));
}
function loadLocalAll(userId){
  return JSON.parse(localStorage.getItem(`meditrack_reminders_${userId}`) || '[]');
}
function showToast(msg, ms = 4000){
  const el = document.createElement('div'); el.className = 'toast-msg'; el.textContent = msg;
  toastRoot.appendChild(el); setTimeout(()=> el.remove(), ms);
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---------- Dark Mode ----------
const themeToggle = document.getElementById('theme-toggle');
const htmlRoot = document.documentElement;
function applyTheme(t){
  if(t==='dark'){ htmlRoot.setAttribute('data-theme','dark'); themeToggle.setAttribute('aria-pressed','true'); themeToggle.textContent='Light'; }
  else { htmlRoot.removeAttribute('data-theme'); themeToggle.setAttribute('aria-pressed','false'); themeToggle.textContent='Dark'; }
}
const savedTheme = localStorage.getItem('meditrack_theme');
if(savedTheme) applyTheme(savedTheme);
else {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}
themeToggle.addEventListener('click', ()=>{
  const cur = htmlRoot.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
  localStorage.setItem('meditrack_theme', cur);
  applyTheme(cur);
});

// ---------- Auth UI & Local Auth (Option A) ----------
const loginModal = document.getElementById('loginModal');
const authBtn = document.getElementById('authBtn');
const signedInAs = document.getElementById('signedInAs');

function openModal(){ loginModal.setAttribute('aria-hidden','false'); }
function closeModal(){ loginModal.setAttribute('aria-hidden','true'); }

document.getElementById('closeModal').addEventListener('click', closeModal);
authBtn.addEventListener('click', () => {
  if(currentUser) signOut();
  else openModal();
});

// Local register/login
document.getElementById('localRegisterBtn').addEventListener('click', ()=>{
  const u = document.getElementById('localUser').value.trim();
  const p = document.getElementById('localPass').value;
  if(!u || !p){ showToast('Enter username & password'); return; }
  // store local user credentials (not secure — ok for demo). Use hashed storage in real project.
  const users = JSON.parse(localStorage.getItem('meditrack_users')||'{}');
  if(users[u]){ showToast('User exists, choose login'); return; }
  users[u] = { password: p };
  localStorage.setItem('meditrack_users', JSON.stringify(users));
  showToast('Registered! You can login now.');
});

document.getElementById('localLoginBtn').addEventListener('click', ()=>{
  const u = document.getElementById('localUser').value.trim();
  const p = document.getElementById('localPass').value;
  const users = JSON.parse(localStorage.getItem('meditrack_users')||'{}');
  if(!users[u] || users[u].password !== p){ showToast('Invalid username or password'); return; }
  // successful local login
  currentUser = { type:'local', id: u, name: u };
  afterSignIn();
});

// ---------- Firebase Google Login (Option B) ----------
if(firebaseEnabled){
  document.getElementById('googleSignInBtn').addEventListener('click', async ()=>{
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const res = await auth.signInWithPopup(provider);
      currentUser = { type:'firebase', id: res.user.uid, name: res.user.displayName || res.user.email, email: res.user.email };
      afterSignIn();
      closeModal();
    } catch(e){ console.error(e); showToast('Google sign-in failed'); }
  });

  // observe on startup (keeps user signed in)
  auth.onAuthStateChanged(async user=>{
    if(user){
      currentUser = { type:'firebase', id: user.uid, name: user.displayName || user.email, email: user.email };
      await afterSignIn();
    } else {
      // if previously firebase user but now signed out, nothing
    }
  });
} else {
  document.getElementById('googleSignInBtn').addEventListener('click', ()=> showToast('Firebase not configured. See README.'));
}

// ---------- After sign-in initialization ----------
async function afterSignIn(){
  // load reminders for this user
  showToast(`Welcome ${currentUser.name || currentUser.id}`);
  authBtn.textContent = 'Logout';
  signedInAs.textContent = `Signed in as ${currentUser.name}`;
  closeModal();

  if(currentUser.type === 'local'){
    reminders = loadLocalAll(currentUser.id);
    renderReminders();
    initScheduling();
  } else if(currentUser.type === 'firebase' && firebaseEnabled){
    // load from Firestore collection users/{uid}/reminders
    try {
      const snap = await db.collection('users').doc(currentUser.id).collection('reminders').get();
      reminders = snap.docs.map(d => ({ id: Number(d.id) || d.data().id || Date.now(), ...d.data() }));
      // ensure local cache too
      saveLocalAll(currentUser.id, reminders);
      renderReminders();
      initScheduling();
    } catch(e){ console.warn('load firebase reminders failed', e); reminders = loadLocalAll(currentUser.id); renderReminders(); initScheduling(); }
  }
}

// sign out
function signOut(){
  if(currentUser?.type === 'firebase' && firebaseEnabled) auth.signOut().catch(()=>{});
  currentUser = null;
  reminders = [];
  renderReminders();
  cancelAllTimers();
  authBtn.textContent = 'Login';
  signedInAs.textContent = '';
  showToast('Signed out');
}

// ---------- CRUD ----------
function renderReminders(){
  reminderList.innerHTML = '';
  if (!reminders.length) { reminderList.innerHTML = '<p class="muted">No reminders set</p>'; return; }
  reminders.slice().reverse().forEach(r => {
    const div = document.createElement('div'); div.className = 'reminder-card';
    div.innerHTML = `<div>
        <strong>💊 ${escapeHtml(r.medicine)}</strong><div class="muted">${r.time} • ${r.recurrence}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="editReminder(${r.id})" style="background:#0284c7">Edit</button>
        <button onclick="deleteReminder(${r.id})">Remove</button>
      </div>`;
    reminderList.appendChild(div);
  });
}

function addReminder(){
  if(!currentUser){ showToast('Please login first'); openModal(); return; }
  const medicine = document.getElementById('medicineName').value.trim();
  const time = document.getElementById('medicineTime').value;
  const recurrence = document.getElementById('recurrence').value;
  const sendSms = document.getElementById('smsToggle').checked;
  const phone = document.getElementById('phoneInput').value.trim();
  if (!medicine || !time) { showToast('⚠️ Please enter medicine and time'); return; }
  if(sendSms && !phone){ showToast('Enter phone number to send SMS'); return; }

  const reminder = { id: Date.now(), medicine, time, recurrence, sendSms, phone };
  reminders.push(reminder);
  // persist
  if(currentUser.type === 'local') {
    saveLocalAll(currentUser.id, reminders);
  } else if(currentUser.type === 'firebase' && firebaseEnabled){
    // store in Firestore (document id = id)
    db.collection('users').doc(currentUser.id).collection('reminders').doc(String(reminder.id)).set(reminder).catch(e=>console.warn(e));
    saveLocalAll(currentUser.id, reminders); // cache
  }
  renderReminders(); showToast('✅ Reminder added');
  document.getElementById('medicineName').value = ''; document.getElementById('medicineTime').value = '';
  scheduleLocalNotification(reminder);
  // schedule SMS if requested
  if(reminder.sendSms){
    scheduleSmsReminder(reminder);
  }
}

function deleteReminder(id){
  reminders = reminders.filter(r => r.id !== id);
  if(currentUser?.type === 'local') saveLocalAll(currentUser.id, reminders);
  if(currentUser?.type === 'firebase' && firebaseEnabled) {
    db.collection('users').doc(currentUser.id).collection('reminders').doc(String(id)).delete().catch(()=>{});
    saveLocalAll(currentUser.id, reminders);
  }
  clearTimer(id);
  renderReminders(); showToast('🗑️ Reminder removed');
}

function editReminder(id){
  const r = reminders.find(x => x.id === id);
  if (!r) return;
  const newName = prompt('Medicine name', r.medicine) || r.medicine;
  const newTime = prompt('Time (HH:MM)', r.time) || r.time;
  const newRec = prompt('Recurrence (once/daily/weekly)', r.recurrence) || r.recurrence;
  r.medicine = newName; r.time = newTime; r.recurrence = newRec;
  if(currentUser?.type === 'local') saveLocalAll(currentUser.id, reminders);
  if(currentUser?.type === 'firebase' && firebaseEnabled) db.collection('users').doc(currentUser.id).collection('reminders').doc(String(id)).set(r).catch(()=>{});
  clearTimer(id); scheduleLocalNotification(r);
  renderReminders(); showToast('✏️ Reminder updated');
}

// ---------- Scheduling logic (tab must be open; service worker + push recommended for exact offline) ----------
function clearTimer(id){
  if(scheduledTimers[id]){ clearTimeout(scheduledTimers[id]); delete scheduledTimers[id]; }
}
function cancelAllTimers(){ Object.keys(scheduledTimers).forEach(k => clearTimeout(scheduledTimers[k])); scheduledTimers = {}; }

function scheduleLocalNotification(rem){
  try {
    // clear old timer
    clearTimer(rem.id);
    const [hh, mm] = rem.time.split(':').map(Number);
    const now = new Date();
    let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;

    scheduledTimers[rem.id] = setTimeout(() => {
      // play sound & show toast & notification
      new Audio('https://www.soundjay.com/buttons/beep-07.mp3').play().catch(()=>{});
      showToast(`🔔 Time to take: ${rem.medicine}`);
      if ('Notification' in window && Notification.permission === 'granted'){
        navigator.serviceWorker.ready.then(reg => {
          try { reg.showNotification('💊 Medicine Reminder', { body: rem.medicine, icon: '/icon-192.png', tag: String(rem.id) }); }
          catch(e){ new Notification('💊 Medicine Reminder', { body: rem.medicine }); }
        });
      }
      // handle sms if requested
      if(rem.sendSms && rem.phone) scheduleSmsReminder(rem);

      // recurrence
      if (rem.recurrence === 'daily'){
        rem.time = rem.time; // no change
        scheduleLocalNotification(rem); // schedule next day
      } else if (rem.recurrence === 'weekly'){
        // schedule 7 days later
        scheduledTimers[rem.id] = setTimeout(()=> scheduleLocalNotification(rem), 7 * 24 * 60 * 60 * 1000);
      } else { // once
        reminders = reminders.filter(x => x.id !== rem.id);
        if(currentUser?.type === 'local') saveLocalAll(currentUser.id, reminders);
        if(currentUser?.type === 'firebase' && firebaseEnabled) db.collection('users').doc(currentUser.id).collection('reminders').doc(String(rem.id)).delete().catch(()=>{});
        renderReminders();
      }
    }, delay);
  } catch(e){ console.warn('scheduling failed', e); }
}

// initialize scheduling for existing reminders
function initScheduling(){
  cancelAllTimers();
  reminders.forEach(scheduleLocalNotification);
}

// ---------- SMS scheduling (client -> server placeholder) ----------
async function scheduleSmsReminder(rem){
  // client calls your backend to schedule SMS (recommended)
  // Example payload: { phone, message, datetimeISO, id }
  const [hh, mm] = rem.time.split(':').map(Number);
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const payload = { phone: rem.phone, message: `Time to take ${rem.medicine}`, datetime: target.toISOString(), id: rem.id };

  // If you have a server endpoint, call it:
  try {
    await fetch('/api/schedule-sms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast('SMS scheduled (via server)');
  } catch(e){
    console.warn('schedule-sms failed (no backend configured)', e);
    showToast('SMS scheduling not configured (server missing)');
  }
}

// Simple sendSms immediate (for testing without scheduler)
async function sendSmsNow(phone, message){
  try {
    await fetch('/api/send-sms-now', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({phone,message})
    });
    showToast('SMS sent (server)');
  } catch(e){ showToast('SMS send failed (server missing)'); }
}

// ---------- Import / Export ----------
document.getElementById('exportBtn').addEventListener('click', () => {
  if(!currentUser){ showToast('Login to export your reminders'); return; }
  const blob = new Blob([JSON.stringify(reminders, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${currentUser.id}-meditrack-reminders.json`; a.click();
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader(); r.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed)) throw new Error('invalid format');
      reminders = parsed;
      if(currentUser?.type === 'local') saveLocalAll(currentUser.id, reminders);
      if(currentUser?.type === 'firebase' && firebaseEnabled) {
        // simple overwrite to Firestore (dangerous, demo only)
        const batch = db.batch();
        reminders.forEach(rem => {
          const ref = db.collection('users').doc(currentUser.id).collection('reminders').doc(String(rem.id));
          batch.set(ref, rem);
        });
        batch.commit().catch(()=>{});
      }
      renderReminders(); initScheduling(); showToast('📥 Imported reminders');
    } catch (err){ showToast('❌ Import failed: invalid file'); }
  }; r.readAsText(f);
});

// ---------- Map (init same as before) ----------
function initMap(){
  const map = L.map('map', { preferCanvas:true }).setView([22.5726, 88.3639], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  mapStatus.textContent = 'Locating...';

  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      map.setView([lat, lon], 14);
      L.marker([lat, lon]).addTo(map).bindPopup('📍 You are here').openPopup();
      mapStatus.textContent = 'Fetching nearby pharmacies (using Overpass)...';
      // Overpass query (same as before)
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="pharmacy"](around:2000,${lat},${lon});
          way["amenity"="pharmacy"](around:2000,${lat},${lon});
          relation["amenity"="pharmacy"](around:2000,${lat},${lon});
        );
        out center 30;
      `;
      try {
        const res = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body: query });
        const data = await res.json();
        const items = (data.elements || []).slice(0, 30);
        if (!items.length) mapStatus.textContent = 'No nearby pharmacies found.';
        items.forEach(el => {
          const lat2 = el.lat || el.center?.lat; const lon2 = el.lon || el.center?.lon;
          if (!lat2 || !lon2) return;
          const name = el.tags?.name || 'Pharmacy';
          L.marker([lat2, lon2]).addTo(map).bindPopup(`🏥 ${name}`);
        });
        mapStatus.textContent = `Loaded ${items.length} pharmacies`;
      } catch (err) {
        console.warn(err);
        mapStatus.textContent = 'Could not fetch live pharmacies — showing demo locations.';
        const demo = [
          {name:'Apollo Pharmacy', coords:[22.5726,88.3639]},
          {name:'MedPlus', coords:[22.5850,88.4150]},
          {name:'Netmeds Store', coords:[22.6200,88.4500]}
        ];
        demo.forEach(d => L.marker(d.coords).addTo(map).bindPopup(`🏥 ${d.name}`));
      }
    }, (err) => {
      mapStatus.textContent = 'Location permission denied — showing demo pharmacies.';
      const demo = [
        {name:'Apollo Pharmacy', coords:[22.5726,88.3639]},
        {name:'MedPlus', coords:[22.5850,88.4150]},
        {name:'Netmeds Store', coords:[22.6200,88.4500]}
      ];
      demo.forEach(d => L.marker(d.coords).addTo(map).bindPopup(`🏥 ${d.name}`));
    });
  } else {
    mapStatus.textContent = 'Geolocation not available — showing demo pharmacies.';
  }
}

// ---------- Medicine autocomplete population ----------
function populateMedicineList(){
  const list = Array.from(new Set([...MEDICINES_CORE, ... (JSON.parse(localStorage.getItem('meditrack_meds')||'[]'))]));
  medsList.innerHTML = '';
  list.forEach(m => { const opt = document.createElement('option'); opt.value = m; medsList.appendChild(opt); });
}
populateMedicineList();

// ---------- Init ----------
document.getElementById('addBtn').addEventListener('click', addReminder);
document.getElementById('exportBtn').addEventListener('click', ()=>{}); // already bound above
renderReminders();
initScheduling();
initMap();

// Request notification permission proactively (best UX: ask when user creates first reminder too)
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().then(p => { if (p === 'granted') showToast('🔔 Notifications enabled'); });
}
