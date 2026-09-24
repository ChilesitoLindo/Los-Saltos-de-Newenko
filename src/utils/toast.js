// ============================================================
// toast.js — único mecanismo de notación flotante (mensaje
// humano, sin alert()). Lo usan GPX y otras acciones puntuales.
// ============================================================
let current = null;

export function showToast(message, kind = 'ok') {
  if (!message) return null;
  if (current && current.parentNode) current.remove();

  const el = document.createElement('div');
  el.className = `toast toast--${kind === 'error' ? 'error' : 'ok'}`;
  el.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = kind === 'error' ? 'error' : 'check_circle';

  const text = document.createElement('span');
  text.textContent = message; // texto plano, escapado por construcción

  el.append(icon, text);
  document.body.appendChild(el);
  current = el;

  requestAnimationFrame(() => el.classList.add('toast--show'));
  setTimeout(() => {
    el.classList.remove('toast--show');
    setTimeout(() => {
      if (el.parentNode) el.remove();
      if (current === el) current = null;
    }, 320);
  }, 3200);

  return el;
}

export const toast = { show: showToast };
