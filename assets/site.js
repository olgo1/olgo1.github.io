document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  if (button && nav) {
    button.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const ogeToggle = document.querySelector("[data-oge-toggle]");
  const ogeSection = document.querySelector("#oge");

  if (ogeToggle && ogeSection) {
    const syncOge = () => {
      const isOpen = window.location.hash === "#oge";
      ogeSection.hidden = !isOpen;
      ogeToggle.setAttribute("aria-expanded", String(isOpen));
    };

    syncOge();

    ogeToggle.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const url = new URL(window.location.href);
      url.hash = ogeSection.hidden ? "oge" : "";
      window.history.pushState(null, "", url);
      syncOge();
    });

    window.addEventListener("hashchange", syncOge);
    window.addEventListener("popstate", syncOge);
  }

  const formToggle = document.querySelector("[data-course-form-toggle]");
  const formSection = document.querySelector("#course-interest-form");

  if (formToggle && formSection) {
    formToggle.addEventListener("click", (event) => {
      event.preventDefault();

      const willOpen = formSection.hidden;
      formSection.hidden = !willOpen;
      formToggle.setAttribute("aria-expanded", String(willOpen));
    });
  }
});
