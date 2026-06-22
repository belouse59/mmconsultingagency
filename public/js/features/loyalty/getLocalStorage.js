  /*
    Inline, render-blocking, intentionally tiny.
    Reads the last-used tab (localStorage) or a ?type= deep-link
    BEFORE first paint, so the correct tab is active with zero
    flash/flicker — no client-side tab-switch animation needed
    on initial load for returning users.

    Priority: ?type= param (explicit deep link) > localStorage
    (remembered choice) > "customer" (default for first-time,
    no-param visitors).
  */

    (function () {
      var params  = new URLSearchParams(location.search);
      var fromUrl = params.get("type");
      var stored  = localStorage.getItem("loyalty-login-tab");
      var initial = (fromUrl === "partner" || fromUrl === "customer")
        ? fromUrl
        : (stored === "partner" || stored === "customer")
          ? stored
          : "customer";

      // Persist immediately so a param-driven deep link also
      // becomes the remembered choice for next time.
      localStorage.setItem("loyalty-login-tab", initial);

      document.documentElement.dataset.initialTab = initial;
    })();
