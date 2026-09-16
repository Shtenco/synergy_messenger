/**
 * SYNERGY MESSENGER — UI extras
 * Emoji picker · Reply · Forward · Context menu
 */

export const EMOJI_SET = [
  '😀','😂','🥰','😍','😎','🤔','👍','👎','❤️','🔥',
  '✨','🎉','💯','🙏','👏','💪','🚀','💎','🪙','⚡',
  '🔒','✅','❌','⭐','🌟','💰','📈','📉','🎯','🏆',
  '😊','🥲','😅','😭','😡','🤝','👋','🫡','🫡','👀',
  '💬','📎','🎤','📷','🗂','⏰','📍','🔔','🌙','☀️'
];

export function createEmojiPicker(onSelect) {
  const el = document.createElement('div');
  el.className = 'emoji-picker';
  el.innerHTML = EMOJI_SET.map(e => `<button type="button" class="emoji-btn">${e}</button>`).join('');
  el.addEventListener('click', e => {
    const btn = e.target.closest('.emoji-btn');
    if (btn) onSelect(btn.textContent);
  });
  return el;
}

export function showContextMenu(x, y, items) {
  document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - items.length * 44 - 20) + 'px';
  menu.innerHTML = items.map(it =>
    `<button type="button" data-action="${it.action}" ${it.danger ? 'class="danger"' : ''}>${it.icon || ''} ${it.label}</button>`
  ).join('');
  document.body.appendChild(menu);

  const close = () => {
    menu.remove();
    document.removeEventListener('click', close);
  };
  setTimeout(() => document.addEventListener('click', close), 10);

  return new Promise(resolve => {
    menu.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        resolve(btn.dataset.action);
        close();
      }
    });
  });
}

export function formatReplyPreview(msg) {
  if (!msg) return null;
  const text = msg.type === 'voice' ? '🎤 Голосовое' :
               msg.type === 'crypto' ? `◈ ${msg.amount} ${msg.asset || 'USDT'}` :
               (msg.text || '').slice(0, 80);
  return { from: msg.out ? 'Вы' : 'Собеседник', text };
}
