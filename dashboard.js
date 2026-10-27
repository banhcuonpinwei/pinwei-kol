/*
 * The Dashboard tab of the KOL site (drawn through window.KOL, from kol.js): its own numbers ("dashboard" API call)
 * each time the tab opens, or on Refresh. One chart, the funnel: a single series in one hue (navy), thin bars
 * anchored at the left with a rounded data end, the count and the step-to-step rate written next to each bar, and
 * what each step means on hover. Everything else is tables.
 */
(function () {
  'use strict';
  var K = window.KOL;
  var esc = PW.esc;
  var $ = function (id) { return document.getElementById(id); };
  var data = null;
  var loading = false;

  function tile(label, value, note) {
    return '<div class="tile"><div class="tile-label">' + esc(label) + '</div><div class="tile-value">' + esc(value) + '</div>' +
      (note ? '<div class="muted small">' + esc(note) + '</div>' : '') + '</div>';
  }

  function rate(n, of) {
    return of ? Math.round((n / of) * 100) + '%' : '-';
  }

  function funnel(steps) {
    var max = Math.max.apply(null, steps.map(function (s) { return s.n; }).concat([1]));
    return '<div class="kfun"><div class="kfhead"><span>Step</span><span></span><span class="n">Creators</span>' +
      '<span class="n">' + K.hint('of the step before', 'Share of the creators at the step before who reached this one.', 'r') + '</span></div>' +
      steps.map(function (s, i) {
        var prev = i ? steps[i - 1].n : 0;
        return '<div class="kfrow"><span>' + K.hint(esc(s.label), s.help) + '</span>' +
          '<span class="kfbar" aria-hidden="true"><span class="kffill" style="width:' + (s.n ? Math.max(0.6, (s.n / max) * 100) : 0) + '%"></span></span>' +
          '<span class="n"><b>' + K.num(s.n) + '</b></span><span class="n muted">' + (i ? rate(s.n, prev) : '') + '</span></div>';
      }).join('') + '</div>';
  }

  function table(head, rows, empty) {
    if (!rows.length) return '<p class="muted small">' + esc(empty) + '</p>';
    return '<div class="scroll-x"><table class="list kdtable"><thead><tr>' + head.map(function (h) {
      return '<th' + (h[1] ? ' class="n"' : '') + '>' + h[0] + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) { return '<td' + (head[i][1] ? ' class="n"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }

  function creatorLink(o) {
    return '<a href="' + esc(o.profile_url) + '" target="_blank" rel="noopener">@' + esc(o.handle) + '</a>';
  }

  function branch(o) {
    return esc(o.branch === 'Any' ? 'they choose' : o.branch);
  }

  function draw() {
    var d = data;
    var t = d.tiles;
    var out = ['<p class="qsum">Counted from the sheets just now. <button type="button" class="link-btn" id="kdrefresh">Refresh</button></p>'];
    out.push('<div class="tiles">' + tile('Creators found', K.num(t.found), 'from every source') +
      tile('Waiting for review', K.num(t.waiting_review), 'in the Review tab') +
      tile('Open invitations', K.num(t.open_invitations), t.to_send ? t.to_send + ' still to send' : 'all sent') +
      tile('Reviews posted', K.num(t.posted), '') + '</div>');
    out.push('<div class="kdgrid"><section class="card"><h2 class="card-title">Funnel</h2>' + funnel(d.funnel) + '</section>');
    out.push('<section class="card"><h2 class="card-title">Visits coming up</h2>' + table([['Visit'], ['Creator'], ['Branch'], ['Invitation']],
      d.upcoming.map(function (o) { return [esc(o.scheduled_for), creatorLink(o), branch(o), esc(o.invite_type)]; }),
      'No visit is scheduled. Set the status Scheduled and the visit date in Outreach.') +
      '<h2 class="card-title">Why creators were rejected</h2>' + table([['Reason'], ['Creators', 1]],
      d.rejected.map(function (r) { return [esc(r.reason), r.n]; }), 'Nobody rejected yet.') + '</section></div>');
    var cols = [['found', 'Found'], ['classified', 'Classified'], ['food_hcmc', 'Food in HCMC'], ['shortlisted', 'Shortlisted'], ['approved', 'Approved'],
      ['contacted', 'Contacted'], ['posted', 'Posted']];
    out.push('<section class="card"><h2 class="card-title">By source</h2>' + table([['Source']].concat(cols.map(function (c) { return [esc(c[1]), 1]; })),
      d.sources.map(function (s) { return [esc(s.label)].concat(cols.map(function (c) { return K.num(s[c[0]]); })); }), 'No creators yet.') +
      '<p class="small muted">Where a creator first came from. Which sources end up in Shortlisted and Posted tells where to look next.</p></section>');
    out.push('<section class="card"><h2 class="card-title">Reviews posted</h2>' + table([['Posted'], ['Creator'], ['Branch'], ['Invitation'], ['Review'], ['Numbers']],
      d.reviews.map(function (o) {
        return [esc(o.posted_at), creatorLink(o), branch(o), esc(o.invite_type), o.review_url ? '<a href="' + esc(o.review_url) + '" target="_blank" rel="noopener">Open</a>' : '-',
          esc(o.review_stats || '-')];
      }), 'No review yet. In Outreach, set Posted and add the review link and its numbers.') + '</section>');
    $('main').innerHTML = out.join('');
    $('kdrefresh').addEventListener('click', load);
  }

  function load() {
    if (loading) return;
    loading = true;
    if (!data) $('main').innerHTML = '<p class="muted">Counting…</p>';
    PW.api('dashboard').then(function (r) {
      loading = false;
      data = r.data;
      if (K.state.tab === 'dashboard') draw();
    }, function (err) {
      loading = false;
      if (K.state.tab === 'dashboard') K.showError(err);
    });
  }

  /** Draws what it has at once (if anything), and counts again. */
  K.renderDashboard = function () {
    if (data) draw();
    load();
  };
})();
