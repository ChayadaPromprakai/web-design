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
    menus();
  }

  /* ---------- shared: hamburger + dropdown toggles ---------- */
  function menus() {
    var b = $('#menubtn'), m = $('#menu');
    if (b && m) b.addEventListener('click', function () {
      var o = m.classList.toggle('open');
      b.setAttribute('aria-expanded', o); b.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
    });
    $$('.nav .tg').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        var d = t.parentNode, o = !d.classList.contains('open');
        Array.prototype.slice.call(d.parentNode.children).forEach(function (x) {
          if (x !== d && x.classList.contains('dd')) { x.classList.remove('open'); $$('.dd.open', x).forEach(function (y) { y.classList.remove('open'); }); }
        });
        d.classList.toggle('open', o); t.setAttribute('aria-expanded', o);
      });
    });
    function closeAll() { $$('.nav .links .dd.open').forEach(function (d) { d.classList.remove('open'); var t = $('.tg', d); if (t) t.setAttribute('aria-expanded', 'false'); }); }
    document.addEventListener('click', function (e) { if (!e.target.closest('.nav .links')) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); if (document.activeElement && document.activeElement.blur && document.activeElement.closest('.links')) document.activeElement.blur(); } });
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
      if (count) count.textContent = vis.length + (vis.length === 1 ? ' court' : ' courts') + ' near Khon Kaen';
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
    $('#crate').textContent = c.price + ' THB';
    $('#cbc').textContent = c.name; $('#csport').textContent = c.sport;
    $('#cmain').style.backgroundImage = 'url(' + photo(c) + ')';
    $('#csub').textContent = c.area + ', Khon Kaen · ' + c.km.toFixed(1) + ' km';
    var dateSel = $('#date'), durSel = $('#dur'), slots = $('#slots'), go = $('#go'), sel = null;
    days().forEach(function (d) { var o = el('option', '', d.l); o.value = d.v; dateSel.appendChild(o); });
    function summary() {
      var dur = +durSel.value;
      $('#slab').textContent = 'Total (' + dur + (dur > 1 ? ' hrs)' : ' hr)');
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
      location.href = 'booking-confirmation.html?ref=' + b.ref;
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

  /* ---------- shared helpers for the pages below ---------- */
  function page() { return location.pathname.split('/').pop() || 'index.html'; }
  function needUser() { var u = currentUser(); if (!u) location.href = 'login.html?next=' + page(); return u; }
  function joined() { return read(L, 'sh_joined', []); }
  function short(u) { return u.first + ' ' + u.last.charAt(0) + '.'; }

  /* Join / Invite buttons (clubs, event, players): toggle per account */
  function toggles() {
    var pg = document.body.dataset.page;
    $$('main a.btn[href="#"]').forEach(function (b) {
      var base = b.textContent.trim(), on = base === 'Invite' ? 'Invited ✓' : 'Joined ✓';
      var host = b.closest('.card, .pn') || document, h = $('h3', host) || $('h1');
      function key() { var u = currentUser(); return u ? pg + ':' + u.email + ':' + h.textContent.trim() : null; }
      function paint() { var k = key(), j = !!k && joined().indexOf(k) > -1; b.textContent = j ? on : base; b.setAttribute('aria-pressed', j); }
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var k = key(); if (!k) { needUser(); return; }
        var a = joined(), i = a.indexOf(k); if (i > -1) a.splice(i, 1); else a.push(k);
        write(L, 'sh_joined', a); paint();
      });
      paint();
    });
  }
  pages.clubs = pages.event = toggles;

  /* ---------- shared: court photos + button filters ---------- */
  var SPORT_IMG = { Soccer: 'footballfield', Badminton: 'badmintoncourt', Basketball: 'basketballcourt', Tennis: 'tenniscourt', Swimming: 'swimmingpool', Futsal: 'futsalcourt' };
  function photo(c) { return 'image/' + SPORT_IMG[c.sport] + '.jpg'; }
  // ปุ่ม [data-g][data-v] กรองรายการที่มี data-<g> (หลายค่าคั่นด้วยช่องว่างได้)
  function filters(items, extra, done) {
    var sel = {};
    $$('[data-g]').forEach(function (b) {
      var g = b.dataset.g; if (b.getAttribute('aria-pressed') === 'true') sel[g] = b.dataset.v;
      b.addEventListener('click', function () {
        sel[g] = b.dataset.v;
        $$('[data-g="' + g + '"]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        run();
      });
    });
    function run() {
      var n = 0;
      items().forEach(function (it) {
        var ok = Object.keys(sel).every(function (g) { return sel[g] === 'all' || (' ' + (it.dataset[g] || '') + ' ').indexOf(' ' + sel[g] + ' ') > -1; }) && (!extra || extra(it));
        it.hidden = !ok; if (ok) n++;
      });
      var e = $('#empty'); if (e) e.hidden = n > 0;
      if (done) done(n);
    }
    run(); return run;
  }

  /* ---------- Find Players ---------- */
  pages.players = function () {
    toggles();
    filters(function () { return $$('#list .mc'); }, null, function (n) { $('#cnt').textContent = n + ' open match' + (n === 1 ? '' : 'es') + ' near you'; });
  };

  /* ---------- Map ---------- */
  pages.map = function () {
    var POS = { 1: [34, 38], 2: [62, 24], 3: [48, 66], 4: [80, 60], 5: [22, 74], 6: [56, 44] };
    var zone = $('#mapz'), list = $('#clist'), pop = $('#pop'), pins = {}, rows = {};
    function select(c) {
      Object.keys(pins).forEach(function (k) { pins[k].classList.toggle('on', +k === c.id); rows[k].classList.toggle('on', +k === c.id); });
      pop.innerHTML = ''; pop.hidden = false;
      var ph = el('div', 'ph'); ph.style.backgroundImage = 'url(' + photo(c) + ')';
      var b = el('div', 'cb'); b.appendChild(el('h3', '', c.name)); b.appendChild(el('small', '', c.area + ' · ' + c.km.toFixed(1) + ' km')); b.appendChild(el('b', 'pr', c.price + ' THB / hr'));
      var a = el('a', 'btn s', 'View'); a.href = 'court.html?id=' + c.id; b.appendChild(a);
      pop.appendChild(ph); pop.appendChild(b);
    }
    COURTS.forEach(function (c) {
      var li = el('li', 'crt'); li.dataset.sport = c.sport.toLowerCase(); li.dataset.name = (c.name + ' ' + c.area).toLowerCase();
      var th = el('span', 'th'); th.style.backgroundImage = 'url(' + photo(c) + ')';
      var d = el('div'); d.appendChild(el('small', '', c.sport)); d.appendChild(el('h3', '', c.name)); d.appendChild(el('small', '', c.area + ' · ' + c.km.toFixed(1) + ' km')); d.appendChild(el('b', 'pr', c.price + ' THB / hr'));
      var a = el('a', 'btn s', 'View'); a.href = 'court.html?id=' + c.id;
      li.appendChild(th); li.appendChild(d); li.appendChild(a); list.appendChild(li);
      li.addEventListener('mouseenter', function () { select(c); });
      var p = el('button', 'pin'); p.type = 'button'; p.setAttribute('aria-label', c.name); p.style.left = POS[c.id][0] + '%'; p.style.top = POS[c.id][1] + '%';
      p.addEventListener('click', function () { select(c); }); zone.appendChild(p);
      pins[c.id] = p; rows[c.id] = li; li.dataset.id = c.id;
    });
    var run = filters(function () { return $$('#clist .crt'); },
      function (it) { var q = $('#q').value.trim().toLowerCase(); return !q || it.dataset.name.indexOf(q) > -1; },
      function (n) { $('#cnt').textContent = n + ' court' + (n === 1 ? '' : 's') + ' in this area'; $$('#clist .crt').forEach(function (it) { pins[it.dataset.id].hidden = it.hidden; }); });
    $('#q').addEventListener('input', run);
    select(COURTS[0]);
  };

  /* ---------- Events ---------- */
  pages.events = function () {
    toggles();
    filters(function () { return $$('#list .ev'); });
    var t = $('#cal'), y = 2026, m = 9, first = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), now = new Date();
    var today = now.getFullYear() === y && now.getMonth() === m ? now.getDate() : 0, has = [4, 11, 18, 25], tr = el('tr');
    'MTWTFSS'.split('').forEach(function (d) { tr.appendChild(el('th', '', d)); }); t.appendChild(tr);
    tr = el('tr');
    for (var i = 0; i < first + n; i++) {
      if (i && i % 7 === 0) { t.appendChild(tr); tr = el('tr'); }
      var td = el('td'); if (i >= first) { var d = i - first + 1; td.appendChild(el('span', 'd' + (d === today ? ' now' : has.indexOf(d) > -1 ? ' has' : ''), d)); } tr.appendChild(td);
    }
    t.appendChild(tr);
  };

  /* ---------- Community ---------- */
  pages.community = function () {
    toggles();
    filters(function () { return $$('#list .post'); });
    $('#post').addEventListener('click', function () {
      var inp = $('#say'), txt = inp.value.trim(); if (!txt) { inp.focus(); return; }
      var u = currentUser(), who = u ? short(u) : 'Guest', a = el('article', 'card post'), h = el('header');
      h.appendChild(el('span', 'av', who.charAt(0))); var d = el('div'); d.appendChild(el('b', '', who)); d.appendChild(el('small', 'sm', 'Just now')); h.appendChild(d);
      a.appendChild(h); a.appendChild(el('p', '', txt)); var ac = el('div', 'acts'); ['Like 0', 'Comment 0', 'Share'].forEach(function (x) { ac.appendChild(el('span', '', x)); }); a.appendChild(ac);
      a.dataset.t = ''; var l = $('#list'); l.insertBefore(a, l.firstChild); inp.value = '';
      $$('[data-g="t"]').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === 'all'); }); $$('#list .post').forEach(function (x) { x.hidden = false; }); $('#empty').hidden = true;
    });
  };

  /* ---------- Booking confirmation ---------- */
  pages['booking-confirmation'] = function () {
    var u = needUser(), msg = $('#msg'); if (!u) return;
    var ref = param('ref'), b = bookings().filter(function (x) { return x.ref === ref && x.email === u.email; })[0];
    if (!b) { msg.appendChild(el('p', 'notice', 'Booking not found. ')); var a = el('a', '', 'My Bookings'); a.href = 'bookings.html'; msg.appendChild(a); return; }
    $('#ref').textContent = b.ref; $('#c').textContent = courtById(b.courtId).name; $('#d').textContent = fmt(b.date);
    $('#t').textContent = range(b.hour, b.dur); $('#n').textContent = b.name; $('#m').textContent = b.method; $('#p').textContent = b.total + ' THB';
    $('#ok').hidden = false;
  };

  /* ---------- Availability (weekly view, live) ---------- */
  pages.availability = function () {
    var ths = $$('.tbl tr:first-child th').slice(1), wd = [1, 2, 3, 4, 5], dates = [];
    var t = new Date();
    wd.forEach(function (w, c) {
      var d; for (var i = 0; i < 7; i++) { d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i); if (d.getDay() === w) break; }
      dates.push(iso(d)); ths[c].textContent = ths[c].textContent.trim() + ' ' + d.getDate();
    });
    $$('.tbl tr').forEach(function (tr, r) {
      if (!r) return;
      var h = parseInt($('th', tr).textContent, 10);
      $$('td', tr).forEach(function (td, c) {
        td.innerHTML = ''; td.className = '';
        if (!free(1, dates[c], h, 1)) { td.className = 'x'; td.textContent = 'Booked'; return; }
        var a = el('a', '', 'Free'); a.href = 'booking.html';
        a.addEventListener('click', function (e) { e.preventDefault(); write(S, 'sh_draft', { courtId: 1, date: dates[c], hour: h, dur: 1 }); location.href = 'booking.html'; });
        td.appendChild(a);
      });
    });
  };

  /* ---------- Search ---------- */
  var PLAYERS = [
    { name: 'Beam P.', sport: 'Soccer', level: 'Intermediate', km: 1.5 },
    { name: 'Nut S.', sport: 'Soccer', level: 'Advanced', km: 2.0 },
    { name: 'May K.', sport: 'Badminton', level: 'Beginner', km: 0.9 },
    { name: 'Tan W.', sport: 'Tennis', level: 'Intermediate', km: 3.2 }
  ];
  var EVENTS = [
    { mon: 'OCT', day: '11', title: 'KKU Cup Futsal Tournament', time: '09:00', place: 'City Hoops', tag: 'Tournament', sport: 'Soccer' },
    { mon: 'OCT', day: '18', title: 'Sunday Fun Run 5K', time: '06:00', place: 'Bueng Kaen Nakhon', tag: 'Running', sport: 'Running' },
    { mon: 'OCT', day: '25', title: 'Badminton Open Doubles', time: '13:00', place: 'Smash Hall', tag: 'Badminton', sport: 'Badminton' }
  ];
  var ALIAS = { Soccer: 'football futsal', Futsal: 'football soccer', Basketball: 'hoops', Swimming: 'pool swim', Running: 'run marathon' };
  var POPULAR = ['night football', 'badminton KKU', 'swimming pool', 'tennis lessons'];
  var TRY = ['badminton tonight', 'futsal', 'tennis court'];
  var PHOTO = { 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4', 5: 'g1', 6: 'g5' };
  var LIMIT = { courts: 4, players: 3, events: 2 };
  // words that never filter results (filler / location / time / generic nouns) – they only boost ranking
  var STOP = ['near', 'in', 'at', 'the', 'for', 'a', 'an', 'of', 'to', 'and', 'with', 'me', 'nearby'];
  var SOFT = ['kku', 'khon', 'kaen', 'tonight', 'today', 'tomorrow', 'weekend', 'now', 'court', 'courts', 'player', 'players', 'event', 'events', 'match', 'matches', 'lesson', 'lessons'];

  function terms(q) {
    var all = q.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(function (w) { return w && STOP.indexOf(w) < 0; });
    return {
      hard: all.filter(function (w) { return SOFT.indexOf(w) < 0; }),
      soft: all.filter(function (w) { return SOFT.indexOf(w) > -1; })
    };
  }
  function score(name, text, T) {
    var n = name.toLowerCase(), t = text.toLowerCase(), sc = 0;
    for (var i = 0; i < T.hard.length; i++) {
      if (t.indexOf(T.hard[i]) < 0) return -1;
      sc += n.indexOf(T.hard[i]) > -1 ? 3 : 1;
    }
    T.soft.forEach(function (w) { if (t.indexOf(w) > -1) sc += 1; });
    return sc;
  }
  function rank(list, textOf, nameOf, T, tie) {
    return list.map(function (x) { return { x: x, s: score(nameOf(x), textOf(x), T) }; })
      .filter(function (r) { return r.s >= 0; })
      .sort(function (a, b) { return b.s - a.s || tie(a.x, b.x); })
      .map(function (r) { return r.x; });
  }
  function searchAll(q) {
    var T = terms(q);
    return {
      courts: rank(COURTS, function (c) { return [c.name, c.sport, ALIAS[c.sport] || '', c.area, 'court'].join(' '); }, function (c) { return c.name; }, T, function (a, b) { return a.km - b.km; }),
      players: rank(PLAYERS, function (p) { return [p.name, p.sport, ALIAS[p.sport] || '', p.level, 'player khon kaen'].join(' '); }, function (p) { return p.name; }, T, function (a, b) { return a.km - b.km; }),
      events: rank(EVENTS, function (e) { return [e.title, e.tag, e.sport, ALIAS[e.sport] || '', e.place, 'event'].join(' '); }, function (e) { return e.title; }, T, function () { return 0; })
    };
  }
  /* ----- filters ----- */
  var SPORTS = ['Football', 'Badminton', 'Basketball', 'Tennis', 'Swimming', 'Running'];
  function grp(v) { v = (v || '').toLowerCase(); return (v === 'soccer' || v === 'futsal') ? 'football' : v; } // Soccer + Futsal = Football
  function fparams() {
    var sp = grp(param('sport') || 'all'); if (sp !== 'all' && SPORTS.map(grp).indexOf(sp) < 0) sp = 'all';
    var so = param('sort'); if (['best', 'near', 'price'].indexOf(so) < 0) so = 'best';
    var pr = +param('price') || 0; if ([150, 300, 500].indexOf(pr) < 0) pr = 0;
    var lv = (param('level') || 'all').toLowerCase(); if (['beginner', 'intermediate', 'advanced'].indexOf(lv) < 0) lv = 'all';
    return { sport: sp, sort: so, price: pr, level: lv };
  }
  function nFilters(f) { return (f.sport !== 'all' ? 1 : 0) + (f.price ? 1 : 0) + (f.level !== 'all' ? 1 : 0); }
  function qurl(q, tab, f) {
    var u = 'search.html?q=' + encodeURIComponent(q || '');
    if (tab && tab !== 'all') u += '&tab=' + tab;
    if (f) {
      if (f.sport !== 'all') u += '&sport=' + f.sport;
      if (f.sort !== 'best') u += '&sort=' + f.sort;
      if (f.price) u += '&price=' + f.price;
      if (f.level !== 'all') u += '&level=' + f.level;
    }
    return u;
  }
  function applyF(base, f) {
    var c = base.courts.filter(function (x) { return (f.sport === 'all' || grp(x.sport) === f.sport) && (!f.price || x.price <= f.price); });
    var p = base.players.filter(function (x) { return (f.sport === 'all' || grp(x.sport) === f.sport) && (f.level === 'all' || x.level.toLowerCase() === f.level); });
    var e = base.events.filter(function (x) { return f.sport === 'all' || grp(x.sport) === f.sport; });
    if (f.sort === 'near') {
      c = c.slice().sort(function (a, b) { return a.km - b.km; });
      p = p.slice().sort(function (a, b) { return a.km - b.km; });
    }
    if (f.sort === 'price') c = c.slice().sort(function (a, b) { return a.price - b.price || a.km - b.km; });
    return { courts: c, players: p, events: e };
  }

  pages.search = function () {
    var raw = (param('q') || '').trim(), inp = $('#q'), clr = $('#clr'), form = $('#sf');
    var tab = param('tab'); if (['all', 'courts', 'players', 'events'].indexOf(tab) < 0) tab = 'all';
    var F = fparams(), base = searchAll(raw), baseTotal = base.courts.length + base.players.length + base.events.length, res, total;
    inp.value = raw;
    document.title = (raw ? raw + ' – ' : '') + 'Search – Sport Hub';

    /* search box: clear button; keep the active filters when searching again */
    function toggleClr() { clr.hidden = !inp.value; }
    inp.addEventListener('input', toggleClr); toggleClr();
    clr.addEventListener('click', function () { inp.value = ''; toggleClr(); inp.focus(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); location.href = qurl(inp.value.trim(), 'all', F); });

    /* recent searches (kept in this browser only) */
    var recent = read(L, 'sh_recent', []).filter(function (x) { return x.toLowerCase() !== raw.toLowerCase(); });
    var box = $('#recent'), shown = recent.length ? recent.slice(0, 4) : TRY;
    box.appendChild(el('span', '', recent.length ? 'Recent:' : 'Try:'));
    shown.forEach(function (t) { var a = el('a', 'chip', t); a.href = qurl(t); box.appendChild(a); });
    if (recent.length) {
      var x = el('button', 'mini', 'Clear'); x.type = 'button';
      x.addEventListener('click', function () { L.removeItem('sh_recent'); box.hidden = true; });
      box.appendChild(x);
    }
    box.hidden = false;
    if (raw && baseTotal > 0) { recent.unshift(raw); write(L, 'sh_recent', recent.slice(0, 5)); }

    /* popular searches */
    POPULAR.forEach(function (t) { var a = el('a', 'chip', t); a.href = qurl(t); $('#l-pop').appendChild(a); });

    /* result cards (text only – the query never touches innerHTML) */
    function fill(id, items, make) { var l = $('#l-' + id); l.innerHTML = ''; items.forEach(function (it) { l.appendChild(make(it)); }); }
    function courtCard(c) {
      var a = el('article', 'res'), ph = el('div', 'ph ' + (PHOTO[c.id] || 'g1'), 'Photo'), info = el('div'), row = el('div', 'row'), v = el('a', 'btn', 'View');
      v.href = 'court.html?id=' + c.id; v.setAttribute('aria-label', 'View ' + c.name);
      info.appendChild(el('small', '', c.sport === 'Soccer' ? 'Football' : c.sport));
      info.appendChild(el('h3', '', c.name));
      info.appendChild(el('p', 'meta', c.area + ' · ' + c.km.toFixed(1) + ' km'));
      row.appendChild(el('p', 'price', c.price + ' THB / ' + (c.sport === 'Swimming' ? 'visit' : 'hr'))); row.appendChild(v); info.appendChild(row);
      a.appendChild(ph); a.appendChild(info); return a;
    }
    function playerCard(p) {
      var a = el('article', 'res pl'), info = el('div'), btn = el('button', 'btn ghost', 'Invite'); btn.type = 'button';
      info.appendChild(el('h3', '', p.name)); info.appendChild(el('p', 'meta', p.sport + ' · ' + p.level + ' · ' + p.km.toFixed(1) + ' km'));
      function key() { var u = currentUser(); return u ? 'players:' + u.email + ':' + p.name : null; } // same key as Find Players page
      function paint() { var k = key(), on = !!k && joined().indexOf(k) > -1; btn.textContent = on ? 'Invited ✓' : 'Invite'; btn.setAttribute('aria-pressed', on); }
      btn.addEventListener('click', function () {
        var k = key(); if (!k) { needUser(); return; }
        var j = joined(), i = j.indexOf(k); if (i > -1) j.splice(i, 1); else j.push(k);
        write(L, 'sh_joined', j); paint();
      });
      paint();
      a.appendChild(el('div', 'av')); a.appendChild(info); a.appendChild(btn); return a;
    }
    function eventCard(e) {
      var a = el('a', 'res ev'), d = el('div', 'dbadge'), info = el('div');
      a.href = 'event.html';
      d.appendChild(el('span', '', e.mon)); d.appendChild(el('b', '', e.day));
      info.appendChild(el('h3', '', e.title)); info.appendChild(el('p', 'meta', e.time + ' · ' + e.place)); info.appendChild(el('span', 'chip', e.tag));
      a.appendChild(d); a.appendChild(info); return a;
    }

    /* filter controls */
    var sb = $('#fsports'), fbar = $('#fbar'), tg = $('#ftoggle');
    [['all', 'All sports']].concat(SPORTS.map(function (n) { return [grp(n), n]; })).forEach(function (o) {
      var b = el('button', 'chip', o[1]); b.type = 'button'; b.dataset.sport = o[0];
      b.addEventListener('click', function () { F.sport = o[0]; update(); });
      sb.appendChild(b);
    });
    $('#f-sort').addEventListener('change', function () { F.sort = this.value; update(); });
    $('#f-price').addEventListener('change', function () { F.price = +this.value; update(); });
    $('#f-level').addEventListener('change', function () { F.level = this.value; update(); });
    function reset() { F.sport = 'all'; F.sort = 'best'; F.price = 0; F.level = 'all'; update(); }
    $('#f-reset').addEventListener('click', reset); $('#e-reset').addEventListener('click', reset);
    tg.addEventListener('click', function () { var o = fbar.classList.toggle('open'); tg.setAttribute('aria-expanded', o); });
    if (nFilters(F) || F.sort !== 'best') { fbar.classList.add('open'); tg.setAttribute('aria-expanded', 'true'); }

    function syncControls() {
      $$('#fsports .chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sport === F.sport); });
      $('#f-sort').value = F.sort; $('#f-price').value = String(F.price); $('#f-level').value = F.level;
      var nf = nFilters(F), bd = $('#fbadge'); bd.textContent = nf; bd.hidden = !nf;
      $('#f-reset').hidden = !(nf || F.sort !== 'best');
      $('#e-reset').hidden = !(nf || F.sort !== 'best');
    }
    function pushUrl() { try { history.replaceState(null, '', qurl(raw, tab, F)); } catch (e) { /* file:// may block it */ } }

    /* show the right sections for the active tab */
    function show() {
      var single = tab !== 'all';
      $('#layout').classList.toggle('single', single);
      $$('#stabs button').forEach(function (b) { var on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      var sec = { courts: [res.courts, courtCard], players: [res.players, playerCard], events: [res.events, eventCard] };
      Object.keys(sec).forEach(function (k) {
        var items = sec[k][0], on = tab === 'all' || tab === k, cut = tab === 'all' ? items.slice(0, LIMIT[k]) : items, s = $('#s-' + k);
        s.hidden = !on || (tab === 'all' && !items.length);
        $('#h-' + k).textContent = k.charAt(0).toUpperCase() + k.slice(1) + ' (' + items.length + ')';
        $('.seeall', s).hidden = tab !== 'all' || items.length <= LIMIT[k];
        fill(k, cut, sec[k][1]);
        if (on && !items.length && single && total > 0) $('#l-' + k).appendChild(el('p', 'none', 'No ' + k + ' match your search and filters.'));
      });
      var none = total === 0;
      $('#empty').hidden = !none;
      if (none) $('#etitle').textContent = baseTotal > 0 ? 'No results match these filters' : 'No results for “' + raw + '”';
      $('#s-pop').hidden = false;
    }

    /* recompute everything after a filter change */
    function update() {
      res = applyF(base, F);
      total = res.courts.length + res.players.length + res.events.length;
      var n = { all: total, courts: res.courts.length, players: res.players.length, events: res.events.length };
      $$('#stabs button').forEach(function (b) { b.textContent = b.textContent.replace(/ \(\d+\)$/, '') + ' (' + n[b.dataset.tab] + ')'; });
      var word = total === 1 ? ' result' : ' results', act = nFilters(F) > 0;
      $('#count').textContent = raw ? total + word + ' for “' + raw + '”' + (act ? ' (filtered)' : '') : (act ? total + word : 'Showing all ' + total + ' results');
      syncControls(); show(); pushUrl();
    }
    function setTab(t) { tab = t; show(); pushUrl(); }
    $$('#stabs button, .seeall').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
    update();
  };

  /* ---------- Create match ---------- */
  function matches() { return read(L, 'sh_matches', []); }
  pages['create-match'] = function () {
    var u = needUser(); if (!u) return;
    var sport = $('#sport'), court = $('#court'), date = $('#date');
    COURTS.map(function (c) { return c.sport; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).forEach(function (s) { sport.appendChild(el('option', '', s)); });
    function fill() { court.innerHTML = ''; COURTS.filter(function (c) { return c.sport === sport.value; }).forEach(function (c) { var o = el('option', '', c.name + ' · ' + c.price + ' THB/hr'); o.value = c.id; court.appendChild(o); }); }
    sport.addEventListener('change', fill); fill(); date.min = iso(new Date());
    $('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = { id: 'M' + Date.now(), sport: sport.value, courtId: +court.value, date: date.value, time: $('#time').value, level: $('#level').value, need: +$('#need').value, host: short(u), players: [short(u)] };
      var all = matches(); all.push(m); write(L, 'sh_matches', all);
      location.href = 'match.html?id=' + m.id;
    });
  };

  /* ---------- Match details ---------- */
  pages.match = function () {
    var demo = { id: 'demo', title: 'Thursday Futsal', sport: 'Soccer', when: 'Thu 2 Oct', where: 'Night Futsal · 19:00 · Intermediate', need: 10, host: 'Beam P.',
      players: ['Beam P.', 'Nut S.', 'May K.', 'Tan W.', 'Ploy C.', 'Ohm R.', 'Fah T.', 'Bank L.'] };
    var id = param('id') || 'demo', m = id === 'demo' ? demo : matches().filter(function (x) { return x.id === id; })[0];
    if (!m) { $('#mtitle').textContent = 'Match not found'; $('#mjoin').hidden = true; return; }
    if (m !== demo) { m.title = m.sport + ' match'; m.when = fmt(m.date) + ' · ' + m.time; m.where = courtById(m.courtId).name + ' · ' + m.level; }
    var btn = $('#mjoin');
    function names() {
      var out = m.players.slice();
      users().forEach(function (u) { if (joined().indexOf('match:' + u.email + ':' + m.id) > -1 && out.indexOf(short(u)) < 0) out.push(short(u)); });
      return out;
    }
    function paint() {
      var u = currentUser(), list = names(), me = u && joined().indexOf('match:' + u.email + ':' + m.id) > -1;
      $('#msub').textContent = m.sport + ' · ' + m.when; $('#mtitle').textContent = m.title; $('#mwhere').textContent = m.where;
      $('#mcount').textContent = 'Players: ' + list.length + ' / ' + m.need; $('#mhost').textContent = 'Host: ' + m.host;
      var box = $('#mplayers'); box.innerHTML = ''; list.forEach(function (n) { box.appendChild(el('p', '', n)); });
      btn.textContent = me ? 'Leave match' : (list.length >= m.need ? 'Match full' : 'Join match');
      btn.hidden = false; btn.setAttribute('aria-disabled', !me && list.length >= m.need);
    }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var u = needUser(); if (!u) return;
      var k = 'match:' + u.email + ':' + m.id, a = joined(), i = a.indexOf(k);
      if (i > -1) a.splice(i, 1); else { if (names().length >= m.need) return; a.push(k); }
      write(L, 'sh_joined', a); paint();
    });
    paint();
  };

  /* ---------- Reviews ---------- */
  pages.reviews = function () {
    var box = $('.two .panel'), rs = read(L, 'sh_reviews', []), sum = 4.6 * 38;
    rs.forEach(function (r) {
      var a = el('article'); a.appendChild(el('span', 'star', '★★★★★☆☆☆☆☆'.slice(5 - r.rating, 10 - r.rating)));
      a.appendChild(el('p', '', r.text + ' — ' + r.author)); box.insertBefore(a, box.firstChild); sum += r.rating;
    });
    var n = 38 + rs.length; $('aside h2').textContent = (sum / n).toFixed(1) + ' / 5'; $('aside small').textContent = n + ' reviews';
  };
  pages['write-review'] = function () {
    var u = needUser(); if (!u) return;
    $('#f').addEventListener('submit', function (e) {
      e.preventDefault();
      var rs = read(L, 'sh_reviews', []); rs.push({ rating: +$('#rate').value, text: $('#txt').value.trim(), author: short(u), date: iso(new Date()) });
      write(L, 'sh_reviews', rs); location.href = 'reviews.html';
    });
  };

  /* ---------- Profile ---------- */
  pages.profile = function () {
    var u = currentUser(), box = $('#pact');
    if (!u) { var a = el('a', '', 'Log in'); a.href = 'login.html?next=profile.html'; box.appendChild(a); return; }
    $('#pav').textContent = (u.first.charAt(0) + u.last.charAt(0)).toUpperCase();
    $('#pname').textContent = u.first + ' ' + u.last;
    $('#psub').textContent = 'Khon Kaen';
    $('#pav2').textContent = $('#pav').textContent;
    if (u.sports && u.sports.length) { var sp = $('#psports'); sp.innerHTML = ''; u.sports.forEach(function (x) { sp.appendChild(el('span', 'tag', x)); }); }
    var mine = bookings().filter(function (b) { return b.email === u.email && b.status === 'confirmed'; }).sort(function (a, b) { return b.created - a.created; }).slice(0, 3);
    if (!mine.length) box.appendChild(el('p', '', 'No activity yet.'));
    $('#pbk').textContent = bookings().filter(function (b) { return b.email === u.email && b.status === 'confirmed'; }).length;
    mine.forEach(function (b) { var c = courtById(b.courtId), d = el('div', 'card mc'); d.appendChild(el('small', '', 'Upcoming booking · ' + c.sport)); d.appendChild(el('h3', '', c.name)); d.appendChild(el('small', '', fmt(b.date) + ' · ' + range(b.hour, b.dur))); box.appendChild(d); });
  };

  /* ---------- Settings ---------- */
  pages.settings = function () {
    var u = needUser(); if (!u) return;
    var f = $('#f'), p = u.prefs || { remind: true, invites: true, news: false };
    $('#fn').value = u.first; $('#ln').value = u.last; $('#em').value = u.email; $('#ph').value = u.phone || '';
    ['remind', 'invites', 'news'].forEach(function (k) { f.elements[k].checked = !!p[k]; });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#em').value.trim(), all = users(), old = u.email;
      if (email.toLowerCase() !== old.toLowerCase() && all.some(function (x) { return x.email.toLowerCase() === email.toLowerCase(); })) { $('#err').textContent = 'This email is already used by another account.'; $('#msg').textContent = ''; return; }
      all.forEach(function (x) {
        if (x.email !== old) return;
        x.first = $('#fn').value.trim(); x.last = $('#ln').value.trim(); x.email = email; x.phone = $('#ph').value.trim();
        x.prefs = { remind: f.elements.remind.checked, invites: f.elements.invites.checked, news: f.elements.news.checked };
      });
      write(L, 'sh_users', all);
      if (email !== old) {
        var bk = bookings(); bk.forEach(function (b) { if (b.email === old) b.email = email; }); write(L, 'sh_bookings', bk);
        write(read(L, 'sh_session', null) ? L : S, 'sh_session', email);
      }
      $('#err').textContent = ''; $('#msg').textContent = 'Saved.';
    });
    $('#logout').addEventListener('click', function () { signOut(); location.href = 'index.html'; });
  };


  nav();
  var p = document.body.dataset.page;
  if (p && pages[p]) pages[p]();
})();
