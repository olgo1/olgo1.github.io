document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  if (button && nav) {
    button.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
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
