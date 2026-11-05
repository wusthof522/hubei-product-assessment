(() => {
  "use strict";
  const start = document.getElementById("hbStart");
  const startInput = document.getElementById("hbStartName");
  const productName = document.getElementById("productName");
  const formSection = document.getElementById("assessment");
  const dock = document.getElementById("mDock");
  const success = document.getElementById("successView");

  // The first-viewport field hands the product name to step 1 and starts category matching.
  if (start && startInput && productName && formSection) {
    start.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = startInput.value.trim();
      if (value && productName.value.trim() !== value) {
        productName.value = value;
        productName.dispatchEvent(new Event("input", { bubbles: true }));
      }
      startInput.blur();
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // The bottom bar stays out of the way while the start field or the form is on screen.
  if (dock && formSection) {
    const onScreen = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top < window.innerHeight - 80 && rect.bottom > 80;
    };
    const sync = () => dock.classList.toggle("is-hidden", onScreen(start) || onScreen(formSection));
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  if (success) {
    const mark = () => document.body.classList.toggle("is-submitted", success.classList.contains("show"));
    new MutationObserver(mark).observe(success, { attributes: true, attributeFilter: ["class"] });
    mark();
  }
})();
