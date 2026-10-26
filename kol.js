/*
 * The KOL site's main page: the Creators list (search, filters, 15 per page) and "Add a creator" by
 * profile link. Later steps add the Review, Outreach and Dashboard tabs here.
 */
(function () {
  'use strict';
  var esc = PW.esc;
  var $ = function (id) { return document.getElementById(id); };
  var PAGE = 15;
  var state = { data: null, search: '', platform: 'All', status: 'All', page: 0, addOpen: false };

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
    return state.data.creators.filter(function (c) {
      return (state.platform === 'All' || c.platform === state.platform) && (state.status === 'All' || c.status === state.status) &&
        (!s || c.handle.indexOf(s) >= 0 || c.display_name.toLowerCase().indexOf(s) >= 0 || c.note.toLowerCase().indexOf(s) >= 0);
    });
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
      '<label for="cwho">Saved by</label><input type="text" id="cwho" maxlength="60" placeholder="Your name" list="people">' +
      '<datalist id="people">' + d.people.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist></div>');
    out.push('<details class="card addcreator"' + (d.creators.length && !state.addOpen ? '' : ' open') + '><summary>Add a creator</summary><div class="grid">' +
      '<div><label for="aurl">Instagram or TikTok profile link</label><input type="url" id="aurl" placeholder="https://www.instagram.com/… or https://www.tiktok.com/@…"></div>' +
      '<div><label for="afollowers">Followers (optional)</label><input type="text" id="afollowers" placeholder="e.g. 12,3K"></div>' +
      '<div><label for="anote">Note (optional)</label><input type="text" id="anote" maxlength="500"></div>' +
      '</div><div class="row"><button type="button" id="aadd">Add creator</button><span class="small" id="amsg"></span></div>' +
      '<p class="muted small">For exact numbers and the bio, open the profile and click the PW creator bookmark instead.</p></details>');
    out.push('<p class="qsum">' + list.length + (list.length === d.creators.length ? '' : ' of ' + d.creators.length) + ' creators</p>');
    if (!d.creators.length) {
      out.push('<p class="note">No creators yet. Paste a profile link above, or open a profile on Instagram or TikTok and click the ' +
        '<a href="install.html">PW creator bookmark</a>.</p>');
    } else if (!shown.length) {
      out.push('<p class="note">No creator matches.</p>');
    } else {
      out.push('<table class="list ctable"><thead><tr><th>Creator</th><th class="n">Followers</th><th>Numbers saved</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
        shown.map(function (c) {
          return '<tr><td class="who" data-th="Creator"><a href="' + esc(c.profile_url) + '" target="_blank" rel="noopener">@' + esc(c.handle) + '</a>' +
            (c.display_name ? ' <span class="muted">' + esc(c.display_name) + '</span>' : '') + (c.verified ? ' <span class="tag">Verified</span>' : '') +
            '<div class="muted small">' + esc(c.platform) + ' · ' + esc(c.source) + ' · added ' + esc(ago(c.added_at)) + (c.added_by ? ' by ' + esc(c.added_by) : '') + '</div></td>' +
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
    $('main').innerHTML = out.join('');
    bind();
  }

  function bind() {
    PW.remember('pwkol_by', $('cwho'));
    document.querySelector('.addcreator').addEventListener('toggle', function () { state.addOpen = this.open; });
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

  load();
})();
