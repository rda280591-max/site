(() => {
  "use strict";

  const THEME_KEY = "orbit-theme";

  // Storage access can throw when the browser blocks it.
  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // The UI still works without persistence.
      }
    },
  };

  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const savedTheme = storage.get(THEME_KEY);

  let hasExplicitTheme = savedTheme === "dark" || savedTheme === "light";

  // Applied before the first paint so there is no theme flash.
  root.dataset.theme = hasExplicitTheme
    ? savedTheme
    : systemTheme.matches
      ? "dark"
      : "light";

  function init() {
    const body = document.body;
    const sidebar = document.getElementById("sidebar");
    const page = document.getElementById("page");
    const overlay = document.getElementById("overlay");

    const menuToggle = document.getElementById("menu-toggle");
    const sidebarClose = document.getElementById("sidebar-close");

    const themeToggle = document.getElementById("theme-toggle");
    const themeLabel = document.getElementById("theme-label");
    const themeIcon = document.getElementById("theme-icon");

    if (!sidebar || !page || !menuToggle || !themeToggle) return;

    const mainContent = document.getElementById("main-content");
    const navLinks = [...sidebar.querySelectorAll(".nav-link")];

    // Any width: the sidebar is off-canvas, so one state covers every screen.
    let sidebarOpen = false;
    let previousFocus = null;

    /* Theme */
    function updateThemeControls() {
      const isDark = root.dataset.theme === "dark";
      const action = isDark ? "فعال کردن تم روشن" : "فعال کردن تم تاریک";

      themeToggle.setAttribute("aria-pressed", String(isDark));
      themeToggle.setAttribute("aria-label", action);
      themeToggle.title = action;
      themeLabel.textContent = isDark ? "حالت روشن" : "حالت تاریک";
      themeIcon.setAttribute("href", isDark ? "#icon-sun" : "#icon-moon");
    }

    themeToggle.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";

      root.dataset.theme = nextTheme;
      hasExplicitTheme = true;
      storage.set(THEME_KEY, nextTheme);
      updateThemeControls();
    });

    // Follow the OS theme until the user picks one explicitly.
    systemTheme.addEventListener("change", (event) => {
      if (hasExplicitTheme) return;

      root.dataset.theme = event.matches ? "dark" : "light";
      updateThemeControls();
    });

    updateThemeControls();

    /* Sidebar open / close */
    function getFocusableElements() {
      return [...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]')].filter(
        (element) => element.getClientRects().length > 0,
      );
    }

    function setSidebarOpen(open, restoreFocus = true) {
      const wasOpen = sidebarOpen;
      sidebarOpen = Boolean(open);

      if (sidebarOpen && !wasOpen) {
        previousFocus = document.activeElement;
      }

      sidebar.classList.toggle("is-open", sidebarOpen);
      body.classList.toggle("nav-open", sidebarOpen);
      overlay.hidden = !sidebarOpen;
      menuToggle.setAttribute("aria-expanded", String(sidebarOpen));

      // `inert` keeps pointer and keyboard focus out of the covered content.
      page.inert = sidebarOpen;
      sidebar.inert = !sidebarOpen;

      if (sidebarOpen) {
        sidebarClose.focus();
      } else if (wasOpen && restoreFocus) {
        const target =
          previousFocus && previousFocus !== body
            ? previousFocus
            : navLinks.find((link) => link.getAttribute("aria-current") === "location") || menuToggle;

        target.focus();
      }
    }

    menuToggle.addEventListener("click", () => setSidebarOpen(!sidebarOpen));
    sidebarClose.addEventListener("click", () => setSidebarOpen(false));
    overlay.addEventListener("click", () => setSidebarOpen(false));

    document.addEventListener("keydown", (event) => {
      if (!sidebarOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }

      // Keep keyboard focus inside the open sidebar.
      if (event.key === "Tab") {
        const focusable = getFocusableElements();
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (!first) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    // Start closed so the full page width belongs to the content.
    setSidebarOpen(false, false);

    /* Active link + in-page navigation */
    function getHashTarget() {
      const hash = window.location.hash || "#dashboard";

      try {
        return document.getElementById(decodeURIComponent(hash.slice(1)));
      } catch {
        return null;
      }
    }

    function setCurrent(hash) {
      navLinks.forEach((link) => {
        if (link.getAttribute("href") === hash) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function revealTarget(target) {
      // Skip the tab stop once the section has scrolled into view.
      const clear = () => {
        target.removeAttribute("tabindex");
        target.removeEventListener("blur", clear);
      };

      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
      target.addEventListener("blur", clear);
      setTimeout(clear, 1200);
    }

    function handleNavigation(link) {
      const hash = link.getAttribute("href");
      const target = getHashTarget();

      setCurrent(hash);

      if (target) revealTarget(target);
      if (sidebarOpen) setSidebarOpen(false);
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        handleNavigation(link);
      });
    });

    if (mainContent) {
      mainContent.addEventListener("click", (event) => {
        const link = event.target.closest("a[href^='#']");

        if (!link) return;

        const target = getHashTarget();
        if (!target) return;

        event.preventDefault();
        setCurrent(link.getAttribute("href"));
        revealTarget(target);
      });
    }

    window.addEventListener("hashchange", () => {
      setCurrent(window.location.hash || "#dashboard");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
