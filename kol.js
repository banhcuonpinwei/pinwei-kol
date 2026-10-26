/*
 * The KOL site's main page: the Creators list (search, filters, 15 per page) and "Add a creator" by
 * profile link. Later steps add the Review, Outreach and Dashboard tabs here.
 */
(function () {
  'use strict';
  var esc = PW.esc;
  var $ = function (id) { return document.getElementById(id); };
  var PAGE = 15;
  var state = { data: null, search: '', platform: 'All', status: 'All', sort: 'newest', page: 0, addOpen: false, classifying: false, classMsg: '',
    glossaryOpen: window.innerWidth >= 760 }; // the glossary starts closed on a phone, where it is long

  function showError(err) {
    $('main').innerHTML = err && err.auth ? PW.noKeyHtml() : '<p class="note bad">' + esc(err && err.message || err) + '</p>';
  }

  /** "3 days ago", "today" from an ISO date. */
  function ago(iso) {
    if (!iso) return '';
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
    return days <= 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago';
  }

  function load() {
    if (!window.PW_CONFIG.api) {
      $('main').innerHTML = '<p class="note warn">The KOL web app is not deployed yet, so there is nothing to show. ' +
        'See kol/README.md, One-time setup.</p>';
      return;
    }
    if (!PW.token()) return showError({ auth: true });
    PW.api('bootstrap').then(function (r) {
      state.data = r.data;
      render();
    }, showError);
  }

  function visible() {
    var s = state.search.trim().toLowerCase().replace(/^@/, '');
    var list = state.data.creators.filter(function (c) {
      return (state.platform === 'All' || c.platform === state.platform) && (state.status === 'All' || c.status === state.status) &&
        (!s || c.handle.indexOf(s) >= 0 || c.display_name.toLowerCase().indexOf(s) >= 0 || c.note.toLowerCase().indexOf(s) >= 0);
    });
    if (state.sort === 'score') {
      // Best first; excluded creators and those without a score at the end.
      var rank = function (c) { return c.score === null ? -2 : c.excluded ? -1 + c.score / 1000 : c.score; };
      list = list.slice().sort(function (a, b) { return rank(b) - rank(a); });
    }
    return list;
  }

  /** "Food yes · HCMC yes (all branches)" from the classification (by hand marked); the AI's reason on hover. */
  function classLine(cl) {
    if (!cl) return '';
    var all = cl.based_in_hcmc === 'yes' ? ' (all branches)' : '';
    return '<div class="small cls" title="' + esc(cl.reason) + '">Food ' + esc(cl.is_food_reviewer) + ' · HCMC ' + esc(cl.based_in_hcmc) + all +
      ' · ads ' + esc(cl.ad_density) + ' · tone ' + esc(cl.tone_fit) + (cl.by === 'manual' ? ' · by hand' : '') + '</div>';
  }

  /** What every word on the list means, with this sheet's own Config numbers. */
  function glossary(cfg) {
    var n = function (x) { return Number(x).toLocaleString('en-US'); };
    var pct = function (x) { return Math.round(Number(x) * 1000) / 10 + '%'; };
    var w = cfg.weights || {};
    var rows = [
      ['Food', '<b>yes</b>: food or drinks (dishes, restaurants, cafés, street food, milk tea) are a regular part of the posts, about a third ' +
        'or more, even mixed with travel, vlogs or comedy. <b>no</b>: food is rare. <b>unsure</b>: too little to tell.'],
      ['HCMC', '<b>yes</b>: the bio or everyday posts place them in Ho Chi Minh City (trips elsewhere do not count against it); ' +
        'such a creator is for <b>all three branches</b>. <b>no</b>: everyday life clearly in another city. <b>unsure</b>: no place named.'],
      ['ads', 'Share of posts that are paid ads or sponsored (hợp tác, tài trợ, discount codes, shop links): <b>low</b> under 20%, ' +
        '<b>medium</b> 20-50%, <b>high</b> over 50%. Fewer ads, more trusted reviews.'],
      ['tone', 'How the posts would sound for a family bánh cuốn shop: <b>good</b> friendly, warm, honest or funny; <b>ok</b> neutral or ' +
        'mostly other topics; <b>poor</b> crude, misleading or luxury-only.'],
      ['Score', '0-100, the weighted mean of the parts below that have data (weights in Config: engagement ' + w.engagement + ', growth ' +
        w.growth + ', size ' + w.size + ', fit ' + w.fit + '). No follower count, no score. Hover a classification to see the AI\'s reason.'],
      ['engagement', 'Instagram: (avg likes + avg comments) / followers, full marks at ' + pct(cfg.er_target_ig) + '. TikTok: avg views / followers, ' +
        'full marks at ' + pct(cfg.er_target_tiktok) + '. From the recent posts the bookmark read.'],
      ['growth', 'Followers gained per week, between the newest saved numbers and ones at least 7 days older; full marks at ' +
        pct(cfg.growth_target_weekly) + ' a week. "no growth yet" until a second capture a week later.'],
      ['size', '<b>nano</b> ' + n(cfg.follower_min) + '-' + n(cfg.nano_max) + ' followers, <b>micro</b> up to ' + n(cfg.follower_max) +
        ', <b>out</b> outside that range.'],
      ['fit', 'From ads and tone (few ads and a good tone score highest); "unsure" about food or HCMC takes off 20%.'],
      ['Red text', 'Excluded and why: verified account, outside the follower range, not a food creator or not based in HCMC. The score is kept to compare.'],
      ['Numbers saved', 'Days with a capture of the numbers (one per day). Capture the same creator again a week later to measure growth.'],
      ['Status', '<b>New</b> just added, <b>Classified</b> the AI or a person classified it; Approved, Rejected and Archived come with the review step.'],
    ];
    return '<details class="card glossary"' + (state.glossaryOpen ? ' open' : '') + '><summary>What the words on this list mean</summary><table class="list"><tbody>' +
      rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table></details>';
  }

  function scoreCell(c) {
    if (c.score === null) return '<span class="muted small">needs numbers</span>';
    var parts = '<b>' + c.score + '</b> <span class="muted small">' + esc(c.tier) + '</span>';
    if (c.excluded) return '<span class="excluded" title="' + esc(c.exclude_reason) + '">' + parts + '<div class="small badc">' + esc(c.exclude_reason) + '</div></span>';
    return parts + (c.missing ? '<div class="small muted">no ' + esc(c.missing) + ' yet</div>' : '');
  }

  function options(list, value, allLabel) {
    return ['All'].concat(list).map(function (x) {
      return '<option value="' + esc(x) + '"' + (x === value ? ' selected' : '') + '>' + esc(x === 'All' ? allLabel : x) + '</option>';
    }).join('');
  }

  function render() {
    var d = state.data;
    var list = visible();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    var shown = list.slice(state.page * PAGE, (state.page + 1) * PAGE);
    var out = [];
    out.push('<div class="qbar cbar"><input type="search" id="csearch" placeholder="Find a creator" value="' + esc(state.search) + '">' +
      '<select id="cplatform" aria-label="Platform">' + options(d.platforms, state.platform, 'All platforms') + '</select>' +
      '<select id="cstatus" aria-label="Status">' + options(d.statuses, state.status, 'All statuses') + '</select>' +
      '<select id="csort" aria-label="Order"><option value="newest"' + (state.sort === 'newest' ? ' selected' : '') + '>Newest first</option>' +
      '<option value="score"' + (state.sort === 'score' ? ' selected' : '') + '>Best score first</option></select>' +
      '<label for="cwho">Saved by</label><input type="text" id="cwho" maxlength="60" placeholder="Your name" list="people">' +
      '<datalist id="people">' + d.people.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>');
    out.push('<details class="card addcreator"' + (d.creators.length && !state.addOpen ? '' : ' open') + '><summary>Add a creator</summary><div class="agrid">' +
      '<div><label for="aurl">Instagram or TikTok profile link</label><input type="url" id="aurl" placeholder="https://www.instagram.com/… or https://www.tiktok.com/@…"></div>' +
      '<div><label for="afollowers">Followers (optional)</label><input type="text" id="afollowers" placeholder="e.g. 12,3K"></div>' +
      '<div><label for="anote">Note (optional)</label><input type="text" id="anote" maxlength="500"></div>' +
      '</div><div class="row"><button type="button" id="aadd">Add creator</button><span class="small" id="amsg"></span></div>' +
      '<p class="muted small">For exact numbers and the bio, open the profile and click the PW creator bookmark instead.</p></details>');
    var ai = d.ai_providers.length
      ? (d.pending_classification ? ' · <button type="button" class="alt small-btn" id="cclass"' + (state.classifying ? ' disabled' : '') + '>Classify ' +
        d.pending_classification + ' new</button>' : ' · all classified') +
        ' <span class="muted small">AI: ' + esc(d.ai_providers.join(' → ')) + '</span>'
      : ' · <span class="small warnc">No AI key in Script Properties: classify by hand.</span>';
    out.push('<p class="qsum">' + list.length + (list.length === d.creators.length ? '' : ' of ' + d.creators.length) + ' creators' + ai +
      ' <span class="small" id="cmsg">' + state.classMsg + '</span></p>');
    if (!d.creators.length) {
      out.push('<p class="note">No creators yet. Paste a profile link above, or open a profile on Instagram or TikTok and click the ' +
        '<a href="install.html">PW creator bookmark</a>.</p>');
    } else if (!shown.length) {
      out.push('<p class="note">No creator matches.</p>');
    } else {
      out.push('<table class="list ctable"><thead><tr><th>Creator</th><th>Score</th><th class="n">Followers</th><th>Numbers saved</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
        shown.map(function (c) {
          return '<tr><td class="who" data-th="Creator"><a href="' + esc(c.profile_url) + '" target="_blank" rel="noopener">@' + esc(c.handle) + '</a>' +
            (c.display_name ? ' <span class="muted">' + esc(c.display_name) + '</span>' : '') + (c.verified ? ' <span class="tag">Verified</span>' : '') +
            '<div class="muted small">' + esc(c.platform) + ' · ' + esc(c.source) + ' · added ' + esc(ago(c.added_at)) + (c.added_by ? ' by ' + esc(c.added_by) : '') + '</div>' +
            classLine(c.classification) + '</td>' +
            '<td class="sc" data-th="Score">' + scoreCell(c) + '</td>' +
            '<td class="n" data-th="Followers">' + PW.members(c.followers) + '</td>' +
            '<td data-th="Numbers saved">' + (c.snapshots ? c.snapshots + (c.snapshots === 1 ? ' day' : ' days') + ', last ' + esc(c.last_snapshot) : '<span class="muted">none yet</span>') + '</td>' +
            '<td class="stc" data-th="Status"><span class="st st-' + esc(c.status.toLowerCase()) + '">' + esc(c.status) + '</span></td>' +
            '<td class="nt" data-th="Note">' + esc(c.note) + '</td></tr>';
        }).join('') + '</tbody></table>');
      if (pages > 1) {
        out.push('<div class="pager"><button type="button" class="alt" id="cprev"' + (state.page === 0 ? ' disabled' : '') + '>Previous</button>' +
          '<span class="muted">Page ' + (state.page + 1) + ' of ' + pages + '</span>' +
          '<button type="button" class="alt" id="cnext"' + (state.page >= pages - 1 ? ' disabled' : '') + '>Next</button></div>');
      }
    }
    if (d.creators.length) out.push(glossary(d.score_config));
    $('main').innerHTML = out.join('');
    bind();
  }

  function bind() {
    PW.remember('pwkol_by', $('cwho'));
    document.querySelector('.addcreator').addEventListener('toggle', function () { state.addOpen = this.open; });
    if (document.querySelector('.glossary')) {
      document.querySelector('.glossary').addEventListener('toggle', function () { state.glossaryOpen = this.open; });
    }
    $('csearch').addEventListener('input', function () {
      state.search = this.value;
      state.page = 0;
      var pos = this.selectionStart;
      render();
      $('csearch').focus();
      $('csearch').setSelectionRange(pos, pos);
    });
    $('cplatform').addEventListener('change', function () { state.platform = this.value; state.page = 0; render(); });
    $('cstatus').addEventListener('change', function () { state.status = this.value; state.page = 0; render(); });
    $('csort').addEventListener('change', function () { state.sort = this.value; state.page = 0; render(); });
    if ($('cclass')) $('cclass').addEventListener('click', classifyAll);
    if ($('cprev')) $('cprev').addEventListener('click', function () { state.page--; render(); });
    if ($('cnext')) $('cnext').addEventListener('click', function () { state.page++; render(); });
    $('aadd').addEventListener('click', function () {
      var b = this;
      var m = $('amsg');
      var who = $('cwho').value.trim();
      m.className = 'small badc';
      if (!who) { m.textContent = 'Type your name in Saved by first.'; return; }
      b.disabled = true;
      m.className = 'small';
      m.textContent = 'Adding…';
      PW.api('creatorSave', { url: $('aurl').value, followers: $('afollowers').value, note: $('anote').value, saved_by: who }).then(function (r) {
        state.search = '';
        state.status = 'All';
        state.platform = 'All';
        return PW.api('bootstrap').then(function (all) {
          state.data = all.data;
          render();
          $('amsg').className = 'small okc';
          $('amsg').textContent = r.data.message;
          $('aurl').focus();
        });
      }).catch(function (err) {
        b.disabled = false;
        m.className = 'small badc';
        m.textContent = err.message;
      });
    });
  }

  /**
   * Classifies the pending creators a few at a time (each call waits for the AI), until none are left, the
   * whole provider chain fails, or a round makes no progress. Then the list reloads with the new scores.
   */
  function classifyAll() {
    var total = 0;
    state.classifying = true;
    var say = function (text, cls) {
      state.classMsg = '<span class="' + (cls || '') + '">' + esc(text) + '</span>';
      if ($('cmsg')) $('cmsg').innerHTML = state.classMsg;
    };
    say('Classifying…');
    $('cclass').disabled = true;
    var round = function () {
      return PW.api('classifyRun').then(function (r) {
        total += r.data.classified;
        if (r.data.error) return say(total + ' classified. Stopped: ' + r.data.error, 'badc');
        if (r.data.left && r.data.classified) {
          say(total + ' classified, ' + r.data.left + ' left…');
          return round();
        }
        say(total + ' classified.', 'okc');
      });
    };
    round().catch(function (err) { say('Stopped: ' + err.message, 'badc'); }).then(function () {
      state.classifying = false;
      return PW.api('bootstrap').then(function (all) { state.data = all.data; render(); });
    }).catch(showError);
  }

  load();
})();
