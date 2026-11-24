/* Genesora AI - Roadmap page script (scroll reveal).
   Moved out of roadmap.html so the Content-Security-Policy can block inline scripts. */
    // Scroll reveal for cards and general elements
    const revealEls = document.querySelectorAll('.scroll-reveal');
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 80);
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach(el => revealObs.observe(el));

    // Timeline phase cards
    const phases = document.querySelectorAll('.phase');
    const phaseObs = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 100);
          phaseObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    phases.forEach(el => phaseObs.observe(el));
