const DEPARTMENTS = ['Computer Science','Mechanical Engineering','Civil Engineering','Hostel & Facilities','Administration'];
const HOD_NAMES = {
  'Computer Science':'Dr. A. Rao','Mechanical Engineering':'Dr. K. Verma','Civil Engineering':'Dr. P. Nair',
  'Hostel & Facilities':'Mr. S. Thomas','Administration':'Ms. L. Fernandes'
};
const PRINCIPAL = 'Dr. R. Menon';
const VP = 'Dr. S. Iyer';
const ROLE_LABEL = {student:'Student', hod:'HOD', vice_principal:'Vice Principal', principal:'Principal', admin:'Admin'};
const STATUS_LABEL = {reported:'Reported', acknowledged:'Acknowledged', in_progress:'In progress', resolved:'Resolved'};
const STATUS_ORDER = ['reported','acknowledged','in_progress','resolved'];
const STATUS_ACTION = {reported:'Acknowledge', acknowledged:'Start progress', in_progress:'Mark resolved'};
const urgencyRank = {critical:0, high:1, medium:2, low:3};

// ---------- users (in-memory, demo accounts seeded) ----------
// Accounts live in js/auth.js (persisted + role-uniqueness enforced).
let users = RelayAuth.all();
let currentUser = null;

let tickets = [];
let ticketSeq = 0;
let selectedTicketId = null;
let adminSelectedTicketId = null;

function computeTargets(urgency, department){
  if(urgency === 'critical') return [
    {role:'principal', name: PRINCIPAL + ', Principal'},
    {role:'vice_principal', name: VP + ', Vice Principal'}
  ];
  if(urgency === 'high') return [
    {role:'vice_principal', name: VP + ', Vice Principal'},
    {role:'hod:'+department, name: HOD_NAMES[department] + ', HOD ' + department}
  ];
  return [{role:'hod:'+department, name: HOD_NAMES[department] + ', HOD ' + department}];
}

function makeTicket(data){
  ticketSeq += 1;
  const code = 'RLY-' + String(ticketSeq).padStart(4,'0');
  const targets = computeTargets(data.urgency, data.department);
  const now = new Date();
  return {
    id: code, ticket_code: code, title: data.title, description: data.description,
    category: data.category, urgency: data.urgency, location: data.location,
    department: data.department, photo: data.photo || null, status: 'reported',
    reporter: data.reporter, escalation_targets: targets,
    timeline: [{status:'reported', note:'Filed by ' + data.reporter, at: now}], created_at: now
  };
}

tickets.push(makeTicket({
  title:'Loose railing on library stairwell', description:'Handrail on the 2nd floor stairwell is loose and wobbles when you hold it. Several students have almost lost their footing.',
  category:'safety', urgency:'high', location:'Library, stairwell B', department:'Civil Engineering', photo:null, reporter:'Aisha Khan'
}));
tickets.push(makeTicket({
  title:'Projector not powering on, Room 204', description:'Projector in CS 204 will not turn on before the 10am class. Cable and socket both checked.',
  category:'it', urgency:'medium', location:'CS Block, Room 204', department:'Computer Science', photo:null, reporter:'Aisha Khan'
}));
tickets.push(makeTicket({
  title:'Gas smell reported near hostel kitchen', description:'Strong gas odor near the mess kitchen entrance. Area cordoned off by student volunteers.',
  category:'safety', urgency:'critical', location:'Hostel Block D, kitchen', department:'Hostel & Facilities', photo:null, reporter:'Rahul Sen'
}));

function timeAgo(d){
  const s = Math.floor((Date.now() - d.getTime())/1000);
  if(s < 60) return 'just now';
  const m = Math.floor(s/60); if(m < 60) return m + 'm ago';
  return Math.floor(m/60) + 'h ago';
}
function chipHtml(u){ return '<span class="chip u-'+u+'">'+u.charAt(0).toUpperCase()+u.slice(1)+'</span>'; }
function pillHtml(s){ return '<span class="pill s-'+s+'"><span class="dot"></span>'+STATUS_LABEL[s]+'</span>'; }
function roleChipHtml(role){ return '<span class="chip r-'+role+'">'+ROLE_LABEL[role]+'</span>'; }
function initials(name){ return name.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase(); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatTime(d){ return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

function animateCount(el, to){
  const dur = 650;
  const start = performance.now();
  function step(now){
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * to);
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- auth screen ----------
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active'); tabSignup.classList.remove('active');
  formLogin.classList.add('active'); formSignup.classList.remove('active');
});
tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active'); tabLogin.classList.remove('active');
  formSignup.classList.add('active'); formLogin.classList.remove('active');
});

document.getElementById('su-role').addEventListener('change', () => {
  syncDeptField();
  document.getElementById('signup-error').style.display = 'none';
});

document.getElementById('do-login').addEventListener('click', () => attemptLogin(
  document.getElementById('li-email').value.trim(), document.getElementById('li-password').value
));
document.querySelectorAll('.demo-chip').forEach(btn => {
  btn.addEventListener('click', () => attemptLogin(btn.getAttribute('data-demo'), 'demo123'));
});
function showAuthError(id, message){
  const el = document.getElementById(id);
  el.textContent = message;
  el.style.display = 'block';
}
function clearFieldErrors(scope){
  document.querySelectorAll('#' + scope + ' .field.has-error').forEach(f => f.classList.remove('has-error'));
}
function markField(inputId){
  const input = document.getElementById(inputId);
  if(input) input.closest('.field')?.classList.add('has-error');
}
const LOGIN_FIELD = {email:'li-email', password:'li-password'};
const SIGNUP_FIELD = {name:'su-name', email:'su-email', password:'su-password', role:'su-role', department:'su-department'};

function attemptLogin(email, password){
  clearFieldErrors('form-login');
  const result = RelayAuth.logIn(email, password);
  if(!result.ok){
    showAuthError('login-error', result.message);
    markField(LOGIN_FIELD[result.field]);
    return;
  }
  document.getElementById('login-error').style.display = 'none';
  users = RelayAuth.all();
  RelayAuth.rememberSession(result.user);
  signIn(result.user);
}

// Enter key submits whichever form is open
['li-email','li-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('do-login').click();
  });
});
['su-name','su-email','su-password'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('do-signup').click();
  });
});

// Password reveal toggles
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.getAttribute('data-pw'));
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  });
});

// Every role — Admin included — stays selectable. If a desk already has a
// holder we show it as a hint next to the option instead of disabling it,
// which is what previously made "Admin" impossible to pick.
function refreshRoleAvailability(){
  const roleSelect = document.getElementById('su-role');
  const dept = document.getElementById('su-department').value;
  const availability = RelayAuth.roleAvailability(dept);
  Array.from(roleSelect.options).forEach(opt => {
    const info = availability[opt.value];
    const base = ROLE_LABEL[opt.value] || opt.value;
    opt.disabled = false;
    opt.textContent = info && info.takenBy ? base + ' (also held by ' + info.takenBy + ')' : base;
  });
}
function syncDeptField(){
  const role = document.getElementById('su-role').value;
  document.getElementById('su-dept-field').style.display = (role === 'student' || role === 'hod') ? 'block' : 'none';
}
document.getElementById('su-department').addEventListener('change', refreshRoleAvailability);
syncDeptField();
refreshRoleAvailability();

document.getElementById('do-signup').addEventListener('click', () => {
  clearFieldErrors('form-signup');
  const result = RelayAuth.signUp({
    name: document.getElementById('su-name').value,
    email: document.getElementById('su-email').value,
    password: document.getElementById('su-password').value,
    role: document.getElementById('su-role').value,
    department: document.getElementById('su-department').value
  });
  if(!result.ok){
    showAuthError('signup-error', result.message);
    markField(SIGNUP_FIELD[result.field]);
    refreshRoleAvailability();
    return;
  }
  document.getElementById('signup-error').style.display = 'none';
  users = RelayAuth.all();
  refreshRoleAvailability();
  RelayAuth.rememberSession(result.user);
  signIn(result.user);
});

// Demo chips reflect which desks are still reachable
document.querySelectorAll('.demo-chip').forEach(chip => { chip.disabled = false; });

function signIn(user){
  currentUser = user;
  document.getElementById('auth-wrap').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  document.getElementById('who-name').textContent = user.name;
  document.getElementById('who-role').textContent = ROLE_LABEL[user.role] + (user.department ? ' · ' + user.department : '');
  document.getElementById('who-avatar').textContent = initials(user.name);

  document.getElementById('view-student').classList.toggle('active', user.role === 'student');
  document.getElementById('view-authority').classList.toggle('active', ['hod','vice_principal','principal'].includes(user.role));
  document.getElementById('view-admin').classList.toggle('active', user.role === 'admin');

  if(user.role === 'student'){
    if(user.department) document.getElementById('f-department').value = user.department;
    updatePreviewStrip();
    renderStudentList();
  } else if(user.role === 'admin'){
    renderAdminStats(); renderAdminList(); renderAdminUsers();
  } else {
    renderOpsBoard();
  }
}

document.getElementById('do-logout').addEventListener('click', () => {
  currentUser = null;
  RelayAuth.clearSession();
  refreshRoleAvailability();
  tabLogin.click(); // always land back on the log-in tab
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('auth-wrap').style.display = 'flex';
  document.getElementById('li-email').value = ''; document.getElementById('li-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  clearFieldErrors('form-login');
});

// ---------- escalation preview strip ----------
const urgencySelect = document.getElementById('f-urgency');
const departmentSelect = document.getElementById('f-department');
function updatePreviewStrip(){
  const urgency = urgencySelect.value, department = departmentSelect.value;
  const targets = computeTargets(urgency, department);
  const t1 = document.getElementById('sn-t1'), t1label = document.getElementById('sn-t1-label');
  const sl2 = document.getElementById('sl-2'), t2 = document.getElementById('sn-t2'), t2label = document.getElementById('sn-t2-label');
  t1.classList.add('on');
  if(targets[0].role === 'principal' || targets[0].role === 'vice_principal'){ t1.classList.remove('blue'); } else { t1.classList.add('blue'); }
  t1label.textContent = targets[0].name.split(',')[1] ? targets[0].name.split(',')[1].trim() : targets[0].name;
  if(targets.length > 1){
    sl2.style.display = 'block'; t2.style.display = 'flex'; t2.classList.add('on','blue');
    t2label.textContent = targets[1].name.split(',')[1] ? targets[1].name.split(',')[1].trim() : targets[1].name;
  } else { sl2.style.display = 'none'; t2.style.display = 'none'; t2.classList.remove('on'); }
}
urgencySelect.addEventListener('change', updatePreviewStrip);
departmentSelect.addEventListener('change', updatePreviewStrip);

function runSignalAnimation(){
  document.querySelectorAll('.signal-line').forEach(line => {
    if(line.style.display !== 'none'){ line.classList.remove('run'); void line.offsetWidth; line.classList.add('run'); }
  });
}

// ---------- photo: gallery upload ----------
const photoInput = document.getElementById('f-photo');
const photoPreview = document.getElementById('photo-preview');
const photoHint = document.getElementById('photo-hint');
let pendingPhoto = null;
photoInput.addEventListener('change', () => {
  const file = photoInput.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingPhoto = e.target.result;
    photoPreview.src = pendingPhoto; photoPreview.style.display = 'block';
    photoHint.textContent = file.name;
  };
  reader.readAsDataURL(file);
});

// ---------- photo: built-in camera ----------
const cameraBox = document.getElementById('camera-box');
const cameraVideo = document.getElementById('camera-video');
const cameraError = document.getElementById('camera-error');
let cameraStream = null;

document.getElementById('open-camera').addEventListener('click', async () => {
  cameraError.style.display = 'none';
  cameraBox.style.display = 'block';
  try{
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    cameraVideo.srcObject = cameraStream;
  } catch(e){
    cameraError.style.display = 'block';
    cameraBox.querySelector('.camera-actions').style.display = 'none';
  }
});

function stopCamera(){
  if(cameraStream){ cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  cameraBox.style.display = 'none';
  cameraBox.querySelector('.camera-actions').style.display = 'flex';
}

document.getElementById('capture-photo').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = cameraVideo.videoWidth || 640;
  canvas.height = cameraVideo.videoHeight || 480;
  canvas.getContext('2d').drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  pendingPhoto = canvas.toDataURL('image/jpeg', 0.85);
  photoPreview.src = pendingPhoto; photoPreview.style.display = 'block';
  photoHint.textContent = 'Photo captured just now';
  stopCamera();
});
document.getElementById('cancel-camera').addEventListener('click', stopCamera);

// ---------- submit report ----------
document.getElementById('submit-report').addEventListener('click', () => {
  const titleEl = document.getElementById('f-title');
  const errTitle = document.getElementById('err-title');
  const title = titleEl.value.trim();
  if(!title){ errTitle.style.display = 'block'; titleEl.focus(); return; }
  errTitle.style.display = 'none';

  const data = {
    title,
    description: document.getElementById('f-desc').value.trim() || 'No additional details given.',
    category: document.getElementById('f-category').value,
    urgency: document.getElementById('f-urgency').value,
    location: document.getElementById('f-location').value.trim() || 'Not specified',
    department: document.getElementById('f-department').value,
    photo: pendingPhoto, reporter: currentUser.name
  };
  const ticket = makeTicket(data);
  tickets.unshift(ticket);
  runSignalAnimation();
  refreshAllViews();

  titleEl.value = ''; document.getElementById('f-desc').value = ''; document.getElementById('f-location').value = '';
  photoInput.value = ''; photoPreview.style.display = 'none'; photoHint.textContent = 'No photo added yet';
  pendingPhoto = null;

  showToast(ticket);
});
document.getElementById('f-title').addEventListener('input', () => { document.getElementById('err-title').style.display = 'none'; });

// ---------- student list ----------
function renderStudentList(){
  const el = document.getElementById('student-list');
  if(!currentUser) return;
  const mine = tickets.filter(t => t.reporter === currentUser.name);
  if(mine.length === 0){ el.innerHTML = '<div class="empty">Nothing filed yet. Your reports will show up here.</div>'; return; }
  el.innerHTML = mine.map((t,i) => `
    <div class="ticket enter" style="animation-delay:${i*45}ms">
      <div class="ticket-top">
        <div><div class="ticket-code mono">${t.ticket_code}</div><div class="ticket-title">${escapeHtml(t.title)}</div></div>
        <div class="ticket-chips">${chipHtml(t.urgency)}</div>
      </div>
      <div class="ticket-meta">${pillHtml(t.status)}<span>${t.location}</span><span>${timeAgo(t.created_at)}</span></div>
    </div>
  `).join('');
}

// ---------- authority ops board ----------
function currentAuthorityRole(){
  if(currentUser.role === 'hod') return 'hod:' + currentUser.department;
  return currentUser.role;
}
function ticketsForRole(roleId){
  return tickets.filter(t => t.escalation_targets.some(tg => tg.role === roleId))
    .sort((a,b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.created_at - a.created_at);
}

function renderOpsBoard(){
  if(!currentUser || !['hod','vice_principal','principal'].includes(currentUser.role)) return;
  const roleId = currentAuthorityRole();
  const list = ticketsForRole(roleId);
  const el = document.getElementById('ops-list');
  if(list.length === 0){
    el.innerHTML = '<div class="empty">No reports routed to this desk right now.</div>';
  } else {
    el.innerHTML = list.map((t,i) => `
      <div class="ticket enter ${t.id === selectedTicketId ? 'selected' : ''}" data-id="${t.id}" style="animation-delay:${i*45}ms">
        <div class="ticket-top">
          <div><div class="ticket-code mono">${t.ticket_code}</div><div class="ticket-title">${escapeHtml(t.title)}</div></div>
          <div class="ticket-chips">${chipHtml(t.urgency)}</div>
        </div>
        <div class="ticket-meta">${pillHtml(t.status)}<span>${t.department}</span><span>${t.location}</span><span>${timeAgo(t.created_at)}</span></div>
      </div>
    `).join('');
    el.querySelectorAll('.ticket').forEach(node => {
      node.addEventListener('click', () => { selectedTicketId = node.getAttribute('data-id'); renderOpsBoard(); });
    });
  }
  if(selectedTicketId && !tickets.find(t => t.id === selectedTicketId)) selectedTicketId = null;
  renderDetail('', 'detail', selectedTicketId, () => renderOpsBoard());
}

// ---------- generic detail renderer (used by authority + admin panels) ----------
function renderDetail(unused, prefix, ticketId, onAdvance){
  const empty = document.getElementById(prefix + '-empty'), body = document.getElementById(prefix + '-body');
  const ticket = tickets.find(t => t.id === ticketId);
  if(!ticket){ empty.style.display = 'block'; body.style.display = 'none'; return; }
  empty.style.display = 'none'; body.style.display = 'block'; body.classList.remove('enter'); void body.offsetWidth; body.classList.add('enter');

  const photo = document.getElementById(prefix + '-photo');
  if(ticket.photo){ photo.src = ticket.photo; photo.style.display = 'block'; } else { photo.style.display = 'none'; }

  document.getElementById(prefix + '-code').textContent = ticket.ticket_code + ' · ' + timeAgo(ticket.created_at) + ' · filed by ' + ticket.reporter;
  document.getElementById(prefix + '-title').textContent = ticket.title;
  document.getElementById(prefix + '-chips').innerHTML = chipHtml(ticket.urgency) + ' ' + pillHtml(ticket.status);
  document.getElementById(prefix + '-desc').textContent = ticket.description + '  ·  ' + ticket.location + (prefix === 'admin-detail' ? '  ·  ' + ticket.department : '');
  document.getElementById(prefix + '-route').innerHTML = ticket.escalation_targets.map(tg => `<li><span class="rdot"></span>${tg.name}</li>`).join('');
  document.getElementById(prefix + '-timeline').innerHTML = ticket.timeline.map(ev => `
    <li><div>${STATUS_LABEL[ev.status]}</div>${ev.note ? `<div class="tl-note">${escapeHtml(ev.note)}</div>` : ''}<div class="tl-time">${formatTime(ev.at)}</div></li>
  `).reverse().join('');

  const actions = document.getElementById(prefix + '-actions');
  if(ticket.status === 'resolved'){ actions.innerHTML = ''; }
  else {
    const nextLabel = STATUS_ACTION[ticket.status];
    const btnClass = ticket.status === 'in_progress' ? 'btn-emerald' : 'btn-blue';
    actions.innerHTML = `<button class="${btnClass}" id="${prefix}-advance-btn">${nextLabel}</button>`;
    document.getElementById(prefix + '-advance-btn').addEventListener('click', () => { advanceStatus(ticket, prefix); });
  }
}

function advanceStatus(ticket, prefix){
  const idx = STATUS_ORDER.indexOf(ticket.status);
  const next = STATUS_ORDER[idx + 1];
  if(!next) return;
  ticket.status = next;
  ticket.timeline.push({status: next, note: 'Updated by ' + currentUser.name, at: new Date()});
  refreshAllViews();
  const chips = document.getElementById(prefix + '-chips');
  if(chips){ chips.classList.remove('pop'); void chips.offsetWidth; chips.classList.add('pop'); }
}

// ---------- admin portal ----------
document.getElementById('admin-search').addEventListener('input', () => { renderAdminList(); });
document.getElementById('admin-filter-status').addEventListener('change', () => { renderAdminList(); });
document.getElementById('admin-filter-urgency').addEventListener('change', () => { renderAdminList(); });
document.getElementById('admin-filter-department').addEventListener('change', () => { renderAdminList(); });

function renderAdminStats(){
  const total = tickets.length;
  const open = tickets.filter(t => t.status !== 'resolved').length;
  const resolved = tickets.filter(t => t.status === 'resolved').length;
  const critical = tickets.filter(t => t.urgency === 'critical' && t.status !== 'resolved').length;
  const stats = [
    {label:'Total reports', value: total, accent:''},
    {label:'Open', value: open, accent:'accent-orange'},
    {label:'Resolved', value: resolved, accent:'accent-emerald'},
    {label:'Critical open', value: critical, accent:'accent-blue'}
  ];
  const el = document.getElementById('admin-stats');
  el.innerHTML = stats.map((s,i) => `
    <div class="stat-card ${s.accent} enter" style="animation-delay:${i*60}ms">
      <div class="stat-label">${s.label}</div>
      <div class="stat-value" id="stat-val-${i}">0</div>
    </div>
  `).join('');
  stats.forEach((s,i) => animateCount(document.getElementById('stat-val-'+i), s.value));
}

function adminFilteredTickets(){
  const q = document.getElementById('admin-search').value.trim().toLowerCase();
  const status = document.getElementById('admin-filter-status').value;
  const urgency = document.getElementById('admin-filter-urgency').value;
  const department = document.getElementById('admin-filter-department').value;
  return tickets.filter(t => {
    if(q && !(t.title.toLowerCase().includes(q) || t.ticket_code.toLowerCase().includes(q))) return false;
    if(status && t.status !== status) return false;
    if(urgency && t.urgency !== urgency) return false;
    if(department && t.department !== department) return false;
    return true;
  }).sort((a,b) => urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.created_at - a.created_at);
}

function renderAdminList(){
  if(!currentUser || currentUser.role !== 'admin') return;
  const list = adminFilteredTickets();
  document.getElementById('admin-count-sub').textContent = list.length + ' of ' + tickets.length + ' reports shown, most urgent first.';
  const el = document.getElementById('admin-list');
  if(list.length === 0){
    el.innerHTML = '<div class="empty">No reports match these filters.</div>';
  } else {
    el.innerHTML = list.map((t,i) => `
      <div class="ticket enter ${t.id === adminSelectedTicketId ? 'selected' : ''}" data-id="${t.id}" style="animation-delay:${i*35}ms">
        <div class="ticket-top">
          <div><div class="ticket-code mono">${t.ticket_code}</div><div class="ticket-title">${escapeHtml(t.title)}</div></div>
          <div class="ticket-chips">${chipHtml(t.urgency)}</div>
        </div>
        <div class="ticket-meta">${pillHtml(t.status)}<span>${t.department}</span><span>${t.reporter}</span><span>${timeAgo(t.created_at)}</span></div>
      </div>
    `).join('');
    el.querySelectorAll('.ticket').forEach(node => {
      node.addEventListener('click', () => { adminSelectedTicketId = node.getAttribute('data-id'); renderAdminList(); });
    });
  }
  if(adminSelectedTicketId && !tickets.find(t => t.id === adminSelectedTicketId)) adminSelectedTicketId = null;
  renderDetail('', 'admin-detail', adminSelectedTicketId, () => renderAdminList());
}

function renderAdminUsers(){
  if(!currentUser || currentUser.role !== 'admin') return;
  const el = document.getElementById('admin-users');
  users = RelayAuth.all();
  el.innerHTML = users.map((u,i) => `
    <div class="user-row enter" style="animation-delay:${i*40}ms">
      <div class="user-who">
        <div class="user-mini-avatar">${initials(u.name)}</div>
        <div>
          <div class="user-name">${escapeHtml(u.name)}</div>
          <div class="user-email">${escapeHtml(u.email)}${u.department ? ' · ' + u.department : ''}</div>
        </div>
      </div>
      ${roleChipHtml(u.role)}
    </div>
  `).join('');
}

// ---------- keep every visible view in sync after any ticket change ----------
function refreshAllViews(){
  if(!currentUser) return;
  if(currentUser.role === 'student') renderStudentList();
  else if(currentUser.role === 'admin'){ renderAdminStats(); renderAdminList(); }
  else renderOpsBoard();
}

// ---------- toast ----------
function showToast(ticket){
  const toast = document.getElementById('toast');
  document.getElementById('toast-title').textContent = 'Sent — ' + ticket.ticket_code;
  document.getElementById('toast-sub').textContent = 'Routed to ' + ticket.escalation_targets.map(t => t.name.split(',')[0]).join(' and ') + '.';
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}


// ---------- restore an existing session on reload ----------
(function restore(){
  const user = RelayAuth.restoreSession();
  if(user) signIn(user);
})();
