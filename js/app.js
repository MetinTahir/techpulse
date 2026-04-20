(function () {
  'use strict';

  // ===================== STATE =====================
  const state = {
    page: 'home',
    theme: localStorage.getItem('tp_theme') || 'dark',
    favorites: JSON.parse(localStorage.getItem('tp_favs') || '[]'),
    cache: {},
    charts: {}
  };

  // ===================== THEME =====================
  const Theme = {
    init() {
      document.documentElement.setAttribute('data-theme', state.theme);
      this.updateIcon();
    },
    toggle() {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('tp_theme', state.theme);
      this.updateIcon();
      this.updateCharts();
    },
    updateIcon() {
      const btn = document.getElementById('themeToggle');
      if (btn) btn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
    },
    updateCharts() {
      Object.values(state.charts).forEach(chart => {
        if (chart) {
          const color = state.theme === 'dark' ? '#8892b0' : '#4a5568';
          if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
              if (scale.ticks) scale.ticks.color = color;
              if (scale.grid) scale.grid.color = state.theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
            });
          }
          chart.update();
        }
      });
    }
  };

  // ===================== TOAST =====================
  const Toast = {
    show(msg, type = 'info', duration = 3000) {
      const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
      const container = document.getElementById('toastContainer');
      if (!container) return;
      container.appendChild(el);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 300);
      }, duration);
    }
  };

  // ===================== FAVORITES =====================
  const Favs = {
    save() { localStorage.setItem('tp_favs', JSON.stringify(state.favorites)); },
    add(item) {
      if (!this.has(item.id)) {
        state.favorites.push(item);
        this.save();
        this.updateBadge();
        Toast.show('Favorilere eklendi!', 'success');
      }
    },
    remove(id) {
      state.favorites = state.favorites.filter(f => f.id !== id);
      this.save();
      this.updateBadge();
      Toast.show('Favorilerden çıkarıldı', 'info');
    },
    toggle(item) { this.has(item.id) ? this.remove(item.id) : this.add(item); },
    has(id) { return state.favorites.some(f => f.id === id); },
    updateBadge() {
      const badge = document.getElementById('favBadge');
      if (badge) {
        badge.textContent = state.favorites.length;
        badge.classList.toggle('hidden', state.favorites.length === 0);
      }
    }
  };

  // ===================== API =====================
  const API = {
    async fetch(url, opts = {}) {
      if (state.cache[url]) return state.cache[url];
      try {
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.cache[url] = data;
        return data;
      } catch (e) {
        console.error('API error:', e);
        throw e;
      }
    },

    async hnTopStories(type = 'topstories') {
      const ids = await this.fetch(`https://hacker-news.firebaseio.com/v0/${type}.json`);
      const top = ids.slice(0, 30);
      const stories = await Promise.all(
        top.map(id => this.fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
      );
      return stories.filter(s => s && s.title);
    },

    async ghTrending(lang = '', since = 'weekly') {
      const date = new Date();
      date.setDate(date.getDate() - (since === 'daily' ? 1 : since === 'weekly' ? 7 : 30));
      const d = date.toISOString().split('T')[0];
      const q = lang ? `language:${lang} created:>${d}` : `created:>${d} stars:>10`;
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=24`;
      const data = await this.fetch(url);
      return data.items || [];
    },

    async ghUser(username) {
      return this.fetch(`https://api.github.com/users/${username}`);
    },

    async ghUserRepos(username) {
      return this.fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=6`);
    },

    async devtoArticles(tag = '', page = 1) {
      const url = tag
        ? `https://dev.to/api/articles?tag=${tag}&per_page=20&page=${page}`
        : `https://dev.to/api/articles?per_page=20&page=${page}&top=7`;
      return this.fetch(url);
    }
  };

  // ===================== SKELETON =====================
  const Skel = {
    cards(count = 6, hasImg = false) {
      return Array.from({ length: count }, () => `
        <div class="skeleton-card">
          ${hasImg ? '<div class="skeleton sk-img"></div>' : ''}
          <div class="card-body">
            <div class="skeleton sk-line medium"></div>
            <div class="skeleton sk-line full"></div>
            <div class="skeleton sk-line full"></div>
            <div class="skeleton sk-line short"></div>
          </div>
        </div>`).join('');
    }
  };

  // ===================== HELPERS =====================
  function timeAgo(ts) {
    const now = Date.now() / 1000;
    const diff = now - ts;
    if (diff < 3600) return `${Math.floor(diff / 60)}d önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}s önce`;
    return `${Math.floor(diff / 86400)}g önce`;
  }

  function numFmt(n) {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function getDomain(url) {
    if (!url) return '';
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  }

  function langColor(lang) {
    const map = {
      JavaScript: '#f0db4f', TypeScript: '#3178c6', Python: '#3572a5',
      Go: '#00add8', Rust: '#dea584', Java: '#b07219', Ruby: '#701516',
      'C++': '#f34b7d', C: '#555', Swift: '#f05138', Kotlin: '#a97bff',
      PHP: '#4F5D95', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c',
      Dart: '#00B4AB', Vue: '#41b883', Scala: '#c22d40'
    };
    return map[lang] || '#8892b0';
  }

  // ===================== CHART HELPERS =====================
  function destroyChart(id) {
    if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
  }

  function chartDefaults() {
    const isDark = state.theme === 'dark';
    return {
      textColor: isDark ? '#8892b0' : '#4a5568',
      gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
    };
  }

  // ===================== PAGES =====================

  // ----------- HOME -----------
  async function renderHome() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <section class="hero">
        <div class="hero-bg"></div>
        <div class="hero-particles" id="heroParticles"></div>
        <div class="hero-content">
          <div class="hero-badge"><span class="live-dot"></span> Canlı Veri • Güncel Haberler</div>
          <h1 class="hero-title">Teknoloji Dünyasını<br><span class="gradient-text">Keşfedin</span></h1>
          <p class="hero-description">HackerNews haberleri, GitHub trend repoları, Dev.to makaleleri ve daha fazlası. Tek platformda, gerçek zamanlı.</p>
          <div class="hero-actions">
            <a href="#/news" class="btn btn-primary">📰 Haberlere Git</a>
            <a href="#/repos" class="btn btn-outline">💻 Trend Repolar</a>
          </div>
        </div>
      </section>

      <section class="stats-bar">
        <div class="stats-container">
          <div class="stats-grid">
            <div class="stat-card" style="animation-delay:0.1s">
              <div class="stat-icon">📰</div>
              <div class="stat-number" data-target="500">0</div>
              <div class="stat-label">Günlük Haber</div>
            </div>
            <div class="stat-card" style="animation-delay:0.2s">
              <div class="stat-icon">⭐</div>
              <div class="stat-number" data-target="1200">0</div>
              <div class="stat-label">GitHub Reposu</div>
            </div>
            <div class="stat-card" style="animation-delay:0.3s">
              <div class="stat-icon">✍️</div>
              <div class="stat-number" data-target="3000">0</div>
              <div class="stat-label">Makale</div>
            </div>
            <div class="stat-card" style="animation-delay:0.4s">
              <div class="stat-icon">👨‍💻</div>
              <div class="stat-number" data-target="10">0</div>
              <div class="stat-label">Programlama Dili</div>
            </div>
          </div>
        </div>
      </section>

      <section class="profile-section">
        <div class="profile-wrapper">
          <div class="profile-card gradient-border">
            <div class="profile-avatar-ring">
              <div class="profile-avatar-bg">
                <span class="profile-monogram">MT</span>
              </div>
              <div class="profile-status-dot"></div>
            </div>
            <div class="profile-info">
              <div class="profile-badge-row">
                <span class="profile-role-badge">🎓 Öğrenci</span>
                <span class="profile-open-badge">💼 Staja Açık</span>
              </div>
              <h2 class="profile-name">Metin Tahir Tiryakioğlu</h2>
              <p class="profile-department">Bilgisayar Mühendisliği Öğrencisi</p>
              <p class="profile-bio">
                Teknoloji ve yazılıma meraklı bir öğrenciyim. Web geliştirme, açık kaynak projeler ve yapay zeka alanlarında kendimi geliştiriyorum. Yeni teknolojileri öğrenmek ve projeler üretmek benim için bir tutku.
              </p>
              <div class="profile-skills">
                <span class="skill-tag">JavaScript</span>
                <span class="skill-tag">Python</span>
                <span class="skill-tag">React</span>
                <span class="skill-tag">Node.js</span>
                <span class="skill-tag">Git</span>
              </div>
              <div class="profile-actions">
                <a href="https://github.com" target="_blank" rel="noopener" class="btn btn-primary" style="padding:10px 22px;font-size:0.9rem;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub Profilim
                </a>
                <a href="mailto:tahirmetin61@gmail.com" class="btn btn-outline" style="padding:10px 22px;font-size:0.9rem;">✉️ İletişim</a>
              </div>
            </div>
          </div>
          <div class="profile-stats-panel">
            <div class="pstat-card">
              <div class="pstat-icon">🚀</div>
              <div class="pstat-num">12</div>
              <div class="pstat-label">Proje</div>
            </div>
            <div class="pstat-card">
              <div class="pstat-icon">⭐</div>
              <div class="pstat-num">48</div>
              <div class="pstat-label">Star</div>
            </div>
            <div class="pstat-card">
              <div class="pstat-icon">🍴</div>
              <div class="pstat-num">7</div>
              <div class="pstat-label">Fork</div>
            </div>
            <div class="pstat-card">
              <div class="pstat-icon">📅</div>
              <div class="pstat-num">2yıl</div>
              <div class="pstat-label">Deneyim</div>
            </div>
          </div>
        </div>
      </section>

      <div class="chart-section">
        <div class="section" style="padding-bottom:0">
          <div class="section-header">
            <h2 class="section-title"><span>📊</span> Canlı İstatistikler</h2>
            <div class="live-indicator"><span class="live-dot"></span> Canlı</div>
          </div>
        </div>
        <div style="padding: 0 24px 60px; max-width: 1400px; margin: 0 auto;">
          <div class="chart-grid" id="chartGrid">
            <div class="chart-card">
              <div class="chart-title">🔥 En Çok Oylanan HackerNews Haberleri</div>
              <div class="chart-wrapper"><canvas id="hnChart"></canvas></div>
            </div>
            <div class="chart-card">
              <div class="chart-title">💻 Trend Dillerin Dağılımı</div>
              <div class="chart-wrapper"><canvas id="langChart"></canvas></div>
            </div>
          </div>
        </div>
      </div>

      <div class="features-grid">
        <div class="feature-card" style="animation-delay:0.1s">
          <div class="feature-icon">📰</div>
          <div class="feature-title">HackerNews Haberleri</div>
          <div class="feature-desc">Top, yeni, en iyi, iş ve Show HN haberleri, kategori filtresiyle.</div>
        </div>
        <div class="feature-card" style="animation-delay:0.2s">
          <div class="feature-icon">💻</div>
          <div class="feature-title">GitHub Trend Repolar</div>
          <div class="feature-desc">Dile ve periyoda göre filtrelenmiş en popüler repolar.</div>
        </div>
        <div class="feature-card" style="animation-delay:0.3s">
          <div class="feature-icon">🔍</div>
          <div class="feature-title">GitHub Kullanıcı Arama</div>
          <div class="feature-desc">GitHub kullanıcılarını ara, profil ve repolarını incele.</div>
        </div>
        <div class="feature-card" style="animation-delay:0.4s">
          <div class="feature-icon">✍️</div>
          <div class="feature-title">Dev.to Makaleleri</div>
          <div class="feature-desc">Geliştirici topluluğundan en güncel teknik makaleler.</div>
        </div>
        <div class="feature-card" style="animation-delay:0.5s">
          <div class="feature-icon">⭐</div>
          <div class="feature-title">Favoriler</div>
          <div class="feature-desc">Beğendiğin içerikleri localStorage'a kaydet, her zaman eriş.</div>
        </div>
        <div class="feature-card" style="animation-delay:0.6s">
          <div class="feature-icon">🌓</div>
          <div class="feature-title">Karanlık / Aydınlık Mod</div>
          <div class="feature-desc">Göz yorgunluğunu azalt, istediğin temayı seç.</div>
        </div>
      </div>`;

    createParticles();
    animateCounters();
    loadHomeCharts();
  }

  function createParticles() {
    const container = document.getElementById('heroParticles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 6 + 2;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random() * 100}%;
        animation-duration:${Math.random() * 15 + 8}s;
        animation-delay:${Math.random() * 10}s;
        --drift:${(Math.random() - 0.5) * 200}px;
        opacity:${Math.random() * 0.6 + 0.2};
      `;
      container.appendChild(p);
    }
  }

  function animateCounters() {
    document.querySelectorAll('[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target);
      let current = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = numFmt(Math.floor(current));
        if (current >= target) clearInterval(timer);
      }, 25);
    });
  }

  async function loadHomeCharts() {
    try {
      const [stories, repos] = await Promise.all([
        API.hnTopStories('topstories'),
        API.ghTrending('', 'weekly')
      ]);

      // HN Chart
      const top5 = stories.slice(0, 8);
      const { textColor, gridColor } = chartDefaults();
      destroyChart('hn');
      const hnCtx = document.getElementById('hnChart');
      if (hnCtx) {
        state.charts['hn'] = new Chart(hnCtx, {
          type: 'bar',
          data: {
            labels: top5.map((s, i) => `#${i + 1} ${s.title.substring(0, 25)}...`),
            datasets: [{
              label: 'Puan',
              data: top5.map(s => s.score),
              backgroundColor: 'rgba(108,99,255,0.7)',
              borderColor: '#6c63ff',
              borderWidth: 1,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor } },
              y: { ticks: { color: textColor }, grid: { color: gridColor } }
            }
          }
        });
      }

      // Language Chart
      const langCount = {};
      repos.forEach(r => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
      const topLangs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
      destroyChart('lang');
      const langCtx = document.getElementById('langChart');
      if (langCtx) {
        state.charts['lang'] = new Chart(langCtx, {
          type: 'doughnut',
          data: {
            labels: topLangs.map(l => l[0]),
            datasets: [{
              data: topLangs.map(l => l[1]),
              backgroundColor: topLangs.map(l => langColor(l[0]) + 'cc'),
              borderColor: topLangs.map(l => langColor(l[0])),
              borderWidth: 2
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, padding: 12 } }
            }
          }
        });
      }
    } catch (e) {
      console.error('Chart error:', e);
    }
  }

  // ----------- NEWS -----------
  async function renderNews() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📰 HackerNews</h1>
        <p class="page-subtitle">Teknoloji dünyasının nabzını tutun</p>
      </div>
      <div class="section">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
          <div class="filters" id="newsFilters">
            <button class="filter-btn active" data-type="topstories">🔥 Top</button>
            <button class="filter-btn" data-type="newstories">🆕 Yeni</button>
            <button class="filter-btn" data-type="beststories">⭐ En İyi</button>
            <button class="filter-btn" data-type="showstories">💡 Show HN</button>
            <button class="filter-btn" data-type="askstories">❓ Ask HN</button>
            <button class="filter-btn" data-type="jobstories">💼 İş</button>
          </div>
          <div class="live-indicator"><span class="live-dot"></span> Canlı</div>
        </div>
        <div id="newsGrid" class="grid">${Skel.cards(9)}</div>
      </div>`;

    document.getElementById('newsFilters').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#newsFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadNews(btn.dataset.type);
    });

    loadNews('topstories');
  }

  async function loadNews(type) {
    const grid = document.getElementById('newsGrid');
    if (!grid) return;
    grid.innerHTML = Skel.cards(9);
    try {
      const stories = await API.hnTopStories(type);
      grid.innerHTML = stories.map((s, i) => `
        <div class="card news-card">
          <div class="card-header">
            <div class="news-rank">${i + 1}</div>
            <div style="flex:1">
              <div class="news-title">
                <a href="${s.url || `https://news.ycombinator.com/item?id=${s.id}`}" target="_blank" rel="noopener">
                  ${s.title}
                </a>
              </div>
              <div class="news-meta">
                <span>🔼 ${s.score || 0}</span>
                <span>💬 ${s.descendants || 0}</span>
                <span>👤 ${s.by}</span>
                <span>🕐 ${timeAgo(s.time)}</span>
                ${s.url ? `<span class="news-domain">${getDomain(s.url)}</span>` : ''}
              </div>
            </div>
            <button class="fav-btn ${Favs.has(s.id) ? 'active' : ''}" onclick="window.__favToggle(${JSON.stringify({ id: s.id, type: 'news', title: s.title, url: s.url || '#', score: s.score, by: s.by }).replace(/"/g, '&quot;')})" title="Favorilere ekle">⭐</button>
          </div>
          <div style="height:16px"></div>
        </div>`).join('');
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Yüklenemedi</div><p>${e.message}</p></div>`;
    }
  }

  // ----------- REPOS -----------
  async function renderRepos() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">💻 GitHub Trend Repolar</h1>
        <p class="page-subtitle">En popüler açık kaynak projeleri keşfedin</p>
      </div>
      <div class="section">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:24px;">
          <div class="filters" id="langFilters">
            <button class="filter-btn active" data-lang="">🌐 Tümü</button>
            <button class="filter-btn" data-lang="JavaScript">JS</button>
            <button class="filter-btn" data-lang="TypeScript">TS</button>
            <button class="filter-btn" data-lang="Python">Python</button>
            <button class="filter-btn" data-lang="Go">Go</button>
            <button class="filter-btn" data-lang="Rust">Rust</button>
            <button class="filter-btn" data-lang="Java">Java</button>
            <button class="filter-btn" data-lang="Swift">Swift</button>
            <button class="filter-btn" data-lang="Kotlin">Kotlin</button>
          </div>
          <div class="filters" id="sinceFilters">
            <button class="filter-btn active" data-since="weekly">📅 Haftalık</button>
            <button class="filter-btn" data-since="daily">📅 Günlük</button>
            <button class="filter-btn" data-since="monthly">📅 Aylık</button>
          </div>
        </div>
        <div id="repoGrid" class="grid">${Skel.cards(9)}</div>
      </div>`;

    let currentLang = '', currentSince = 'weekly';

    document.getElementById('langFilters').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#langFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLang = btn.dataset.lang;
      loadRepos(currentLang, currentSince);
    });

    document.getElementById('sinceFilters').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#sinceFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSince = btn.dataset.since;
      loadRepos(currentLang, currentSince);
    });

    loadRepos('', 'weekly');
  }

  async function loadRepos(lang, since) {
    const grid = document.getElementById('repoGrid');
    if (!grid) return;
    grid.innerHTML = Skel.cards(9);
    try {
      const repos = await API.ghTrending(lang, since);
      if (!repos.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-title">Sonuç bulunamadı</div></div>`;
        return;
      }
      grid.innerHTML = repos.map(r => `
        <div class="card">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <img src="${r.owner.avatar_url}" style="width:28px;height:28px;border-radius:50%" loading="lazy" alt="">
                <span style="font-size:0.8rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.owner.login}</span>
              </div>
              <button class="fav-btn ${Favs.has(r.id) ? 'active' : ''}" onclick="window.__favToggle(${JSON.stringify({ id: r.id, type: 'repo', title: r.full_name, url: r.html_url, stars: r.stargazers_count, lang: r.language }).replace(/"/g, '&quot;')})" title="Favorilere ekle">⭐</button>
            </div>
            <a href="${r.html_url}" target="_blank" rel="noopener" class="repo-name">${r.name}</a>
            <div class="repo-desc">${r.description || 'Açıklama yok'}</div>
            ${r.topics && r.topics.length ? `<div class="repo-tags">${r.topics.slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
            <div class="repo-stats">
              <span class="repo-stat">
                <span class="repo-lang-dot" style="background:${langColor(r.language)}"></span>
                ${r.language || 'N/A'}
              </span>
              <span class="repo-stat">⭐ ${numFmt(r.stargazers_count)}</span>
              <span class="repo-stat">🍴 ${numFmt(r.forks_count)}</span>
              <span class="repo-stat">👁 ${numFmt(r.watchers_count)}</span>
            </div>
          </div>
        </div>`).join('');
    } catch (e) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><div class="empty-title">Yüklenemedi</div><p>${e.message}</p></div>`;
    }
  }

  // ----------- SEARCH -----------
  function renderSearch() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">🔍 GitHub Kullanıcı Arama</h1>
        <p class="page-subtitle">GitHub profillerini ve repolarını keşfedin</p>
      </div>
      <div class="section">
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="GitHub kullanıcı adı girin (örn: torvalds)" autocomplete="off">
          <button class="btn-search" id="searchBtn">🔍 Ara</button>
        </div>
        <div id="searchResult"></div>
      </div>`;

    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchBtn');
    btn.addEventListener('click', () => doSearch(input.value.trim()));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(input.value.trim()); });
  }

  async function doSearch(username) {
    if (!username) { Toast.show('Kullanıcı adı girin', 'warning'); return; }
    const result = document.getElementById('searchResult');
    if (!result) return;
    result.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Aranıyor...</p></div>`;
    try {
      const [user, repos] = await Promise.all([API.ghUser(username), API.ghUserRepos(username)]);
      result.innerHTML = `
        <div class="user-profile">
          <div class="user-header">
            <img src="${user.avatar_url}" class="user-avatar" alt="${user.login}">
            <div>
              <div class="user-name">${user.name || user.login}</div>
              <div class="user-login">@${user.login}</div>
              ${user.bio ? `<div class="user-bio">${user.bio}</div>` : ''}
            </div>
          </div>
          <div class="user-stats-grid">
            <div class="user-stat"><div class="user-stat-num">${numFmt(user.public_repos)}</div><div class="user-stat-label">Repo</div></div>
            <div class="user-stat"><div class="user-stat-num">${numFmt(user.followers)}</div><div class="user-stat-label">Takipçi</div></div>
            <div class="user-stat"><div class="user-stat-num">${numFmt(user.following)}</div><div class="user-stat-label">Takip</div></div>
            <div class="user-stat"><div class="user-stat-num">${numFmt(user.public_gists)}</div><div class="user-stat-label">Gist</div></div>
          </div>
          <div class="user-info">
            ${user.company ? `<div class="user-info-item">🏢 ${user.company}</div>` : ''}
            ${user.location ? `<div class="user-info-item">📍 ${user.location}</div>` : ''}
            ${user.blog ? `<div class="user-info-item">🌐 <a href="${user.blog.startsWith('http') ? user.blog : 'https://' + user.blog}" target="_blank" style="color:var(--primary-light)">${user.blog}</a></div>` : ''}
            ${user.twitter_username ? `<div class="user-info-item">🐦 @${user.twitter_username}</div>` : ''}
            <div class="user-info-item">📅 ${new Date(user.created_at).toLocaleDateString('tr-TR')}</div>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
            <a href="${user.html_url}" target="_blank" class="btn btn-primary" style="padding:10px 20px;">GitHub Profili</a>
            <button onclick="window.__favToggle(${JSON.stringify({ id: 'gh_' + user.id, type: 'user', title: user.login, url: user.html_url, avatar: user.avatar_url }).replace(/"/g, '&quot;')})" class="btn btn-outline ${Favs.has('gh_' + user.id) ? 'active' : ''}" style="padding:10px 20px;">⭐ ${Favs.has('gh_' + user.id) ? 'Favoride' : 'Favoriye Ekle'}</button>
          </div>
          ${repos.length ? `
          <h3 style="margin-top:32px;margin-bottom:16px;font-size:1.1rem;">🗂 Popüler Repolar</h3>
          <div class="user-repos-grid">
            ${repos.map(r => `
              <a href="${r.html_url}" target="_blank" rel="noopener" class="user-repo-card">
                <div class="repo-name" style="font-size:0.9rem">${r.name}</div>
                <div class="repo-desc" style="-webkit-line-clamp:1">${r.description || 'Açıklama yok'}</div>
                <div class="repo-stats" style="margin-top:8px;">
                  <span class="repo-stat"><span class="repo-lang-dot" style="background:${langColor(r.language)}"></span>${r.language || '—'}</span>
                  <span class="repo-stat">⭐ ${numFmt(r.stargazers_count)}</span>
                </div>
              </a>`).join('')}
          </div>` : ''}
        </div>`;
    } catch (e) {
      result.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Kullanıcı bulunamadı</div>
          <p style="color:var(--text-muted)">"${username}" kullanıcısı mevcut değil</p>
        </div>`;
    }
  }

  // ----------- ARTICLES -----------
  async function renderArticles() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">📝 Dev.to Makaleler</h1>
        <p class="page-subtitle">Geliştirici topluluğundan güncel makaleler</p>
      </div>
      <div class="section">
        <div class="filters" id="articleFilters" style="margin-bottom:32px;">
          <button class="filter-btn active" data-tag="">🌐 Tümü</button>
          <button class="filter-btn" data-tag="javascript">JavaScript</button>
          <button class="filter-btn" data-tag="typescript">TypeScript</button>
          <button class="filter-btn" data-tag="python">Python</button>
          <button class="filter-btn" data-tag="webdev">Web Dev</button>
          <button class="filter-btn" data-tag="react">React</button>
          <button class="filter-btn" data-tag="ai">AI</button>
          <button class="filter-btn" data-tag="devops">DevOps</button>
          <button class="filter-btn" data-tag="rust">Rust</button>
        </div>
        <div id="articleGrid" class="grid grid-3">${Skel.cards(9, true)}</div>
      </div>`;

    document.getElementById('articleFilters').addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      document.querySelectorAll('#articleFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadArticles(btn.dataset.tag);
    });

    loadArticles('');
  }

  async function loadArticles(tag) {
    const grid = document.getElementById('articleGrid');
    if (!grid) return;
    grid.innerHTML = Skel.cards(9, true);
    try {
      const articles = await API.devtoArticles(tag);
      if (!articles.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📝</div><div class="empty-title">Makale bulunamadı</div></div>`;
        return;
      }
      grid.innerHTML = articles.map(a => `
        <div class="card">
          ${a.cover_image
            ? `<img src="${a.cover_image}" class="article-cover" loading="lazy" alt="${a.title}" onerror="this.style.display='none'">`
            : `<div class="article-cover-placeholder">📝</div>`}
          <div class="card-body">
            <div class="article-tags">
              ${(a.tag_list || []).slice(0, 3).map(t => `<span class="article-tag">#${t}</span>`).join('')}
            </div>
            <div class="article-title">${a.title}</div>
            ${a.description ? `<div class="article-excerpt">${a.description}</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div class="article-author">
                <div class="author-avatar">
                  ${a.user.profile_image ? `<img src="${a.user.profile_image}" alt="${a.user.name}" onerror="this.parentElement.textContent='${a.user.name[0]}'">` : a.user.name[0]}
                </div>
                <span class="author-name">${a.user.name}</span>
              </div>
              <div class="article-stats">
                <span>❤️ ${a.public_reactions_count || 0}</span>
                <span>💬 ${a.comments_count || 0}</span>
                <span>⏱ ${a.reading_time_minutes}dk</span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <span style="font-size:0.78rem;color:var(--text-muted)">${new Date(a.published_at).toLocaleDateString('tr-TR')}</span>
            <div style="display:flex;gap:8px;">
              <button class="fav-btn ${Favs.has(a.id) ? 'active' : ''}" onclick="window.__favToggle(${JSON.stringify({ id: a.id, type: 'article', title: a.title, url: a.url, author: a.user.name, reactions: a.public_reactions_count }).replace(/"/g, '&quot;')})" title="Favorile">⭐</button>
              <a href="${a.url}" target="_blank" rel="noopener" class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem;">Oku →</a>
            </div>
          </div>
        </div>`).join('');
    } catch (e) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><div class="empty-title">Yüklenemedi</div><p>${e.message}</p></div>`;
    }
  }

  // ----------- FAVORITES -----------
  function renderFavorites() {
    const app = document.getElementById('app');
    const favs = state.favorites;

    if (!favs.length) {
      app.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">⭐ Favoriler</h1>
        </div>
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <div class="empty-title">Henüz favori eklemediniz</div>
          <p style="color:var(--text-muted);margin-bottom:24px;">İçeriklerdeki ⭐ butonuna tıklayarak favorilerinize ekleyebilirsiniz</p>
          <a href="#/news" class="btn btn-primary">📰 Haberlere Git</a>
        </div>`;
      return;
    }

    const byType = { news: [], repo: [], article: [], user: [] };
    favs.forEach(f => { if (byType[f.type]) byType[f.type].push(f); });

    const icons = { news: '📰', repo: '💻', article: '📝', user: '👤' };
    const labels = { news: 'Haberler', repo: 'Repolar', article: 'Makaleler', user: 'Kullanıcılar' };

    app.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">⭐ Favoriler</h1>
        <p class="page-subtitle">${favs.length} kayıtlı içerik</p>
      </div>
      <div class="section">
        <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
          <button onclick="window.__clearFavs()" class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);">🗑 Tümünü Temizle</button>
        </div>
        ${Object.entries(byType).filter(([, items]) => items.length).map(([type, items]) => `
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:16px;">${icons[type]} ${labels[type]} (${items.length})</h2>
          <div class="grid" style="margin-bottom:40px;">
            ${items.map(item => `
              <div class="card">
                <div class="card-body">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                    <div style="flex:1;min-width:0;">
                      <div style="font-size:0.95rem;font-weight:600;margin-bottom:8px;line-height:1.4;">${item.title}</div>
                      ${item.author ? `<div style="font-size:0.8rem;color:var(--text-secondary)">✍️ ${item.author}</div>` : ''}
                      ${item.by ? `<div style="font-size:0.8rem;color:var(--text-secondary)">👤 ${item.by}</div>` : ''}
                      ${item.stars !== undefined ? `<div style="font-size:0.8rem;color:var(--text-secondary)">⭐ ${numFmt(item.stars)} star</div>` : ''}
                      ${item.score !== undefined ? `<div style="font-size:0.8rem;color:var(--text-secondary)">🔼 ${item.score} puan</div>` : ''}
                    </div>
                    <button class="fav-btn active" onclick="window.__favRemove('${item.id}')" title="Kaldır">✖</button>
                  </div>
                </div>
                <div class="card-footer">
                  <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem;">Aç →</a>
                </div>
              </div>`).join('')}
          </div>`).join('')}
      </div>`;

    window.__favRemove = (id) => { Favs.remove(id); renderFavorites(); };
    window.__clearFavs = () => {
      if (confirm('Tüm favoriler silinecek. Emin misiniz?')) {
        state.favorites = [];
        Favs.save();
        Favs.updateBadge();
        renderFavorites();
      }
    };
  }

  // ===================== GLOBAL FAV TOGGLE =====================
  window.__favToggle = function (item) {
    if (typeof item === 'string') {
      try { item = JSON.parse(item); } catch { return; }
    }
    Favs.toggle(item);
    document.querySelectorAll('.fav-btn, .btn-outline').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || '';
      if (onclick.includes(`"id":${JSON.stringify(item.id)}`) || onclick.includes(`"id":"${item.id}"`)) {
        btn.classList.toggle('active', Favs.has(item.id));
        if (btn.textContent.includes('Favoriye Ekle') || btn.textContent.includes('Favoride')) {
          btn.textContent = `⭐ ${Favs.has(item.id) ? 'Favoride' : 'Favoriye Ekle'}`;
        }
      }
    });
  };

  // ===================== ROUTER =====================
  const routes = {
    '': renderHome,
    'home': renderHome,
    'news': renderNews,
    'repos': renderRepos,
    'search': renderSearch,
    'articles': renderArticles,
    'favorites': renderFavorites
  };

  function navigate() {
    const hash = location.hash.replace('#/', '').replace('#', '') || 'home';
    const page = hash.split('/')[0] || 'home';

    Object.values(state.charts).forEach(c => { if (c) c.destroy(); });
    state.charts = {};

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page || (page === 'home' && link.dataset.page === 'home'));
    });

    state.page = page;
    const render = routes[page] || renderHome;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Favs.updateBadge();
  }

  // ===================== NAV =====================
  function initNav() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });

    navLinks.addEventListener('click', e => {
      if (e.target.classList.contains('nav-link')) {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
      }
    });

    window.addEventListener('scroll', () => {
      document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  // ===================== INIT =====================
  Theme.init();
  Favs.updateBadge();
  initNav();

  document.getElementById('themeToggle').addEventListener('click', () => Theme.toggle());
  window.addEventListener('hashchange', navigate);
  navigate();
})();
