/* Static demo shim.

   The pages are the real ones, so they still contain forms and buttons. There
   is no server, so every one of them is caught here and answered with a notice
   instead. Nothing is written anywhere - reloading restores the original state.
*/
(function () {
  "use strict";
  var TOAST_MS = 2600;

  function toast(msg) {
    var t = document.querySelector(".demo-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "demo-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("on"); }, TOAST_MS);
  }

  document.addEventListener("submit", function (e) {
    e.preventDefault();
    toast("Demo only \u2014 nothing is saved.");
  }, true);

  /* The clearance filter. Each type runs a different ladder, so the board shows
     one at a time rather than mixing chains in a single list. */
  var tabs = [].slice.call(document.querySelectorAll(".ctab"));
  if (tabs.length) {
    var rows = [].slice.call(document.querySelectorAll(".plist tbody tr"));
    var empty = document.querySelector(".pempty");
    var pick = function (type) {
      var shown = 0;
      rows.forEach(function (r) {
        var on = r.dataset.type === type;
        r.hidden = !on;
        if (on) shown++;
      });
      tabs.forEach(function (t) { t.classList.toggle("on", t.dataset.type === type); });
      if (empty) empty.hidden = shown > 0;
    };
    tabs.forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        pick(t.dataset.type);
      }, true);
    });
    pick(tabs[0].dataset.type);
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-demo], button, .btn, summary > *");
    if (!el) return;
    if (el.classList && el.classList.contains("ctab")) return;   // handled above
    if (el.dataset && el.dataset.demo) {
      e.preventDefault();
      toast(el.dataset.demo);
      return;
    }
    var isSubmit = el.tagName === "BUTTON" &&
                   (el.type === "submit" || !el.type) && el.closest("form");
    if (isSubmit) return;
    if (el.tagName === "BUTTON" && !el.closest("details") && !el.closest("form")) {
      e.preventDefault();
      toast("Demo only \u2014 nothing is saved.");
    }
  }, true);
})();
