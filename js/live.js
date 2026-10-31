/* Formulation Trendline — live data for the GitHub Pages build.
   Signs the viewer in with Google Identity Services (token model, read-only
   Sheets scope) and reads the live feed sheet with the Sheets API.
   No data is stored in the site; the access token lives in memory only. */
(function () {
  'use strict';
  const C = window.TRENDLINE_CONFIG || {};
  const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
  const NEEDS_SETUP = !C.googleClientId || /884648616332-06tvbjg646qrccsv15un3i2jttvdufd5.apps.googleusercontent.com/.test(C.googleClientId);
  let token = null, expiresAt = 0, client = null, timer = null, busy = false;

  /* ---------- theme (remembered per browser) ---------- */
  const root = document.documentElement;
  try { const t = localStorage.getItem('ft-theme'); if (t) root.dataset.theme = t; } catch (e) {}
  $('#theme').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ft-theme', root.dataset.theme); } catch (e) {}
    if (!$('#main').hidden) { drawPotency(); }
  };

  /* ---------- gate (signed-out / setup / error card) ---------- */
  function gate(title, html, buttonText) {
    $('#main').hidden = true;
    $('#gate').hidden = false;
    $('#gatetitle').textContent = title;
    $('#gatetext').innerHTML = html;
    const b = $('#signin');
    b.hidden = !buttonText; if (buttonText) b.textContent = buttonText;
    $('#signout').hidden = !token;
  }
  function showMain() {
    $('#gate').hidden = true;
    $('#main').hidden = false;
    $('#signout').hidden = false;
  }

  /* ---------- Google sign-in ---------- */
  function initClient() {
    if (client || !(window.google && google.accounts && google.accounts.oauth2)) return !!client;
    const opts = { client_id: C.googleClientId, scope: SCOPE, callback: onToken,
      error_callback: onTokenError };
    if (C.hostedDomain) opts.hosted_domain = C.hostedDomain;
    client = google.accounts.oauth2.initTokenClient(opts);
    return true;
  }
  function signIn(prompt) {
    if (!initClient()) {
      gate('Google sign-in is still loading', 'Wait a moment and try again. If this persists, a browser extension may be blocking accounts.google.com.', 'Try again');
      return;
    }
    client.requestAccessToken({ prompt: prompt || '' });
  }
  function onToken(resp) {
    if (resp.error) { onTokenError(resp); return; }
    if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
      gate('Read access was not granted', 'The page needs read-only access to Google Sheets to load the feed. Sign in again and allow it.', 'Sign in with Google');
      return;
    }
    token = resp.access_token;
    expiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
    load();
    if (timer) clearInterval(timer);
    if (C.refreshMinutes > 0) timer = setInterval(() => { if (!document.hidden) load(true); }, C.refreshMinutes * 60000);
  }
  function onTokenError(err) {
    const t = err && (err.type || err.error);
    if (t === 'popup_closed' || t === 'access_denied') {
      gate('Sign-in was cancelled', 'Sign in with an account that can open the live feed sheet.', 'Sign in with Google');
    } else if (t === 'popup_failed_to_open') {
      gate('The sign-in window was blocked', 'Allow pop-ups for this site, then sign in again.', 'Sign in with Google');
    } else {
      gate('Sign-in failed', 'Google reported: ' + escapeHtml(String(t || 'unknown error')) + '.', 'Sign in with Google');
    }
  }
  function signOut() {
    if (token && window.google) google.accounts.oauth2.revoke(token, () => {});
    token = null; expiresAt = 0; if (timer) clearInterval(timer);
    $('#liveerr').innerHTML = '';
    setLive('off', 'Signed out');
    gate('Signed out', 'Sign in again to load the trend.', 'Sign in with Google');
  }

  /* ---------- read the feed ---------- */
  async function load(quiet) {
    if (busy) return;
    if (!token || Date.now() > expiresAt) {
      if (quiet) { setLive('err', 'Session expired — press Refresh'); return; }
      signIn(''); return;
    }
    busy = true;
    if (!quiet) setLive('off', 'Reading the live feed…');
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(C.feedSheetId) +
      '/values/' + encodeURIComponent(C.range || 'A:BI') + '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE';
    try {
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { token = null; busy = false; if (quiet) setLive('err', 'Session expired — press Refresh'); else signIn(''); return; }
      if (!r.ok) {
        let msg = ''; try { msg = (await r.json()).error.message; } catch (e) {}
        fail(r.status, msg); return;
      }
      const j = await r.json();
      const vals = Array.isArray(j.values) ? j.values : [];
      if (/#REF!/.test(vals.slice(0, 3).flat().join(' '))) { showMain(); needsAllow(); return; }
      const rows = mapRows(vals);
      if (!rows.length) {
        gate('The feed was read but no lots were found',
          'The first tab of the feed sheet needs a header row with Lot, Date Compounded, API Label (mg/mL) and API Result (mg/mL). Check that IMPORTRANGE is filling it.', 'Try again');
        return;
      }
      showMain();
      $('#liveerr').innerHTML = '';
      loadRows(rows, true);
      READAT = Date.now();
      const stamp = new Date(READAT).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      setLive('on', 'Live · ' + rows.length + ' lots to ' + DAYS[DAYS.length - 1] + ' · read ' + stamp);
      fidChips(true); ingChips(); viewChips(); presetChips(); drawPotency(); note();
    } catch (e) {
      if (!$('#main').hidden) { setLive('err', 'Could not reach Google Sheets — showing the last read'); }
      else gate('Could not reach Google Sheets', 'Check your connection and try again.', 'Try again');
    } finally { busy = false; }
  }
  function fail(status, msg) {
    const keep = !$('#main').hidden;
    let title, body;
    if (status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) {
      title = 'The Google Sheets API is not enabled';
      body = 'Enable the Google Sheets API in the Google Cloud project that owns this site’s Client ID (README, step 2).';
    } else if (status === 403) {
      title = 'Your account cannot open the live feed sheet';
      body = 'Ask the sheet owner to share <em>Formulation Trendline — live feed</em> with you (Viewer is enough), then press Try again.';
    } else if (status === 404) {
      title = 'The live feed sheet was not found';
      body = 'Check <code>feedSheetId</code> in <code>js/config.js</code>.';
    } else if (status === 429) {
      title = 'Google is rate-limiting requests'; body = 'Wait a minute and try again.';
    } else {
      title = 'Google Sheets answered ' + status; body = escapeHtml(msg || 'Unexpected response.');
    }
    setLive('err', title);
    if (keep) { showErr(title, body + ' Showing the last successful read.', false); }
    else gate(title, body, 'Try again');
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---------- wiring ---------- */
  $('#signin').onclick = () => (token && Date.now() < expiresAt) ? load() : signIn(token ? '' : 'select_account');
  $('#signout').onclick = signOut;
  $('#refresh').onclick = () => load();
  setLive('off', 'Not signed in');
  if (NEEDS_SETUP) {
    gate('One setup step left',
      'Add your Google OAuth Client ID to <code>js/config.js</code> (README, step 2). Until then the page cannot sign anyone in.', '');
  }
})();
