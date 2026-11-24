/* Genesora AI - About page script (scroll reveal + portrait fallback).
   Moved out of about.html so the Content-Security-Policy can block inline scripts. */
    const revealEls = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => { entry.target.classList.add('visible'); }, i * 80);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));

// If a portrait fails to load, show the initial instead (was an inline onerror= attribute).
document.querySelectorAll('img[data-fallback]').forEach(function (img) {
  function fail() { img.style.display = 'none'; if (img.parentElement) img.parentElement.textContent = img.getAttribute('data-fallback'); }
  img.addEventListener('error', fail);
  if (img.complete && img.naturalWidth === 0) fail();
});
