/* Stage remarks.

   The chart says where a file is and how long it has been there. It cannot say
   WHY — that the DFO is waiting on a district office, that the levies note is
   with accounts, that someone chased it on Tuesday. On a live project that is
   the thing a reviewer actually asks, and today it lives in somebody's inbox.

   So each stage carries a running note. Hovering a bar lists what is already
   recorded; clicking it opens a panel to add more.

   In this demo they are held in the browser's own storage: they survive a
   reload and are private to whoever is looking, and nothing leaves the machine.
   In the real tool this is where a table and a per-request write check would go
   — the remark's author and time would come from the session rather than being
   typed, and a Regional Officer would only be able to write against their own
   region's files.
*/
(function () {
  "use strict";

  var KEY = "pa-demo-remarks:" + (location.pathname.split("/").pop() || "index");
  var AUTHOR = "You (demo)";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }

  /* Keyed on the stage AND the day it was entered, not on the stage alone: a
     file can sit at the same desk three separate times, and a note about the
     third visit does not belong to the first. */
  function keyOf(leg, label) { return label + "@" + leg.from; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  }
  function p2(x) { return String(x).padStart(2, "0"); }
  function stamp(iso) {
    var d = new Date(iso);
    return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() +
           " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }

  window.PA_JOURNEY_HOOKS = {
    // what the hover tooltip shows: the notes themselves, not just a count —
    // a badge saying "2 remarks" makes you click to find out they were useless
    legExtra: function (leg) {
      var label = (window.PA_JOURNEY.stages[leg.s] || {}).label || "";
      var list = load()[keyOf(leg, label)] || [];
      var h = '<div class="sepline"></div>';
      if (!list.length) {
        return h + '<div class="rk-none">No remarks yet &middot; ' +
               "<b>click the bar to add one</b></div>";
      }
      list.slice(-3).forEach(function (r) {
        h += '<div class="rk-line">&ldquo;' + esc(r.text) + '&rdquo;' +
             '<span class="rk-by">' + esc(r.by) + " &middot; " + stamp(r.at) +
             "</span></div>";
      });
      if (list.length > 3) {
        h += '<div class="rk-more">+ ' + (list.length - 3) + " earlier</div>";
      }
      return h + '<div class="rk-none"><b>Click the bar</b> to add or read all.</div>';
    },

    onLegClick: function (leg, el, label) { open(leg, label, el); },
  };

  var panel = null;

  function close() {
    if (panel) { panel.remove(); panel = null; }
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open(leg, label, el) {
    close();
    var k = keyOf(leg, label);
    panel = document.createElement("div");
    panel.className = "rk-panel";
    render(panel, k, label, leg);
    document.body.appendChild(panel);

    var r = el.getBoundingClientRect();
    var w = 340;
    panel.style.left = Math.max(10, Math.min(window.innerWidth - w - 10,
                                             r.left + r.width / 2 - w / 2)) + "px";
    var top = r.bottom + 10;
    if (top + panel.offsetHeight > window.innerHeight - 10) {
      top = Math.max(10, r.top - panel.offsetHeight - 10);
    }
    panel.style.top = top + "px";
    var ta = panel.querySelector("textarea");
    if (ta) ta.focus();
    document.addEventListener("keydown", onKey, true);
  }

  function render(root, k, label, leg) {
    var all = load(), list = all[k] || [];
    var h = '<div class="rk-head"><div><b>' + esc(label) + "</b>" +
            '<div class="rk-sub">' + esc(leg.from) +
            (leg.days != null ? " &middot; " + leg.days + " days here" : "") +
            "</div></div>" +
            '<button class="rk-x" type="button" aria-label="Close">&times;</button></div>';

    h += '<div class="rk-list">';
    if (!list.length) {
      h += '<div class="rk-empty">Nothing recorded for this stage yet.</div>';
    } else {
      list.forEach(function (r, i) {
        h += '<div class="rk-item"><div class="rk-text">' + esc(r.text) + "</div>" +
             '<div class="rk-meta">' + esc(r.by) + " &middot; " + stamp(r.at) +
             '<button class="rk-del" type="button" data-i="' + i + '">Delete</button>' +
             "</div></div>";
      });
    }
    h += "</div>";

    h += '<div class="rk-add">' +
         '<textarea rows="2" placeholder="What is happening at this stage?"></textarea>' +
         '<div class="rk-actions"><span class="rk-hint">Saved in this browser only</span>' +
         '<button class="rk-save" type="button">Add remark</button></div></div>';
    root.innerHTML = h;

    root.querySelector(".rk-x").addEventListener("click", close);
    root.querySelector(".rk-save").addEventListener("click", function () {
      var ta = root.querySelector("textarea");
      var text = (ta.value || "").trim();
      if (!text) { ta.focus(); return; }
      var cur = load();
      (cur[k] = cur[k] || []).push({ text: text, by: AUTHOR,
                                     at: new Date().toISOString() });
      save(cur);
      render(root, k, label, leg);
      root.querySelector("textarea").focus();
    });
    Array.prototype.forEach.call(root.querySelectorAll(".rk-del"), function (b) {
      b.addEventListener("click", function () {
        var cur = load();
        if (!cur[k]) return;
        cur[k].splice(+b.dataset.i, 1);
        if (!cur[k].length) delete cur[k];
        save(cur);
        render(root, k, label, leg);
      });
    });
    // typing in the panel must not reach the page's own submit handler
    root.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  document.addEventListener("click", function (e) {
    if (panel && !panel.contains(e.target)) close();
  });
  window.addEventListener("resize", close);
})();
