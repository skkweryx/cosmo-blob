
(() => {
  const API = 'https://vliqyzpwdlowmldsimom.supabase.co';
  const KEY = 'sb_publishable_2HcppiXu5sfoP7_i6aQe7Q_OxAmhf7M';

  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json'
  };

  let lastRun = '';
  let sending = false;

  async function loadOnlineScores() {
    const board = document.getElementById('leaderboard');
    if (!board) return;

    board.innerHTML = '<div class="empty">Загружаем рейтинг…</div>';

    try {
      const response = await fetch(
        `${API}/rest/v1/scores?select=player_name,score&order=score.desc&limit=100`,
        { headers }
      );

      if (!response.ok) throw new Error('Не удалось загрузить рейтинг');

      const rows = await response.json();
      const best = new Map();

      for (const row of rows) {
        const name = String(row.player_name || '').slice(0, 20);
        if (!name) continue;

        const key = name.toLowerCase();
        if (!best.has(key) || row.score > best.get(key).score) {
          best.set(key, { name, score: row.score });
        }
      }

      const top = [...best.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      board.innerHTML = top.length
        ? top.map((r, i) =>
          `<div class="leader-row">
            <div class="rank">${String(i + 1).padStart(2, '0')}</div>
            <div class="player">${escapeText(r.name)}</div>
            <div class="points">${r.score} ✦</div>
          </div>`
        ).join('')
        : '<div class="empty">Пока нет результатов. Сыграй первый раунд!</div>';

    } catch (error) {
      board.innerHTML =
        '<div class="empty">Не удалось загрузить онлайн-рейтинг. Проверь подключение и попробуй ещё раз.</div>';
      console.error('Cosmo-Blob rating:', error);
    }
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  async function submitScore() {
    if (sending) return;

    const scoreElement = document.getElementById('finalScore');
    const name = (localStorage.getItem('cosmoNick') || '').trim();
    const score = Number(scoreElement?.textContent);

    if (!name || !Number.isInteger(score) || score < 0 || score > 100000) {
      return;
    }

    const runId = `${name}:${score}:${Date.now()}`;
    if (runId === lastRun) return;
    lastRun = runId;
    sending = true;

    try {
      const response = await fetch(`${API}/rest/v1/scores`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          player_name: name.slice(0, 20),
          score
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.error('Cosmo-Blob score submission:', error);
    } finally {
      sending = false;
    }
  }

  const ratingButton = document.getElementById('ratingBtn');
  const overRatingButton = document.getElementById('overRatingBtn');

  ratingButton?.addEventListener('click', () => {
    setTimeout(loadOnlineScores, 100);
  });

  overRatingButton?.addEventListener('click', () => {
    setTimeout(loadOnlineScores, 100);
  });

  const overScreen = document.getElementById('over');

  if (overScreen) {
    let wasVisible = !overScreen.classList.contains('hidden');

    new MutationObserver(() => {
      const visible = !overScreen.classList.contains('hidden');

      if (visible && !wasVisible) submitScore();
      wasVisible = visible;
    }).observe(overScreen, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  console.log('Cosmo-Blob online module loaded');
})();
