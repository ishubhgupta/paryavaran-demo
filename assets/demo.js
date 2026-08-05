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

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-demo], button, .btn, summary > *");
    if (!el) return;
    if (el.dataset && el.dataset.demo) {
      e.preventDefault();
      toast(el.dataset.demo);
      return;
    }
    // a submit button inside a form is handled by the submit listener above
    var isSubmit = el.tagName === "BUTTON" &&
                   (el.type === "submit" || !el.type) && el.closest("form");
    if (isSubmit) return;
    if (el.tagName === "BUTTON" && !el.closest("details") && !el.closest("form")) {
      e.preventDefault();
      toast("Demo only \u2014 nothing is saved.");
    }
  }, true);

})();
