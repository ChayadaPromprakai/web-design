/* Sport Hub – front-end logic. No database: data lives in the browser (localStorage / sessionStorage). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage (falls back to memory if the browser blocks it) ---------- */
  function mem() { var d = {}; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; } }; }
  function pick(name) { try { var s = window[name]; s.setItem('_t', '1'); s.removeItem('_t'); return s; } catch (e) { return mem(); } }
  var L = pick('localStorage'), S = pick('sessionStorage');
  function read(st, k, d) { try { var v = JSON.parse(st.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(st, k, v) { st.setItem(k, JSON.stringify(v)); }

  /* ---------- sample data ---------- */
  var COURTS = [
    { id: 1, name: 'Green Field Arena', sport: 'Soccer', area: 'KKU Sport Complex', km: 1.2, price: 600 },
    { id: 2, name: 'Smash Badminton Hall', sport: 'Badminton', area: 'Mittraphap Rd', km: 2.0, price: 180 },
    { id: 3, name: 'City Hoops', sport: 'Basketball', area: 'Downtown', km: 2.4, price: 300 },
    { id: 4, name: 'Ace Tennis Club', sport: 'Tennis', area: 'Nong Khai Rd', km: 3.1, price: 350 },
    { id: 5, name: 'Aqua Center Pool', sport: 'Swimming', area: 'Aqua Center', km: 4.0, price: 80 },
    { id: 6, name: 'Night Futsal', sport: 'Futsal', area: 'Sri Chan Rd', km: 1.8, price: 400 }
  ];
  function courtById(id) { return COURTS.filter(function (c) { return c.id === id; })[0]; }

  /* ---------- helpers ---------- */
  function param(k) { return new URLSearchParams(location.search).get(k); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmt(v) { var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function days() {
    var a = [], t = new Date();
    for (var i = 0; i < 7; i++) { var d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i); a.push({ v: iso(d), l: fmt(iso(d)) }); }
    return a;
  }
  function range(h, dur) { return pad(h) + ':00–' + pad(h + dur) + ':00'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nextUrl() { var n = param('next'); return /^[\w-]+\.html$/.test(n || '') ? n : 'index.html'; }

  /* ---------- accounts ---------- */
  function users() { return read(L, 'sh_users', []); }
  function sessionEmail() { return read(S, 'sh_session', null) || read(L, 'sh_session', null); }
  function currentUser() { var e = sessionEmail(); return users().filter(function (u) { return u.email === e; })[0] || null; }
  function signIn(u, remember) { S.removeItem('sh_session'); L.removeItem('sh_session'); write(remember ? L : S, 'sh_session', u.email); }
  function signOut() { S.removeItem('sh_session'); L.removeItem('sh_session'); }

  /* ---------- bookings ---------- */
  function bookings() { return read(L, 'sh_bookings', []); }
  function busy(courtId, date, h) { return (h * 7 + courtId * 3 + (+date.slice(-2))) % 5 === 0; } // pretend other customers
  function taken(courtId, date, h) {
    return bookings().some(function (b) { return b.status === 'confirmed' && b.courtId === courtId && b.date === date && h >= b.hour && h < b.hour + b.dur; });
  }
  function free(courtId, date, h, dur) {
    if (h + dur > 22) return false;
    var now = new Date();
    if (date === iso(now) && h <= now.getHours()) return false;
    for (var k = 0; k < dur; k++) if (busy(courtId, date, h + k) || taken(courtId, date, h + k)) return false;
    return true;
  }

  /* ---------- shared: nav state ---------- */
  function nav() {
    var u = currentUser();
    $$('.auth-link').forEach(function (a) {
      if (!u) return;
      a.textContent = 'Log out (' + u.first + ')';
      a.href = 'index.html';
      a.addEventListener('click', function (e) { e.preventDefault(); signOut(); location.href = 'index.html'; });
    });
    $$('a.avatar').forEach(function (a) { if (u) a.href = 'profile.html'; });
  }

  var pages = {};

  /* ---------- Log in ---------- */
  pages.login = function () {
    var f = $('#f'), err = $('#err');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = $('#id').value.trim().toLowerCase(), digits = id.replace(/\D/g, ''), pw = $('#pw').value;
      var u = users().filter(function (x) {
        return (x.email.toLowerCase() === id || (digits && x.phone.replace(/\D/g, '') === digits)) && x.password === pw;
      })[0];
      if (!u) { err.textContent = 'Incorrect email/phone or password. No account yet? Sign up first.'; return; }
      signIn(u, f.elements.remember.checked);
      location.href = nextUrl();
    });
  };

  /* ---------- Sign up ---------- */
  pages.signup = function () {
    var f = $('#f'), err = $('#err'), p1 = $('#p1'), p2 = $('#p2');
    function chk() { p2.setCustomValidity(p1.value === p2.value ? '' : 'Passwords do not match'); }
    p1.addEventListener('input', chk); p2.addEventListener('input', chk);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#em').value.trim();
      if (users().some(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })) { err.textContent = 'This email is already registered. Try logging in.'; return; }
      var u = {
        first: $('#fn').value.trim(), last: $('#ln').value.trim(), email: email, phone: $('#ph').value.trim(), password: p1.value,
        sports: $$('input[name=sports]:checked').map(function (c) { return c.value; })
      };
      var all = users(); all.push(u); write(L, 'sh_users', all);
      signIn(u, true);
      location.href = nextUrl();
    });
  };

  /* ---------- Court list ---------- */
  pages.courts = function () {
    var grid = $('#grid'), cards = $$('.card[data-sport]', grid), q = $('#q'), sort = $('#sort'), chips = $$('.chip[data-sport]'), count = $('#count'), empty = $('#empty');
    var sport = (param('sport') || 'all').toLowerCase();
    function apply() {
      var t = q.value.trim().toLowerCase(), by = sort.value;
      var vis = cards.filter(function (c) {
        var ok = (sport === 'all' || c.dataset.sport.toLowerCase() === sport) && (c.dataset.name + ' ' + c.dataset.area).toLowerCase().indexOf(t) > -1;
        c.hidden = !ok; return ok;
      });
      vis.sort(function (a, b) { return by === 'price' ? a.dataset.price - b.dataset.price : a.dataset.km - b.dataset.km; }).forEach(function (c) { grid.appendChild(c); });
      chips.forEach(function (ch) { var on = ch.dataset.sport.toLowerCase() === sport; ch.classList.toggle('on', on); ch.setAttribute('aria-pressed', on); });
      count.textContent = vis.length + (vis.length === 1 ? ' court' : ' courts') + ' near Khon Kaen';
      empty.hidden = vis.length > 0;
    }
    chips.forEach(function (ch) { ch.addEventListener('click', function () { sport = ch.dataset.sport.toLowerCase(); apply(); }); });
    q.addEventListener('input', apply); sort.addEventListener('change', apply);
    apply();
  };

  /* ---------- Court details ---------- */
  pages.court = function () {
    var c = courtById(+param('id')) || COURTS[0];
    document.title = c.name + ' – Sport Hub';
    $('#cname').textContent = c.name;
    $('#csub').textContent = c.sport + ' · ' + c.area + ' · ' + c.km + ' km';
    $('#crate').textContent = c.price + ' THB / hr';
    var dateSel = $('#date'), durSel = $('#dur'), slots = $('#slots'), go = $('#go'), sel = null;
    days().forEach(function (d) { var o = el('option', '', d.l); o.value = d.v; dateSel.appendChild(o); });
    function summary() {
      var dur = +durSel.value;
      $('#sdate').textContent = fmt(dateSel.value);
      $('#stime').textContent = sel === null ? '—' : range(sel, dur);
      $('#stotal').textContent = sel === null ? '—' : (c.price * dur) + ' THB';
      go.disabled = sel === null;
    }
    function render() {
      var dur = +durSel.value, date = dateSel.value;
      if (sel !== null && !free(c.id, date, sel, dur)) sel = null;
      slots.innerHTML = '';
      for (var h = 8; h < 22; h++) {
        var i = el('input'); i.type = 'radio'; i.name = 'time'; i.id = 't' + h; i.value = h;
        i.disabled = !free(c.id, date, h, dur); i.checked = sel === h;
        var l = el('label', '', pad(h) + ':00'); l.htmlFor = i.id;
        slots.appendChild(i); slots.appendChild(l);
      }
      summary();
    }
    slots.addEventListener('change', function (e) { sel = +e.target.value; summary(); });
    dateSel.addEventListener('change', render); durSel.addEventListener('change', render);
    go.addEventListener('click', function () {
      if (sel === null) return;
      write(S, 'sh_draft', { courtId: c.id, date: dateSel.value, hour: sel, dur: +durSel.value });
      location.href = 'booking.html';
    });
    render();
  };

  /* ---------- Booking / payment ---------- */
  pages.booking = function () {
    var d = read(S, 'sh_draft', null);
    if (!d) { $('#empty').hidden = false; return; }
    var c = courtById(d.courtId), u = currentUser();
    if (!u) { $('#needlogin').hidden = false; $('#loginlink').href = 'login.html?next=booking.html'; return; }
    $('#main').hidden = false;
    $('#scourt').textContent = c.name;
    $('#sdate').textContent = fmt(d.date);
    $('#stime').textContent = range(d.hour, d.dur);
    var total = c.price * d.dur;
    $('#stotal').textContent = total + ' THB';
    $('#pay').textContent = 'Pay ' + total + ' THB';
    $('#name').value = u.first + ' ' + u.last; $('#phone').value = u.phone;
    $('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      for (var k = 0; k < d.dur; k++) if (taken(d.courtId, d.date, d.hour + k)) { $('#err').textContent = 'Sorry, this slot was just booked. Please choose another time.'; return; }
      var b = {
        ref: 'SH' + (100000 + Math.floor(Math.random() * 900000)), email: u.email, courtId: d.courtId, date: d.date, hour: d.hour, dur: d.dur,
        name: $('#name').value.trim(), phone: $('#phone').value.trim(), method: $('#method').value, total: total, status: 'confirmed', created: Date.now()
      };
      var all = bookings(); all.push(b); write(L, 'sh_bookings', all);
      S.removeItem('sh_draft');
      location.href = 'bookings.html?new=' + b.ref;
    });
  };

  /* ---------- My bookings ---------- */
  pages.bookings = function () {
    var list = $('#list'), sub = $('#sub'), u = currentUser();
    if (!u) {
      var n = el('p', 'notice', 'Please log in to see your bookings. ');
      var a = el('a', '', 'Log in'); a.href = 'login.html?next=bookings.html'; n.appendChild(a);
      list.appendChild(n); sub.textContent = 'Log in required'; return;
    }
    var fresh = param('new');
    function render() {
      list.innerHTML = '';
      var mine = bookings().filter(function (b) { return b.email === u.email; }).sort(function (a, b) { return b.created - a.created; });
      var act = mine.filter(function (b) { return b.status === 'confirmed'; }).length;
      sub.textContent = act + ' confirmed';
      if (fresh && mine.some(function (b) { return b.ref === fresh; })) list.appendChild(el('p', 'notice', 'Booking ' + fresh + ' confirmed. See you on the court!'));
      if (!mine.length) { var n = el('p', '', 'No bookings yet. '); var a = el('a', '', 'Book a court'); a.href = 'courts.html'; n.appendChild(a); list.appendChild(n); return; }
      var g = el('div', 'grid');
      mine.forEach(function (b) {
        var c = courtById(b.courtId), card = el('article', 'card' + (b.status === 'cancelled' ? ' dim' : '')), body = el('div', 'cb');
        body.appendChild(el('span', b.status === 'confirmed' ? 'ok' : 'bad', (b.status === 'confirmed' ? 'Confirmed' : 'Cancelled') + ' · ' + b.ref));
        body.appendChild(el('h3', '', c.name));
        body.appendChild(el('small', '', fmt(b.date) + ' · ' + range(b.hour, b.dur)));
        body.appendChild(el('small', '', b.total + ' THB · ' + b.method));
        if (b.status === 'confirmed') {
          var btn = el('button', 'btn o', 'Cancel booking'); btn.type = 'button';
          btn.addEventListener('click', function () {
            if (!confirm('Cancel booking ' + b.ref + '?')) return;
            var all = bookings(); all.forEach(function (x) { if (x.ref === b.ref) x.status = 'cancelled'; }); write(L, 'sh_bookings', all); fresh = null; render();
          });
          body.appendChild(btn);
        }
        card.appendChild(body); g.appendChild(card);
      });
      list.appendChild(g);
    }
    render();
  };

  nav();
  var p = document.body.dataset.page;
  if (p && pages[p]) pages[p]();
})();
