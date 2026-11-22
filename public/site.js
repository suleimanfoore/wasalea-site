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

  /* ---- keep the version and installer sizes current ----
     The page ships with the figures hardcoded so crawlers and anyone
     without JavaScript see something sensible. /api/release reports what
     is actually published, and anything it knows gets corrected here, so
     shipping a release updates the site without an edit.
     Any failure leaves the page exactly as it was. */
  var stamped = document.querySelectorAll('[data-release]');
  if (stamped.length) {
    fetch('/api/release')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (release) {
        if (!release) return;
        Array.prototype.forEach.call(stamped, function (el) {
          var value = release[el.getAttribute('data-release')];
          if (value) el.textContent = value;
        });
      })
      .catch(function () { /* keep what the page already says */ });
  }

  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = document.getElementById('f-submit');
  var enquiry = document.getElementById('f-enquiry');

  /* ---- CTAs that preselect what the enquiry is about ----
     Any link carrying data-enquiry sets the dropdown as it scrolls the
     visitor to the form, so "Request a demo" and "Request a personalised
     quote" arrive already labelled instead of every message looking alike. */
  var ctas = document.querySelectorAll('a[data-enquiry]');
  Array.prototype.forEach.call(ctas, function (link) {
    link.addEventListener('click', function () {
      if (!enquiry) return;
      var wanted = link.getAttribute('data-enquiry');
      for (var i = 0; i < enquiry.options.length; i++) {
        if (enquiry.options[i].text === wanted) {
          enquiry.selectedIndex = i;
          break;
        }
      }
    });
  });

  function say(message, kind) {
    status.textContent = message;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
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
      enquiry: val('f-enquiry'),
      name: val('f-name'),
      business: val('f-business'),
      country: val('f-country'),
      phone: val('f-phone'),
      email: val('f-email'),
      agents: val('f-agents'),
      method: val('f-method'),
      message: val('f-message'),
      website: val('f-website')
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
          say('Thank you — your message is with us. We read every enquiry and a person will reply.', 'ok');
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
