
(() => {
  const API = 'https://vliqyzpwdlowmldsimom.supabase.co';
  const KEY = 'sb_publishable_2HcppiXu5sfoP7_i6aQe7Q_OxAmhf7M';
  const $ = id => document.getElementById(id);

  let session = null;
  let sending = false;
  let lastRun = '';

  const authHeaders = {
    apikey: KEY,
    'Content-Type': 'application/json'
  };

  function showAuth(message) {
    const el = $('authMessage');
    if (el) el.textContent = message;
  }

  async function request(path, options = {}, token = KEY) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...authHeaders,
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.msg || data?.message || data?.error_description || data?.hint || 'Ошибка запроса');
    }
    return data;
  }

  function saveSession(data) {
    session = data;
    if (data) {
      localStorage.setItem('cosmoAuthSession', JSON.stringify(data));
      localStorage.setItem('cosmoNick', '');
    } else {
      localStorage.removeItem('cosmoAuthSession');
    }
    updateAuthUI();
  }

  function updateAuthUI() {
    const loggedIn = Boolean(session?.access_token);
    const email = $('authEmail');
    const password = $('authPassword');
    const login = $('loginBtn');
    const register = $('registerBtn');

    if (email) email.disabled = loggedIn;
    if (password) password.disabled = loggedIn;
    if (login) login.textContent = loggedIn ? 'ВЫЙТИ' : 'ВОЙТИ';
    if (register) register.style.display = loggedIn ? 'none' : '';

    if (loggedIn) {
      showAuth(`Вход выполнен: ${session.user?.email || 'аккаунт'}`);
    }
  }

  async function getProfile(userId, token) {
    const rows = await request(
      `/rest/v1/profiles?select=id,player_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
      {},
      token
    );
    return rows?.[0] || null;
  }

  async function register() {
    const email = ($('authEmail')?.value || '').trim();
    const password = $('authPassword')?.value || '';
    const name = ($('nickname')?.value || '').trim().replace(/[<>]/g, '').slice(0, 16);

    if (!email || password.length < 6 || !name) {
      showAuth('Введи ник, почту и пароль минимум из 6 символов.');
      return;
    }

    try {
      showAuth('Создаём аккаунт…');

      const result = await request('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, data: { player_name: name } })
      });

      if (!result?.access_token || !result?.user) {
        showAuth('Аккаунт создан. Подтверди почту по письму, затем войди.');
        return;
      }

      const token = result.access_token;
      await request('/rest/v1/profiles', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ id: result.user.id, player_name: name })
      }, token);

      saveSession(result);
      $('nickname').value = name;
      showAuth('Регистрация успешна!');
    } catch (error) {
      showAuth(`Не удалось зарегистрироваться: ${error.message}`);
    }
  }

  async function login() {
    if (session?.access_token) {
      saveSession(null);
      showAuth('Ты вышел из аккаунта.');
      return;
    }

    const email = ($('authEmail')?.value || '').trim();
    const password = $('authPassword')?.value || '';

    if (!email || !password) {
      showAuth('Введи электронную почту и пароль.');
      return;
    }

    try {
      showAuth('Выполняется вход…');

      const result = await request('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      const profile = await getProfile(result.user.id, result.access_token);
      if (!profile) {
        showAuth('Профиль не найден. Напиши нам, чтобы разобраться.');
        return;
      }

      saveSession(result);
      $('nickname').value = profile.player_name;
      localStorage.setItem('cosmoNick', profile.player_name);
      showAuth(`Привет, ${profile.player_name}!`);
    } catch (error) {
      showAuth(`Не удалось войти: ${error.message}`);
    }
  }

  async function loadOnlineScores() {
    const board = $('leaderboard');
    if (!board) return;

    board.innerHTML = '<div class="empty">Загружаем рейтинг…</div>';

    try {
      const rows = await request(
        '/rest/v1/scores?select=player_name,score,user_id&order=score.desc&limit=200'
      );

      const best = new Map();
      for (const row of rows || []) {
        const key = row.user_id || `legacy:${String(row.player_name).toLowerCase()}`;
        if (!best.has(key) || row.score > best.get(key).score) {
          best.set(key, { name: row.player_name, score: row.score, user_id: row.user_id });
        }
      }

      const top = [...best.values()]
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      board.innerHTML = top.length
        ? top.map((row, index) => `
          <div class="leader-row">
            <div class="rank">${String(index + 1).padStart(2, '0')}</div>
            <div class="player">${escapeText(row.name)}</div>
            <div class="points">${row.score} ✦</div>
          </div>`).join('')
        : '<div class="empty">Пока нет результатов. Сыграй первый раунд!</div>';
    } catch (error) {
      board.innerHTML = '<div class="empty">Не удалось загрузить онлайн-рейтинг.</div>';
      console.error('Cosmo-Blob rating:', error);
    }
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  async function submitScore() {
    if (sending || !session?.access_token || !session.user?.id) {
      if (!session?.access_token) showAuth('Чтобы сохранить рекорд, сначала войди в аккаунт.');
      return;
    }

    const score = Number($('finalScore')?.textContent);
    if (!Number.isInteger(score) || score < 0 || score > 100000) return;

    const runId = `${session.user.id}:${score}:${Date.now()}`;
    if (runId === lastRun) return;
    lastRun = runId;
    sending = true;

    try {
      const profile = await getProfile(session.user.id, session.access_token);
      if (!profile) throw new Error('Профиль не найден');

      await request('/rest/v1/scores', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          player_name: profile.player_name,
          score,
          user_id: session.user.id
        })
      }, session.access_token);

      loadOnlineScores();
    } catch (error) {
      console.error('Cosmo-Blob score submission:', error);
      showAuth(`Не удалось сохранить рекорд: ${error.message}`);
    } finally {
      sending = false;
    }
  }

  $('registerBtn')?.addEventListener('click', register);
  $('loginBtn')?.addEventListener('click', login);

  $('ratingBtn')?.addEventListener('click', () => setTimeout(loadOnlineScores, 100));
  $('overRatingBtn')?.addEventListener('click', () => setTimeout(loadOnlineScores, 100));

  try {
    const saved = JSON.parse(localStorage.getItem('cosmoAuthSession') || 'null');
    if (saved?.access_token && saved?.user) {
      session = saved;
      updateAuthUI();
      getProfile(saved.user.id, saved.access_token)
        .then(profile => {
          if (profile && $('nickname')) $('nickname').value = profile.player_name;
        })
        .catch(() => {});
    }
  } catch (_) {}

  const overScreen = $('over');
  if (overScreen) {
    let wasVisible = !overScreen.classList.contains('hidden');
    new MutationObserver(() => {
      const visible = !overScreen.classList.contains('hidden');
      if (visible && !wasVisible) submitScore();
      wasVisible = visible;
    }).observe(overScreen, { attributes: true, attributeFilter: ['class'] });
  }

  console.log('Cosmo-Blob online module loaded');
})();
