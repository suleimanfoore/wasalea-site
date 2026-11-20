/* Wasalea — small bits of behaviour. No framework, no build step. */
(function () {
  'use strict';

  /* ---- year in the footer ---- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- mobile nav ---- */
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close after tapping a link, and on Escape.
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---- contact form ---- */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = document.getElementById('f-submit');

  function say(message, kind) {
    status.textContent = message;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  function firstEmpty() {
    var required = ['f-name', 'f-phone', 'f-message'];
    for (var i = 0; i < required.length; i++) {
      var el = document.getElementById(required[i]);
      el.classList.remove('invalid');
      if (!el.value.trim()) return el;
    }
    return null;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var missing = firstEmpty();
    if (missing) {
      missing.classList.add('invalid');
      missing.focus();
      say('Please fill in your name, a phone number, and a message.', 'err');
      return;
    }

    var payload = {
      name: document.getElementById('f-name').value.trim(),
      business: document.getElementById('f-business').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      email: document.getElementById('f-email').value.trim(),
      message: document.getElementById('f-message').value.trim(),
      website: document.getElementById('f-website').value
    };

    submit.disabled = true;
    submit.textContent = 'Sending…';
    say('');

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          say('Thank you — your message is with us. We will come back to you shortly.', 'ok');
          submit.textContent = 'Sent';
          return;
        }
        submit.disabled = false;
        submit.textContent = 'Send message';
        say(r.body && r.body.error
          ? r.body.error
          : 'Sorry, that did not send. Please try again in a moment.', 'err');
      })
      .catch(function () {
        submit.disabled = false;
        submit.textContent = 'Send message';
        say('Sorry, that did not send — check your connection and try again.', 'err');
      });
  });
})();
