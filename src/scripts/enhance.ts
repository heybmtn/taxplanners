// Progressive enhancement only: every feature works without this script.
document.documentElement.classList.add('js');

// 1. Invoker commands (commandfor/command) for browsers without native support.
if (!('command' in HTMLButtonElement.prototype)) {
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button[commandfor]');
    if (!btn) return;
    const target = document.getElementById(btn.getAttribute('commandfor') ?? '');
    if (!(target instanceof HTMLDialogElement)) return;
    const cmd = btn.getAttribute('command');
    if (cmd === 'show-modal' && !target.open) target.showModal();
    if (cmd === 'close') target.close();
  });
}

// 2. Filters: on wide screens, apply as soon as a filter changes.
const filterForm = document.querySelector<HTMLFormElement>('#search-form');
const wide = window.matchMedia('(min-width: 64rem)');
filterForm?.querySelector('#filters')?.addEventListener('change', () => {
  if (wide.matches) filterForm.requestSubmit();
});

// 3. Multi-step form wizard.
const wizard = document.querySelector<HTMLFormElement>('form.wizard');
if (wizard) {
  const steps = [...wizard.querySelectorAll<HTMLElement>('.wizard-step')];
  const markers = [...document.querySelectorAll<HTMLElement>('.stepper [data-step]')];
  const status = document.getElementById('step-status');
  let current = 0;

  const show = (i: number, focus = true) => {
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, n) => (s.hidden = n !== current));
    markers.forEach((m, n) => {
      if (n === current) m.setAttribute('aria-current', 'step');
      else m.removeAttribute('aria-current');
      m.classList.toggle('done', n < current);
    });
    if (status) status.textContent = `Step ${current + 1} of ${steps.length}: ${steps[current].dataset.title ?? ''}`;
    if (focus) steps[current].querySelector<HTMLElement>('h2')?.focus();
  };

  const validStep = (i: number) => {
    for (const el of [...steps[i].querySelectorAll('input, select, textarea')] as HTMLInputElement[]) {
      if (!el.checkValidity()) {
        el.closest('details')?.setAttribute('open', '');
        el.reportValidity();
        el.setAttribute('aria-invalid', 'true');
        el.focus();
        return false;
      }
      el.removeAttribute('aria-invalid');
    }
    return true;
  };

  wizard.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-next], [data-back]');
    if (!btn) return;
    e.preventDefault();
    if (btn.hasAttribute('data-back')) show(current - 1);
    else if (validStep(current)) show(current + 1);
  });
  markers.forEach((m, n) =>
    m.addEventListener('click', (e) => {
      e.preventDefault();
      if (n < current || steps.slice(current, n).every((_, k) => validStep(current + k))) show(n);
    }),
  );
  wizard.addEventListener('input', (e) => (e.target as Element).removeAttribute('aria-invalid'));
  wizard.addEventListener('invalid', (e) => {
    const i = steps.findIndex((s) => s.contains(e.target as Node));
    if (i >= 0 && i !== current) show(i, false);
  }, true);
  show(0, false);
}

// 4. Forms that post: prevent double submits and show progress.
document.querySelectorAll<HTMLFormElement>('form[method="post"]').forEach((form) =>
  form.addEventListener('submit', (e) => {
    if (form.dataset.sent) return e.preventDefault();
    form.dataset.sent = '1';
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (btn) {
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';
    }
  }),
);

// 5. Search forms: leave empty fields out of the URL (cleaner, shareable links).
document.querySelectorAll<HTMLFormElement>('form[role="search"]').forEach((form) =>
  form.addEventListener('submit', () => {
    const empty = ([...form.querySelectorAll('input, select')] as HTMLInputElement[]).filter((el) => el.name && el.value === '' && !el.disabled);
    empty.forEach((el) => (el.disabled = true));
    setTimeout(() => empty.forEach((el) => (el.disabled = false)));
  }),
);
