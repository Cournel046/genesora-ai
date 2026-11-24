/* Genesora AI - main page script (cookie banner, hero slider, menu, tabs, waitlist forms).
   Moved out of index.html so the Content-Security-Policy can block ALL inline scripts.
   Behaviour is unchanged. The Apps Script link (SCRIPT_URL) now lives in this file. */
    // 🍪 COOKIE BANNER LOGIC
    function acceptCookies() {
      localStorage.setItem('genesora_cookies_consent', 'accepted');
      document.getElementById('cookie-banner').classList.add('hidden');
    }

    function declineCookies() {
      localStorage.setItem('genesora_cookies_consent', 'declined');
      document.getElementById('cookie-banner').classList.add('hidden');
    }

    window.addEventListener('DOMContentLoaded', () => {
      const cookieConsent = localStorage.getItem('genesora_cookies_consent');
      if (cookieConsent === 'accepted' || cookieConsent === 'declined') {
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.classList.add('hidden');
      }
    });

    // 🎬 HERO SLIDER LOGIC
    let currentSlide = 1;
    const totalSlides = 3;

    function showSlide(index) {
      document.querySelectorAll('.hero-bg, .hero-slide, .h-dot').forEach(el => el.classList.remove('active'));
 
      document.querySelector(`.hero-bg.bg-${index}`).classList.add('active');
      document.querySelector(`#slide-${index}`).classList.add('active');
      document.querySelector(`#dot-${index}`).classList.add('active');
 
      currentSlide = index;
    }

    let sliderInterval = setInterval(() => {
      let next = currentSlide >= totalSlides ? 1 : currentSlide + 1;
      showSlide(next);
    }, 6500);

    document.querySelectorAll('.h-dot').forEach((dot, index) => {
      dot.addEventListener('click', () => {
        clearInterval(sliderInterval);
        showSlide(index + 1);
        sliderInterval = setInterval(() => {
          let next = currentSlide >= totalSlides ? 1 : currentSlide + 1;
          showSlide(next);
        }, 6500);
      });
    });

    // ── GENERAL LOGIC ──
    document.getElementById('hamburger').addEventListener('click', function() {
      document.getElementById('mobileMenu').classList.toggle('open');
    });

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
        document.querySelectorAll('.steps-list').forEach(function(s){ s.classList.remove('active'); });
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });

    document.querySelectorAll('a[href^="#"]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        var t = document.querySelector(this.getAttribute('href'));
        if (t) {
          e.preventDefault();
          t.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.getElementById('mobileMenu').classList.remove('open');
        }
      });
    });

    // ── GOOGLE APPS SCRIPT LOGIC ──
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwR-0fEIcrX7NXXIgsBlme-cqoPdiOMS0qKFsxahDarWsvGnDwfQx9dPyoJ4jRJL2ub-w/exec";


    // ── FORM VALIDATION HELPERS (dropdowns + light checks) ──
    const WL_LOADED_AT = Date.now();
    function wlFlag(el, bad) { if (el) el.classList.toggle('field-bad', !!bad); return !bad; }
    function wlCheck(form, msgEl, rules) {
      // rules: [[element, isValid, message], ...] — returns true if all pass, else shows first message
      let first = null;
      form.querySelectorAll('.field-bad').forEach(x => x.classList.remove('field-bad'));
      rules.forEach(([el, ok, text]) => { if (!ok) { el.classList.add('field-bad'); if (!first) first = [el, text]; } });
      if (first) { msgEl.style.color = '#ef4444'; msgEl.textContent = first[1]; first[0].focus(); return false; }
      return true;
    }
    const wlNameOk  = v => /^[\p{L}][\p{L}\p{M} .'\-]{1,59}$/u.test(v) && !/(.)\1{3,}/u.test(v) && (v.match(/\p{L}/gu) || []).length >= 2 && !/^(asdf|qwert|zxcv|abcd|xxxx)/i.test(v.replace(/[\s.'\-]/g,'')) && !/^(test|testing|none|null|admin|user|name|fake|xyz|abc)$/i.test(v.replace(/[\s.'\-]/g,''));
    const wlEmailOk = v => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) && v.length <= 100;
    const wlCompanyOk = v => v.length >= 2 && v.length <= 80 && /\p{L}/u.test(v) && !/https?:|www\./i.test(v) && !/(.)\1{4,}/u.test(v);
    const wlBot = form => (form.querySelector('.wl-hp').value !== '') || (Date.now() - WL_LOADED_AT < 2500);
    // show white text once a real option is picked
    document.querySelectorAll('.form-card select').forEach(sel => {
      const sync = () => sel.classList.toggle('has-val', sel.value !== '');
      sel.addEventListener('change', sync); sync();
    });
    // reset leaves selects grey again
    document.querySelectorAll('.form-card form').forEach(f => f.addEventListener('reset', () => setTimeout(() => f.querySelectorAll('select').forEach(s => s.classList.remove('has-val')), 0)));

    // ── CLOUDFLARE TURNSTILE MODAL LOGIC ──
    const TURNSTILE_SITE_KEY = "0x4AAAAAAGQL3hSBAvFDGzEj";
    let turnstileWidgetId = null;
    let onTurnstileSuccess = null;
    let onTurnstileCancel = null;

    function closeHumanModal(wasCancelled) {
      const modal = document.getElementById('humanModal');
      if (modal) modal.hidden = true;
      const cancelCb = onTurnstileCancel;
      onTurnstileSuccess = null;
      onTurnstileCancel = null;
      if (wasCancelled && cancelCb) cancelCb();
    }

    function openHumanCheck(callback, cancelCallback) {
      const modal = document.getElementById('humanModal');
      const errEl = document.getElementById('humanModalErr');
      if (!modal) { callback(""); return; }

      errEl.textContent = "";
      onTurnstileSuccess = callback;
      onTurnstileCancel = cancelCallback || null;
      modal.hidden = false;

      if (!window.turnstile) {
        errEl.textContent = "Verification widget is still loading. Close and try again in a second.";
        return;
      }

      if (turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
        return;
      }

      turnstileWidgetId = window.turnstile.render('#turnstile-container', {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: function(token) {
          const cb = onTurnstileSuccess;
          closeHumanModal(false);
          if (cb) cb(token);
        },
        'error-callback': function() {
          errEl.textContent = "Verification failed. Please try again.";
        },
        'expired-callback': function() {
          errEl.textContent = "Check expired. Please verify again.";
        }
      });
    }

    (function() {
      const modal = document.getElementById('humanModal');
      const closeBtn = document.getElementById('closeHumanModal');
      if (closeBtn) closeBtn.addEventListener('click', function() { closeHumanModal(true); });
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) closeHumanModal(true);
        });
      }
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && !modal.hidden) closeHumanModal(true);
      });
    })();

    // ── EMAIL OTP MODAL LOGIC ──
    let otpState = null;

    function closeOtpModal(wasCancelled) {
      const modal = document.getElementById('otpModal');
      if (modal) modal.hidden = true;
      const st = otpState;
      otpState = null;
      if (wasCancelled && st && st.onCancel) st.onCancel();
    }

    function openOtpModal(opts) {
      const modal = document.getElementById('otpModal');
      const emailEl = document.getElementById('otpModalEmail');
      const inputEl = document.getElementById('otpInput');
      const errEl = document.getElementById('otpModalErr');
      const verifyBtn = document.getElementById('otpVerifyBtn');
      if (!modal) return;

      otpState = opts;
      emailEl.textContent = opts.email;
      inputEl.value = "";
      errEl.textContent = "";
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify & Join";
      modal.hidden = false;
      setTimeout(() => inputEl.focus(), 50);
    }

    function sendEmailOtp(email, name, type, turnstileToken) {
      const fd = new FormData();
      fd.append("action", "send_otp");
      fd.append("email", email);
      fd.append("name", name);
      fd.append("type", type);
      fd.append("turnstileToken", turnstileToken);

      return fetch(SCRIPT_URL, {
        method: 'POST',
        body: fd
      })
        .then(response => {
          if (!response.ok) throw new Error('Network error');
          return response.json();
        })
        .then(data => {
          if (data && data.status === 'otp_sent') return data;
          throw new Error(data && data.message ? data.message : 'Could not send verification code.');
        });
    }

    (function() {
      const modal = document.getElementById('otpModal');
      const form = document.getElementById('otpForm');
      const inputEl = document.getElementById('otpInput');
      const errEl = document.getElementById('otpModalErr');
      const verifyBtn = document.getElementById('otpVerifyBtn');
      const resendBtn = document.getElementById('otpResendBtn');
      const closeBtn = document.getElementById('closeOtpModal');

      if (inputEl) {
        inputEl.addEventListener('input', function() {
          this.value = this.value.replace(/\D/g, '').slice(0, 6);
          errEl.textContent = "";
        });
      }

      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          if (!otpState) return;

          const code = inputEl.value.trim();
          if (!/^\d{6}$/.test(code)) {
            errEl.textContent = "Please enter the 6-digit code from your email.";
            inputEl.focus();
            return;
          }

          verifyBtn.disabled = true;
          verifyBtn.textContent = "Verifying...";
          errEl.textContent = "";

          otpState.onVerify(code, function onDone(errMessage) {
            if (!errMessage) {
              closeOtpModal(false);
            } else {
              errEl.textContent = errMessage;
              verifyBtn.disabled = false;
              verifyBtn.textContent = "Verify & Join";
              inputEl.focus();
            }
          });
        });
      }

      if (resendBtn) {
        resendBtn.addEventListener('click', function() {
          if (!otpState || !otpState.onResend) return;
          const resendCb = otpState.onResend;
          closeOtpModal(false);
          resendCb();
        });
      }

      if (closeBtn) closeBtn.addEventListener('click', function() { closeOtpModal(true); });
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) closeOtpModal(true);
        });
      }
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && !modal.hidden) closeOtpModal(true);
      });
    })();

    // --- USER FORM LOGIC ---
    document.getElementById('userForm').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const form = this;
      const btn = form.querySelector('.submit-user');
      const msg = document.getElementById('userMsg');
      const originalText = "Join as a User — Get Early Access";

      const un = document.getElementById('u_name'), ue = document.getElementById('u_email'), uc = document.getElementById('u_country');
      un.value = un.value.trim().replace(/\s+/g, ' '); ue.value = ue.value.trim();
      if (!wlCheck(form, msg, [
        [un, wlNameOk(un.value), 'Please enter your real full name.'],
        [ue, wlEmailOk(ue.value), 'Please enter a valid email address.'],
        [uc, uc.value !== '', 'Please choose your country.']
      ])) return;
      if (wlBot(form)) { msg.style.color = "#90EE90"; msg.textContent = "✓ You're on the early access list!"; return; }

      const joinName = un.value;
      const joinEmail = ue.value;

      function resetBtn() {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      function startUserVerification() {
        openHumanCheck(function(token) {
          btn.textContent = "Sending Code...";
          btn.disabled = true;
          msg.textContent = "";

          sendEmailOtp(joinEmail, joinName, "User / Job Seeker", token)
            .then(() => {
              btn.textContent = "Waiting for Verification...";
              openOtpModal({
                email: joinEmail,
                onCancel: resetBtn,
                onResend: startUserVerification,
                onVerify: function(otpCode, done) {
                  btn.textContent = "Securing Spot...";

                  const fd = new FormData();
                  fd.append("type", "User / Job Seeker");
                  fd.append("name", joinName);
                  fd.append("email", joinEmail);
                  
                  const intentSelect = document.getElementById('u_intent');
                  fd.append("detail2", intentSelect.value || "");
                  fd.append("detail1", document.getElementById('u_industry').value);
                  fd.append("country", uc.value);
                  fd.append("otp", otpCode);

                  // ✨ NEW: referral game fields (ignored by the sheet until you update the Apps Script)
                  if (window.GenesoraWaitlist) {
                    fd.append("ref", window.GenesoraWaitlist.getRef());
                    fd.append("refCode", window.GenesoraWaitlist.prepareCode(joinName));
                  }

                  fetch(SCRIPT_URL, { 
                    method: 'POST', 
                    body: fd
                  })
                    .then(response => {
                      if (!response.ok) throw new Error('Network error');
                      return response.json();
                    })
                    .then(data => {
                      if (data && data.status === 'success') {
                        done(null);
                        msg.style.color = "#90EE90";
                        msg.textContent = "✓ You're on the early access list!";
                        form.reset();
                        btn.textContent = "Joined Successfully";
                        // ✨ NEW: show the referral card
                        if (window.GenesoraWaitlist) window.GenesoraWaitlist.onJoined(data, { name: joinName });
                      } else {
                        throw new Error(data ? data.message : 'Unknown response');
                      }
                    })
                    .catch(error => {
                      console.error('Waitlist Error:', error);
                      done(error.message || "Could not verify code. Please try again.");
                    });
                }
              });
            })
            .catch(error => {
              console.error('Waitlist OTP Error:', error);
              msg.style.color = "#ef4444";
              msg.textContent = error.message || "Could not send verification code. Please try again.";
              resetBtn();
            });
        }, resetBtn);
      }

      startUserVerification();
    });

    // --- ENTERPRISE FORM LOGIC ---
    document.getElementById('entForm').addEventListener('submit', function(e) {
      e.preventDefault();

      const form = this;
      const btn = form.querySelector('.submit-ent');
      const msg = document.getElementById('entMsg');
      const originalText = "Join as an Enterprise — Get Early Access";

      const en = document.getElementById('e_name'), ec = document.getElementById('e_company'), ee = document.getElementById('e_email');
      const ect = document.getElementById('e_country');
      en.value = en.value.trim().replace(/\s+/g, ' '); ec.value = ec.value.trim().replace(/\s+/g, ' '); ee.value = ee.value.trim();
      if (!wlCheck(form, msg, [
        [en, wlNameOk(en.value), 'Please enter your real full name.'],
        [ec, wlCompanyOk(ec.value), 'Please enter a valid company name.'],
        [ee, wlEmailOk(ee.value), 'Please enter a valid work email address.'],
        [ect, ect.value !== '', 'Please choose your country.']
      ])) return;
      if (wlBot(form)) { msg.style.color = "#90EE90"; msg.textContent = "✓ Enterprise request received — we'll be in touch!"; return; }

      const entName = en.value;
      const entEmail = ee.value;

      function resetBtn() {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      function startEntVerification() {
        openHumanCheck(function(token) {
          btn.textContent = "Sending Code...";
          btn.disabled = true;
          msg.textContent = "";

          sendEmailOtp(entEmail, entName, "Enterprise", token)
            .then(() => {
              btn.textContent = "Waiting for Verification...";
              openOtpModal({
                email: entEmail,
                onCancel: resetBtn,
                onResend: startEntVerification,
                onVerify: function(otpCode, done) {
                  btn.textContent = "Registering...";

                  const fd = new FormData();
                  fd.append("type", "Enterprise");
                  fd.append("name", entName);
                  fd.append("email", entEmail);
                  fd.append("detail1", ec.value);
                  fd.append("detail2", "");
                  fd.append("country", ect.value);
                  fd.append("otp", otpCode);

                  fetch(SCRIPT_URL, { 
                    method: 'POST', 
                    body: fd
                  })
                    .then(response => {
                      if (!response.ok) throw new Error('Network error');
                      return response.json();
                    })
                    .then(data => {
                      if (data && data.status === 'success') {
                        done(null);
                        msg.style.color = "#90EE90";
                        msg.textContent = "✓ Enterprise request received — we'll be in touch!";
                        form.reset();
                        btn.textContent = "Registered Successfully";
                      } else {
                        throw new Error(data ? data.message : 'Unknown response');
                      }
                    })
                    .catch(error => {
                      console.error('Enterprise Error:', error);
                      done(error.message || "Could not verify code. Please try again.");
                    });
                }
              });
            })
            .catch(error => {
              console.error('Enterprise OTP Error:', error);
              msg.style.color = "#ef4444";
              msg.textContent = error.message || "Could not send verification code. Please try again.";
              resetBtn();
            });
        }, resetBtn);
      }

      startEntVerification();
    });

// ── Buttons that used inline onclick= (blocked by the security policy), wired here instead ──
(function () {
  var acc = document.querySelector('#cookie-banner .btn-accept'), dec = document.querySelector('#cookie-banner .btn-decline');
  if (acc) acc.addEventListener('click', acceptCookies);
  if (dec) dec.addEventListener('click', declineCookies);
  document.querySelectorAll('[data-open-tab]').forEach(function (a) {
    a.addEventListener('click', function () {
      var t = document.querySelector('[data-tab="' + a.getAttribute('data-open-tab') + '"]');
      if (t) t.click();
    });
  });
})();
