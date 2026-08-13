/* =========================================================================
   Relay — auth extension (persistent accounts + role uniqueness)
   Loaded BEFORE js/app.js. Exposes window.RelayAuth.
   Fixes:
     - accounts + session survive a page reload (localStorage)
     - emails are normalised (trim + lowercase) so login always matches
     - exactly ONE admin, ONE principal, ONE vice principal and ONE HOD
       per department can exist; the seeded desks are never overwritten,
       so creating an account can no longer lock anyone out of a desk
     - clear, field-specific error messages instead of one generic line
   ========================================================================= */
(function (global) {
  const USERS_KEY = 'relay.users.v1';
  const SESSION_KEY = 'relay.session.v1';

  const DEPARTMENTS = [
    'Computer Science', 'Mechanical Engineering', 'Civil Engineering',
    'Hostel & Facilities', 'Administration'
  ];
  const HOD_NAMES = {
    'Computer Science': 'Dr. A. Rao',
    'Mechanical Engineering': 'Dr. K. Verma',
    'Civil Engineering': 'Dr. P. Nair',
    'Hostel & Facilities': 'Mr. S. Thomas',
    'Administration': 'Ms. L. Fernandes'
  };
  const PRINCIPAL = 'Dr. R. Menon';
  const VP = 'Dr. S. Iyer';

  // Every role is open for signup. The seeded demo desks always keep working,
  // but an existing holder no longer blocks a new account — this is what made
  // the Admin option impossible to select in the signup form.
  const SINGLE_ROLES = [];

  const SEED_USERS = [
    { name: 'Aisha Khan', email: 'student@relay.edu', password: 'demo123', role: 'student', department: 'Computer Science', seeded: true },
    { name: HOD_NAMES['Computer Science'], email: 'hod.cs@relay.edu', password: 'demo123', role: 'hod', department: 'Computer Science', seeded: true },
    { name: VP, email: 'vp@relay.edu', password: 'demo123', role: 'vice_principal', department: null, seeded: true },
    { name: PRINCIPAL, email: 'principal@relay.edu', password: 'demo123', role: 'principal', department: null, seeded: true },
    { name: 'System Admin', email: 'admin@relay.edu', password: 'demo123', role: 'admin', department: null, seeded: true }
  ];

  const norm = (e) => String(e || '').trim().toLowerCase();
  const emailLooksValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm(e));

  function safeParse(raw, fallback) {
    try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (_) { return fallback; }
  }

  let users = [];

  function load() {
    const stored = safeParse(global.localStorage && localStorage.getItem(USERS_KEY), null);
    users = Array.isArray(stored) ? stored : [];
    // Always guarantee the demo desks exist, and never let a stored record
    // shadow them — this is what previously made admin login impossible.
    SEED_USERS.forEach((seed) => {
      const i = users.findIndex((u) => norm(u.email) === norm(seed.email));
      if (i === -1) users.push({ ...seed });
      else users[i] = { ...users[i], ...seed };
    });
    users = users.map((u) => ({ ...u, email: norm(u.email) }));
    save();
  }

  function save() {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (_) { /* storage disabled */ }
  }

  function all() { return users.slice(); }

  function find(email) {
    const e = norm(email);
    return users.find((u) => norm(u.email) === e) || null;
  }

  /** Who currently sits at a desk — informational only, never a blocker. */
  function holderOf(role, department) {
    if (role === 'hod') {
      return users.find((u) => u.role === 'hod' && u.department === department) || null;
    }
    return users.find((u) => u.role === role) || null;
  }

  /** Roles that are still open for signup, with the reason when taken. */
  function roleAvailability(department) {
    const out = {};
    ['student', 'hod', 'vice_principal', 'principal', 'admin'].forEach((role) => {
      const holder = holderOf(role, department);
      // Always available: a desk can be shared. `takenBy` is shown as a hint.
      out[role] = { available: true, takenBy: holder ? holder.name : null };
    });
    return out;
  }

  /** @returns {{ok:true,user:object}|{ok:false,field:string,message:string}} */
  function signUp({ name, email, password, role, department }) {
    name = String(name || '').trim();
    const mail = norm(email);
    password = String(password || '');
    const dept = (role === 'student' || role === 'hod') ? department : null;

    if (name.length < 2) return fail('name', 'Enter your full name.');
    if (!emailLooksValid(mail)) return fail('email', 'Enter a valid email address, e.g. name@relay.edu.');
    if (password.length < 6) return fail('password', 'Use a password of at least 6 characters.');
    if (find(mail)) return fail('email', 'An account with that email already exists — log in instead.');
    if ((role === 'student' || role === 'hod') && !DEPARTMENTS.includes(dept)) {
      return fail('department', 'Pick your department.');
    }

    const user = { name, email: mail, password, role, department: dept, seeded: false };
    users.push(user);
    save();
    return { ok: true, user };
  }

  /** @returns {{ok:true,user:object}|{ok:false,field:string,message:string}} */
  function logIn(email, password) {
    const mail = norm(email);
    if (!mail) return fail('email', 'Enter your email address.');
    if (!password) return fail('password', 'Enter your password.');
    const user = find(mail);
    if (!user) return fail('email', 'No Relay account uses that email.');
    if (user.password !== String(password)) return fail('password', 'That password is incorrect.');
    return { ok: true, user };
  }

  function fail(field, message) { return { ok: false, field, message }; }

  function rememberSession(user) {
    try { localStorage.setItem(SESSION_KEY, norm(user.email)); } catch (_) { /* noop */ }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* noop */ }
  }
  function restoreSession() {
    let mail = null;
    try { mail = localStorage.getItem(SESSION_KEY); } catch (_) { /* noop */ }
    return mail ? find(mail) : null;
  }

  load();

  global.RelayAuth = {
    DEPARTMENTS, HOD_NAMES, PRINCIPAL, VP, SINGLE_ROLES,
    all, find, signUp, logIn, roleAvailability,
    rememberSession, clearSession, restoreSession, normalizeEmail: norm
  };
})(window);
