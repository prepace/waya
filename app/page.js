'use client';
import { useEffect, useId, useState } from 'react';

export default function Home() {
  const pageTitleId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const textareaId = useId();
  const worthId = useId();
  // helpId and remainingId were removed (unused)

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submission, setSubmission] = useState('');
  const [worth, setWorth] = useState('');

  // UI state
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [copied, setCopied] = useState(false);

  // field errors
  const [firstNameErr, setFirstNameErr] = useState('');
  const [lastNameErr, setLastNameErr] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [taskErr, setTaskErr] = useState('');
  const [worthErr, setWorthErr] = useState('');

  const MAX_LEN = 2000;

  // --- theme handling (unchanged) ---
  const applyTheme = (isDark) => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch { }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        setDarkMode(true);
        const root = document.documentElement;
        root.classList.toggle('dark', true);
        root.classList.toggle('light', false);
        try { localStorage.setItem('theme', 'dark'); } catch { }
        return;
      }
      if (saved === 'light') {
        setDarkMode(false);
        const root = document.documentElement;
        root.classList.toggle('dark', false);
        root.classList.toggle('light', true);
        try { localStorage.setItem('theme', 'light'); } catch { }
        return;
      }
    } catch { }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    setDarkMode(prefersDark);
    const root = document.documentElement;
    root.classList.toggle('dark', prefersDark);
    root.classList.toggle('light', !prefersDark);
    try { localStorage.setItem('theme', prefersDark ? 'dark' : 'light'); } catch { }
  }, []);

  const toggleDarkMode = () => setDarkMode(prev => { const next = !prev; applyTheme(next); return next; });

  // --- validation helpers ---
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Very permissive international phone: digits, spaces, () + - .; requires at least 7 digits
  const phoneDigits = (s) => (s.match(/\d/g) || []).length;

  // Format a string into a US phone style while preserving extra input
  const formatUSPhone = (input) => {
    if (!input) return '';
    const digits = (input + '').replace(/\D/g, '');
    // allow leading 1 (country code)
    let d = digits;
    let prefix = '';
    if (d.length > 0 && d[0] === '1') {
      prefix = '1 ';
      d = d.slice(1);
    }
    if (d.length <= 3) return prefix + d;
    if (d.length <= 6) return prefix + `(${d.slice(0, 3)}) ${d.slice(3)}`;
    // show up to 10 digits as standard (XXX) XXX-XXXX, keep extras after a space
    const part1 = d.slice(0, 3);
    const part2 = d.slice(3, 6);
    const part3 = d.slice(6, 10);
    const rest = d.slice(10);
    return prefix + `(${part1}) ${part2}${part3 ? '-' + part3 : ''}` + (rest ? ' ' + rest : '');
  };

  const validateFirstName = (v) => v.trim() ? '' : 'First name is required.';
  const validateLastName = (v) => v.trim() ? '' : 'Last name is required.';
  const validateEmail = (v) => {
    const t = v.trim();
    if (!t) return 'Email is required.';
    return emailRx.test(t) ? '' : 'Enter a valid email.';
  };
  const validatePhone = (v) => {
    const t = v.trim();
    if (!t) return 'Phone is required.';
    return phoneDigits(t) >= 7 ? '' : 'Enter a valid phone.';
  };
  const validateTask = (v) => v.trim() ? '' : 'Tell us what you’re avoiding.';

  const validateWorth = (v) => {
    if (!v.trim()) return 'Please enter a dollar amount.';
    const num = parseFloat(v);
    if (isNaN(num) || num < 0) return 'Enter a valid non-negative number.';
    return '';
  };


  // live validity
  const firstNameError = validateFirstName(firstName);
  const lastNameError = validateLastName(lastName);
  const emailError = validateEmail(email);
  const phoneError = validatePhone(phone);
  const taskError = validateTask(submission);
  const worthError = validateWorth(worth);
  const isTooLong = submission.length > MAX_LEN;
  // showRemaining removed (unused)

  const formValid = !firstNameError && !lastNameError && !emailError && !phoneError && !taskError && !isTooLong && !worthError;

  // blur handlers to show sticky messages
  const onBlurFirstName = () => setFirstNameErr(validateFirstName(firstName));
  const onBlurLastName = () => setLastNameErr(validateLastName(lastName));
  const onBlurEmail = () => setEmailErr(validateEmail(email));
  const onBlurPhone = () => setPhoneErr(validatePhone(phone));
  const onBlurTask = () => setTaskErr(validateTask(submission));

  const onSubmit = async (e) => {
    e.preventDefault();

    // final check
    const nErr = validateFirstName(firstName);
    const lErr = validateLastName(lastName);
    const eErr = validateEmail(email);
    const pErr = validatePhone(phone);
    const tErr = validateTask(submission);
    const wErr = validateWorth(worth);
    setFirstNameErr(nErr); setLastNameErr(lErr); setEmailErr(eErr); setPhoneErr(pErr); setTaskErr(tErr); setWorthErr(wErr);
    if (nErr || lErr || eErr || pErr || tErr || isTooLong || isSending || wErr) return;

    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // keep a friendly combined name but also send camelCase fields the server expects
          name: (`${firstName} ${lastName}`).trim(),
          firstname: firstName.trim(),
          lastname: lastName.trim(),
          task: submission.trim(),
          email: email.trim(),
          phone: phone.trim(),
          worth: worth.trim(), 
        }),
      });
      if (!res.ok) throw new Error('Failed to submit. Please try again in a moment.');
      setSubmitted(true);
      setSubmission(''); setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setWorth('');
      setFirstNameErr(''); setLastNameErr(''); setEmailErr(''); setPhoneErr(''); setTaskErr(''); setWorthErr('');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // build a safe mailto href for the Share button (use try/catch because window might be missing briefly)
  const mailtoHref = (() => {
    try {
      const subject = "I found this great site to stop avoiding things and just get it done";
      const body = `Hi!

I just discovered this great site called www.WhatAreYouAvoiding.com.

You just enter the task you’ve been putting off and they help you get it done.

It was super easy to use. You should check it out.`;
      return `mailto:${encodeURIComponent(friendEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } catch {
      return `mailto:${encodeURIComponent(friendEmail || '')}`;
    }
  })();

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4">
      {/* fixed top-right light switch */}
      <button
        type="button"
        onClick={toggleDarkMode}
        role="switch"
        aria-checked={darkMode}
        aria-label="Toggle color theme"
        className="theme-toggle"
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="theme-toggle__mark theme-toggle__mark--sun" />
        <span className="theme-toggle__mark theme-toggle__mark--moon" />
        <span className="theme-toggle__thumb">
          <svg className="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07 6.07l-1.41-1.41M6.34 6.34 4.93 4.93m12.73 0-1.41 1.41M6.34 17.66l-1.41 1.41" />
          </svg>
          <svg className="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
          </svg>
        </span>
      </button>

      {/* Card */}
      <section aria-labelledby={pageTitleId} className="relative max-w-xl w-full rounded-2xl card">
        <header className="p-8 text-center">
          <h1 id={pageTitleId} className="text-3xl font-bold">What Task Are You Avoiding?</h1>
          <h2 className="mt-2 text-xl font-bold">We're gonna help you knock it out.</h2>
        </header>

        <div className="p-8">
          {!submitted ? (
            <form className="space-y-4" onSubmit={onSubmit} noValidate>

              <label htmlFor={textareaId} className="sr-only">Describe the task you're avoiding</label>
              <textarea
                id={textareaId}
                name="task"
                placeholder={`What is the one thing you need help getting off your “to do” list?\n\nIf you also tell us why you’ve been avoiding it, we’ll make sure our solution accounts for that. No judgement.`}
                className="w-full rounded-xl p-3 min-h-[160px]"
                style={{ background: 'var(--background-contrast)', color: 'var(--foreground)', border: `1px solid ${taskErr ? '#ef4444' : 'var(--border-color)'}` }}
                value={submission}
                onChange={(e) => { setSubmission(e.target.value); if (taskErr) setTaskErr(''); }}
                onBlur={onBlurTask}
                aria-invalid={!!taskErr}
                aria-describedby={taskErr ? `${textareaId}-err` : undefined}
                maxLength={MAX_LEN}
              />
              {taskErr && <p id={`${textareaId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{taskErr}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="worth" className="block text-sm font-medium mb-1">
                    What’s the value to you of finally getting this into the Done column?
                  </label>
                  <div className="flex items-center">
                    <span className="mr-2">$</span>
                    <input
                      id={worthId}
                      name="worth"
                      type="number"
                      required
                      min="0"
                      step="1"
                      placeholder="e.g. 50"
                      value={worth}
                      onChange={(e) => { setWorth(e.target.value); if (worthErr) setWorthErr(''); }}
                      onBlur={() => setWorthErr(validateWorth(worth))}
                      className="w-32 rounded-xl p-3"
                      style={{
                        background: 'var(--background-contrast)',
                        color: 'var(--foreground)',
                        border: `1px solid ${worthErr ? '#ef4444' : 'var(--border-color)'}`,
                      }}
                    />
                  </div>
                  {/* <p className="text-xs text-gray-500 mt-1">
                    Please provide a rough estimate. Ranges are okay (e.g., 0, 25, 100+). This helps us prioritize solutions.
                  </p> */}
                  {worthErr && <p id={`${worthId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{worthErr}</p>}
                </div>

                {/* <div className="text-sm space-y-1">
                  <p className="font-semibold mb-1">Examples:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>$0 — Doesn’t really bother me</li>
                    <li>$5 — Just nice to have done</li>
                    <li>$20 — Would save me stress</li>
                    <li>$100 — Really important to me</li>
                    <li>$500+ — Huge relief</li>
                  </ul>
                </div> */}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={firstNameId} className="sr-only">First Name</label>
                  <input
                    id={firstNameId}
                    name="firstName"
                    type="text"
                    placeholder="First Name"
                    required
                    className="w-full rounded-xl p-3"
                    style={{
                      background: 'var(--background-contrast)',
                      color: 'var(--foreground)',
                      border: `1px solid ${firstNameErr ? '#ef4444' : 'var(--border-color)'}`,
                    }}
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); if (firstNameErr) setFirstNameErr(''); }}
                    onBlur={onBlurFirstName}
                    aria-invalid={!!firstNameErr}
                    aria-describedby={firstNameErr ? `${firstNameId}-err` : undefined}
                    autoComplete="given-name"
                  />
                  {firstNameErr && <p id={`${firstNameId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{firstNameErr}</p>}
                </div>

                <div>
                  <label htmlFor={lastNameId} className="sr-only">Last Name</label>
                  <input
                    id={lastNameId}
                    name="lastName"
                    type="text"
                    placeholder="Last Name"
                    required
                    className="w-full rounded-xl p-3"
                    style={{
                      background: 'var(--background-contrast)',
                      color: 'var(--foreground)',
                      border: `1px solid ${lastNameErr ? '#ef4444' : 'var(--border-color)'}`,
                    }}
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); if (lastNameErr) setLastNameErr(''); }}
                    onBlur={onBlurLastName}
                    aria-invalid={!!lastNameErr}
                    aria-describedby={lastNameErr ? `${lastNameId}-err` : undefined}
                    autoComplete="family-name"
                  />
                  {lastNameErr && <p id={`${lastNameId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{lastNameErr}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={emailId} className="sr-only">Email</label>
                  <input
                    id={emailId}
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full rounded-xl p-3"
                    style={{
                      background: 'var(--background-contrast)',
                      color: 'var(--foreground)',
                      border: `1px solid ${emailErr ? '#ef4444' : 'var(--border-color)'}`,
                    }}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(''); }}
                    onBlur={onBlurEmail}
                    aria-invalid={!!emailErr}
                    aria-describedby={emailErr ? `${emailId}-err` : undefined}
                    autoComplete="email"
                    inputMode="email"
                  />
                  {emailErr && <p id={`${emailId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{emailErr}</p>}
                </div>

                <div>
                  <label htmlFor={phoneId} className="sr-only">Phone</label>
                  <input
                    id={phoneId}
                    name="phone"
                    type="tel"
                    placeholder="Phone"
                    required
                    className="w-full rounded-xl p-3"
                    style={{
                      background: 'var(--background-contrast)',
                      color: 'var(--foreground)',
                      border: `1px solid ${phoneErr ? '#ef4444' : 'var(--border-color)'}`,
                    }}
                    value={phone}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const formatted = formatUSPhone(raw);
                      setPhone(formatted);
                      if (phoneErr) setPhoneErr('');
                    }}
                    onBlur={() => {
                      setPhone(formatUSPhone(phone));
                      onBlurPhone();
                    }}
                    aria-invalid={!!phoneErr}
                    aria-describedby={phoneErr ? `${phoneId}-err` : undefined}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  {phoneErr && <p id={`${phoneId}-err`} className="mt-1 text-xs" style={{ color: '#ef4444' }}>{phoneErr}</p>}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm" style={{ color: '#ef4444' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full mt-2 inline-flex text-xl items-center justify-center rounded-xl h-11 px-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--button-bg)',
                  color: 'var(--button-fg)',
                  boxShadow: 'var(--shadow-elevated)',
                }}
                disabled={!formValid || isSending}
                aria-busy={isSending}
              >
                {isSending ? 'Sending…' : 'Help Me Get It Done'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold" style={{ color: '#16a34a' }}>
                🎉 Got it! We’ll get back to you shortly with solutions.
              </p>
              <p className="text-sm muted">
                Want to be first in line? Share this site with a friend who's also avoiding something.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <input
                  type="email"
                  placeholder="Friend's email (optional)"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  className="w-full sm:w-64 rounded-xl p-3 text-sm"
                  style={{ background: 'var(--background-contrast)', color: 'var(--foreground)', border: '1px solid var(--border-color)' }}
                />

                <a
                  href={mailtoHref}
                  onClick={() => { /* mailto will open mail client */ }}
                  className="inline-flex items-center justify-center rounded-xl text-sm font-medium shadow-sm transition px-4 h-11"
                  style={{ background: 'var(--overlay)', color: 'var(--foreground)', border: '1px solid var(--border-color)' }}
                >
                  Share
                </a>

                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl text-sm font-medium shadow-sm transition px-4 h-11"
                  style={{ background: 'var(--overlay)', color: 'var(--foreground)', border: '1px solid var(--border-color)' }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copied ? 'Copied ✅' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
