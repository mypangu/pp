/**
 * Cookie Vault SDK
 * Drop-in script for any HTML/JS site.
 *
 * Usage — paste ONE line before </body>:
 *
 *   <script src="cookie-vault-sdk.js" data-vault="https://your-worker.workers.dev"></script>
 *
 * Or with a fixed site name (skips the name prompt):
 *   <script src="cookie-vault-sdk.js"
 *           data-vault="https://your-worker.workers.dev"
 *           data-site="my-site-name"></script>
 */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */
  var script     = document.currentScript ||
                   document.querySelector('script[data-vault]');
  var VAULT_URL  = (script && script.getAttribute('data-vault')) || '';
  var SITE_NAME  = (script && script.getAttribute('data-site'))  ||
                   location.hostname.replace(/^www\./, '');

  if (!VAULT_URL) {
    console.warn('[CookieVault] Missing data-vault attribute on <script> tag.');
    return;
  }

  /* ── Persistent state ────────────────────────────────────────────── */
  var LS_TOKEN = 'cv_tok';
  var LS_USER  = 'cv_usr';
  var token    = localStorage.getItem(LS_TOKEN) || '';
  var user     = localStorage.getItem(LS_USER)  || '';

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function api(path, method, body) {
    var opts = {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Session': token }
    };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);
    return fetch(VAULT_URL + '/api' + path, opts)
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { error: 'Network error: ' + e.message }; });
  }

  function collectData() {
    var cookies = [];
    if (document.cookie) {
      document.cookie.split(';').forEach(function (c) {
        var idx = c.indexOf('=');
        if (idx < 1) return;
        cookies.push({ name: c.slice(0, idx).trim(), value: c.slice(idx + 1).trim() });
      });
    }
    var ls = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k !== LS_TOKEN && k !== LS_USER) ls[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return { cookies: cookies, ls: ls };
  }

  /* ── Inject styles ────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '#cv-fab{',
      'position:fixed;bottom:20px;right:20px;z-index:2147483647;',
      'width:52px;height:52px;border-radius:50%;',
      'background:linear-gradient(135deg,#1a1a2e,#16213e);',
      'border:2px solid rgba(99,179,237,0.4);',
      'box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 0 0 rgba(99,179,237,0.3);',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'font-size:22px;transition:all 0.2s;user-select:none;-webkit-tap-highlight-color:transparent;',
    '}',
    '#cv-fab:hover,#cv-fab:active{',
      'transform:scale(1.1);',
      'box-shadow:0 6px 28px rgba(0,0,0,0.6),0 0 0 8px rgba(99,179,237,0.15);',
    '}',
    '#cv-fab.cv-open{',
      'background:linear-gradient(135deg,#2d3748,#1a202c);',
      'border-color:rgba(99,179,237,0.7);',
    '}',

    /* Backdrop */
    '#cv-backdrop{',
      'position:fixed;inset:0;z-index:2147483646;',
      'background:rgba(0,0,0,0);',
      'pointer-events:none;transition:background 0.3s;',
    '}',
    '#cv-backdrop.cv-open{background:rgba(0,0,0,0.55);pointer-events:all;}',

    /* Panel */
    '#cv-panel{',
      'position:fixed;bottom:84px;right:16px;z-index:2147483647;',
      'width:min(340px,calc(100vw - 32px));',
      'background:#0f1117;',
      'border:1px solid rgba(99,179,237,0.2);',
      'border-radius:16px;',
      'box-shadow:0 24px 64px rgba(0,0,0,0.8),0 0 0 1px rgba(255,255,255,0.03);',
      'overflow:hidden;',
      'transform:translateY(20px) scale(0.95);opacity:0;',
      'pointer-events:none;',
      'transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),opacity 0.2s;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    '}',
    '#cv-panel.cv-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}',

    /* Panel header */
    '#cv-head{',
      'display:flex;align-items:center;justify-content:space-between;',
      'padding:14px 16px 12px;',
      'border-bottom:1px solid rgba(255,255,255,0.06);',
    '}',
    '#cv-head-left{display:flex;align-items:center;gap:10px;}',
    '#cv-logo{',
      'width:30px;height:30px;border-radius:8px;',
      'background:linear-gradient(135deg,#3b82f6,#06d6a0);',
      'display:flex;align-items:center;justify-content:center;font-size:15px;',
    '}',
    '#cv-title{',
      'font-size:13px;font-weight:700;color:#e2e8f0;letter-spacing:-0.3px;',
    '}',
    '#cv-site-label{',
      'font-size:10px;color:#4a5568;font-family:monospace;margin-top:1px;',
      'max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    '}',
    '#cv-close{',
      'width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);',
      'border:none;color:#718096;font-size:16px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:all 0.15s;',
    '}',
    '#cv-close:hover{background:rgba(255,255,255,0.1);color:#e2e8f0;}',

    /* Body */
    '#cv-body{padding:16px;}',

    /* Auth screen */
    '.cv-auth-tabs{display:flex;gap:4px;background:rgba(255,255,255,0.04);',
      'border-radius:8px;padding:3px;margin-bottom:14px;}',
    '.cv-auth-tab{flex:1;padding:7px;border:none;background:transparent;',
      'color:#718096;font-size:11px;font-weight:700;cursor:pointer;border-radius:6px;',
      'transition:all 0.15s;letter-spacing:0.5px;text-transform:uppercase;}',
    '.cv-auth-tab.cv-active{background:#1e2d3d;color:#63b3ed;}',

    '.cv-label{display:block;font-size:10px;color:#4a5568;text-transform:uppercase;',
      'letter-spacing:1px;margin-bottom:5px;font-weight:600;}',
    '.cv-input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);',
      'border-radius:8px;padding:9px 12px;color:#e2e8f0;font-size:13px;outline:none;',
      'margin-bottom:10px;box-sizing:border-box;transition:border-color 0.15s;',
      '-webkit-appearance:none;}',
    '.cv-input:focus{border-color:rgba(99,179,237,0.5);}',
    '.cv-input::placeholder{color:#2d3748;}',

    /* Buttons */
    '.cv-btn{width:100%;padding:11px;border:none;border-radius:9px;',
      'font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;',
      'letter-spacing:0.3px;display:flex;align-items:center;justify-content:center;gap:7px;',
      '-webkit-tap-highlight-color:transparent;}',
    '.cv-btn:active{transform:scale(0.97);}',
    '.cv-btn-primary{background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;}',
    '.cv-btn-primary:hover{background:linear-gradient(135deg,#2563eb,#1d4ed8);}',
    '.cv-btn-export{background:rgba(59,130,246,0.12);color:#63b3ed;',
      'border:1px solid rgba(59,130,246,0.25);margin-bottom:10px;}',
    '.cv-btn-export:hover{background:rgba(59,130,246,0.2);}',
    '.cv-btn-import{background:rgba(16,185,129,0.1);color:#34d399;',
      'border:1px solid rgba(16,185,129,0.25);margin-bottom:10px;}',
    '.cv-btn-import:hover{background:rgba(16,185,129,0.18);}',
    '.cv-btn-logout{background:transparent;color:#4a5568;border:1px solid rgba(255,255,255,0.07);',
      'font-size:11px;padding:8px;}',
    '.cv-btn-logout:hover{color:#718096;border-color:rgba(255,255,255,0.15);}',
    '.cv-btn:disabled{opacity:0.4;cursor:not-allowed;}',

    /* Status / toast inside panel */
    '#cv-status{',
      'margin-top:10px;padding:10px 12px;border-radius:8px;',
      'font-size:12px;line-height:1.5;display:none;',
    '}',
    '#cv-status.cv-ok{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.2);}',
    '#cv-status.cv-err{background:rgba(239,68,68,0.1);color:#fc8181;border:1px solid rgba(239,68,68,0.2);}',
    '#cv-status.cv-info{background:rgba(99,179,237,0.08);color:#63b3ed;border:1px solid rgba(99,179,237,0.2);}',

    /* User bar */
    '#cv-user-bar{',
      'display:flex;align-items:center;gap:8px;',
      'background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);',
      'border-radius:8px;padding:8px 12px;margin-bottom:14px;',
    '}',
    '#cv-user-dot{width:7px;height:7px;border-radius:50%;background:#34d399;flex-shrink:0;}',
    '#cv-user-name{font-size:12px;color:#34d399;font-weight:600;flex:1;',
      'font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

    /* Divider */
    '.cv-divider{height:1px;background:rgba(255,255,255,0.06);margin:12px 0;}',

    /* Site name row */
    '#cv-sitename-row{margin-bottom:12px;}',
  ].join('');
  document.head.appendChild(style);

  /* ── Build DOM ────────────────────────────────────────────────────── */
  var backdrop = document.createElement('div');
  backdrop.id  = 'cv-backdrop';
  document.body.appendChild(backdrop);

  var panel = document.createElement('div');
  panel.id  = 'cv-panel';
  panel.innerHTML = [
    '<div id="cv-head">',
      '<div id="cv-head-left">',
        '<div id="cv-logo">🍪</div>',
        '<div>',
          '<div id="cv-title">Cookie Vault</div>',
          '<div id="cv-site-label">' + SITE_NAME + '</div>',
        '</div>',
      '</div>',
      '<button id="cv-close" aria-label="Close">✕</button>',
    '</div>',
    '<div id="cv-body">',
      /* AUTH VIEW */
      '<div id="cv-view-auth">',
        '<div class="cv-auth-tabs">',
          '<button class="cv-auth-tab cv-active" id="cv-tab-login">Login</button>',
          '<button class="cv-auth-tab" id="cv-tab-reg">Register</button>',
        '</div>',
        '<div id="cv-auth-login">',
          '<label class="cv-label">Username</label>',
          '<input class="cv-input" id="cv-login-u" type="text" placeholder="your_username" autocomplete="username"/>',
          '<label class="cv-label">Password</label>',
          '<input class="cv-input" id="cv-login-p" type="password" placeholder="password" autocomplete="current-password"/>',
          '<button class="cv-btn cv-btn-primary" id="cv-login-btn">Login</button>',
        '</div>',
        '<div id="cv-auth-reg" style="display:none">',
          '<label class="cv-label">Username</label>',
          '<input class="cv-input" id="cv-reg-u" type="text" placeholder="choose_username" autocomplete="username"/>',
          '<label class="cv-label">Password</label>',
          '<input class="cv-input" id="cv-reg-p" type="password" placeholder="min 6 characters" autocomplete="new-password"/>',
          '<button class="cv-btn cv-btn-primary" id="cv-reg-btn">Create Account</button>',
        '</div>',
        '<div id="cv-status"></div>',
      '</div>',
      /* MAIN VIEW */
      '<div id="cv-view-main" style="display:none">',
        '<div id="cv-user-bar">',
          '<div id="cv-user-dot"></div>',
          '<div id="cv-user-name"></div>',
        '</div>',
        '<div id="cv-sitename-row">',
          '<label class="cv-label">Site name to save as</label>',
          '<input class="cv-input" id="cv-sitename-input" type="text"/>',
        '</div>',
        '<button class="cv-btn cv-btn-export" id="cv-export-btn">',
          '↑ Export this site\'s data',
        '</button>',
        '<button class="cv-btn cv-btn-import" id="cv-import-btn">',
          '↓ Import saved backup',
        '</button>',
        '<div class="cv-divider"></div>',
        '<button class="cv-btn cv-btn-logout" id="cv-logout-btn">Sign out</button>',
        '<div id="cv-status"></div>',
      '</div>',
    '</div>',
  ].join('');
  document.body.appendChild(panel);

  var fab = document.createElement('div');
  fab.id          = 'cv-fab';
  fab.textContent = '🍪';
  fab.setAttribute('role', 'button');
  fab.setAttribute('aria-label', 'Cookie Vault');
  document.body.appendChild(fab);

  /* ── Refs ─────────────────────────────────────────────────────────── */
  function ge(id) { return document.getElementById(id); }
  var statusEl; // set per-view

  /* ── Status helper ───────────────────────────────────────────────── */
  function showStatus(msg, type) {
    /* There are two #cv-status divs (one per view); grab the visible one */
    var els = document.querySelectorAll('#cv-status');
    els.forEach(function (el) {
      el.textContent = msg;
      el.className   = type || 'cv-info';
      el.style.display = 'block';
    });
  }
  function clearStatus() {
    document.querySelectorAll('#cv-status').forEach(function (el) {
      el.style.display = 'none'; el.textContent = '';
    });
  }

  /* ── Panel open/close ─────────────────────────────────────────────── */
  var isOpen = false;
  function openPanel() {
    isOpen = true;
    fab.classList.add('cv-open');
    panel.classList.add('cv-open');
    backdrop.classList.add('cv-open');
    clearStatus();
    if (token) verifyAndShowMain();
    else showAuth();
  }
  function closePanel() {
    isOpen = false;
    fab.classList.remove('cv-open');
    panel.classList.remove('cv-open');
    backdrop.classList.remove('cv-open');
  }
  fab.addEventListener('click', function () { isOpen ? closePanel() : openPanel(); });
  backdrop.addEventListener('click', closePanel);
  ge('cv-close').addEventListener('click', closePanel);

  /* ── Views ────────────────────────────────────────────────────────── */
  function showAuth() {
    ge('cv-view-auth').style.display = 'block';
    ge('cv-view-main').style.display = 'none';
  }
  function showMain() {
    ge('cv-view-auth').style.display = 'none';
    ge('cv-view-main').style.display = 'block';
    ge('cv-user-name').textContent   = user;
    ge('cv-sitename-input').value    = SITE_NAME;
  }

  function verifyAndShowMain() {
    api('/me', 'GET').then(function (res) {
      if (res.username) {
        user = res.username;
        localStorage.setItem(LS_USER, user);
        showMain();
      } else {
        token = ''; user = '';
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        showAuth();
      }
    });
  }

  /* ── Auth tab switching ───────────────────────────────────────────── */
  ge('cv-tab-login').addEventListener('click', function () {
    ge('cv-tab-login').classList.add('cv-active');
    ge('cv-tab-reg').classList.remove('cv-active');
    ge('cv-auth-login').style.display = 'block';
    ge('cv-auth-reg').style.display   = 'none';
    clearStatus();
  });
  ge('cv-tab-reg').addEventListener('click', function () {
    ge('cv-tab-reg').classList.add('cv-active');
    ge('cv-tab-login').classList.remove('cv-active');
    ge('cv-auth-reg').style.display   = 'block';
    ge('cv-auth-login').style.display = 'none';
    clearStatus();
  });

  /* ── Login ────────────────────────────────────────────────────────── */
  function doLogin() {
    var u = ge('cv-login-u').value.trim();
    var p = ge('cv-login-p').value;
    if (!u || !p) { showStatus('Fill in all fields', 'cv-err'); return; }
    var btn = ge('cv-login-btn');
    btn.disabled = true; btn.textContent = 'Logging in...';
    api('/login', 'POST', { username: u, password: p }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Login';
      if (res.token) {
        token = res.token; user = res.username;
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_USER, user);
        showMain();
        showStatus('Welcome back, ' + user + '!', 'cv-ok');
      } else {
        showStatus(res.error || 'Login failed', 'cv-err');
      }
    });
  }
  ge('cv-login-btn').addEventListener('click', doLogin);
  ge('cv-login-p').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  /* ── Register ─────────────────────────────────────────────────────── */
  function doRegister() {
    var u = ge('cv-reg-u').value.trim();
    var p = ge('cv-reg-p').value;
    if (!u) { showStatus('Username is required', 'cv-err'); return; }
    if (p.length < 6) { showStatus('Password min 6 characters', 'cv-err'); return; }
    var btn = ge('cv-reg-btn');
    btn.disabled = true; btn.textContent = 'Creating...';
    api('/register', 'POST', { username: u, password: p }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Create Account';
      if (res.token) {
        token = res.token; user = res.username;
        localStorage.setItem(LS_TOKEN, token);
        localStorage.setItem(LS_USER, user);
        showMain();
        showStatus('Account created! Welcome, ' + user, 'cv-ok');
      } else {
        showStatus(res.error || 'Registration failed', 'cv-err');
      }
    });
  }
  ge('cv-reg-btn').addEventListener('click', doRegister);
  ge('cv-reg-p').addEventListener('keydown', function (e) { if (e.key === 'Enter') doRegister(); });

  /* ── Logout ───────────────────────────────────────────────────────── */
  ge('cv-logout-btn').addEventListener('click', function () {
    api('/logout', 'POST', {}).then(function () {
      token = ''; user = '';
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_USER);
      ge('cv-login-u').value = '';
      ge('cv-login-p').value = '';
      showAuth();
    });
  });

  /* ── Export ───────────────────────────────────────────────────────── */
  ge('cv-export-btn').addEventListener('click', function () {
    var siteName = ge('cv-sitename-input').value.trim() || SITE_NAME;
    var btn = ge('cv-export-btn');
    btn.disabled = true; btn.textContent = 'Exporting...';
    clearStatus();

    var data = collectData();
    api('/ingest', 'POST', {
      siteName:     siteName,
      cookies:      data.cookies,
      localStorage: data.ls,
      exportedAt:   new Date().toISOString(),
      url:          location.hostname
    }).then(function (res) {
      btn.disabled = false; btn.textContent = '↑ Export this site\'s data';
      if (res.ok) {
        showStatus(
          'Saved! ' + res.cookies + ' cookies + ' + res.localStorage + ' localStorage keys backed up.',
          'cv-ok'
        );
      } else {
        showStatus(res.error || 'Export failed', 'cv-err');
      }
    });
  });

  /* ── Import ───────────────────────────────────────────────────────── */
  ge('cv-import-btn').addEventListener('click', function () {
    var siteName = ge('cv-sitename-input').value.trim() || SITE_NAME;
    var btn = ge('cv-import-btn');
    btn.disabled = true; btn.textContent = 'Fetching backup...';
    clearStatus();

    api('/backup/' + encodeURIComponent(siteName), 'GET').then(function (res) {
      if (res.error) {
        btn.disabled = false; btn.textContent = '↓ Import saved backup';
        showStatus(
          res.error === 'Not found'
            ? 'No backup found for "' + siteName + '". Export it first!'
            : res.error,
          'cv-err'
        );
        return;
      }

      /* Restore cookies */
      var cookies = res.cookies || [];
      cookies.forEach(function (ck) {
        var s = encodeURIComponent(ck.name) + '=' + encodeURIComponent(ck.value || '');
        if (ck.path)     s += '; path='    + ck.path;
        if (ck.domain)   s += '; domain='  + String(ck.domain).replace(/^\./, '');
        if (ck.expires)  s += '; expires=' + new Date(ck.expires * 1000).toUTCString();
        if (ck.secure)   s += '; secure';
        if (ck.sameSite) s += '; samesite=' + ck.sameSite;
        try { document.cookie = s; } catch (e) {}
      });

      /* Restore localStorage (skip vault's own keys) */
      var ls = res.localStorage || {};
      Object.keys(ls).forEach(function (k) {
        if (k === LS_TOKEN || k === LS_USER) return;
        try { localStorage.setItem(k, ls[k]); } catch (e) {}
      });

      var cCount  = cookies.length;
      var lsCount = Object.keys(ls).length;

      btn.disabled = false; btn.textContent = '↓ Import saved backup';
      showStatus(
        'Restored ' + cCount + ' cookies + ' + lsCount + ' localStorage keys. Reloading in 2s...',
        'cv-ok'
      );
      setTimeout(function () { location.reload(); }, 2000);
    });
  });

  /* ── Auto-restore on load (silent) ────────────────────────────────── */
  /* If user is logged in and a backup exists for this site, do nothing  */
  /* automatically — user must tap Import intentionally.                 */

})();