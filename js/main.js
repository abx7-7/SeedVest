// main.js

class StockMarketApp {
  constructor() {
    this.keys = {
      marketstack: 'c17d6970203a0058d63eae8869e022b6',
      marketaux:   'l4IUY0AQ3Di2PESEwm1G530KnoY2PH5j6mM2BYUg'
    };
    this.currentChart = null;
    this.state = {
      watchlist: JSON.parse(localStorage.getItem('watchlist') || '["AAPL","MSFT","GOOGL","TSLA","AMZN"]'),
      darkMode:  localStorage.getItem('darkMode') === 'true'
    };
    this.rangeMap = { '1D':1, '1W':7, '1M':30, '3M':90, '1Y':365 };
  }

  // basic fetch wrapper
  async _request(service, endpoint, params={}) {
    const bases = {
      marketstack: 'https://api.marketstack.com/v1',
      marketaux:   'https://api.marketaux.com/v1'
    };
    const keys = {
      marketstack: 'access_key',
      marketaux:   'api_token'
    };
    const url = new URL(`${bases[service]}/${endpoint}`);
    url.search = new URLSearchParams({ [keys[service]]: this.keys[service], ...params });
    try {
      const r = await fetch(url);
      const js = await r.json();
      return service==='marketaux' ? (js.data||js) : (js.data||null);
    } catch(e) {
      console.error(`fetch ${service}/${endpoint} failed`, e);
      return null;
    }
  }

  // helpers for currency
  getSelectedCurrency() {
    return document.getElementById('currencySelect')?.value || 'USD';
  }
  getCurrencySymbol(cur) {
    const map = { USD:'$', EUR:'€', GBP:'£' };
    return map[cur] || cur;
  }

  // end-of-day latest price
  fetchEOD(sym) {
    return this._request('marketstack','eod/latest',{ symbols: sym });
  }

  // historical close prices
  fetchHistorical(sym, rangeKey='1M') {
    return this._request('marketstack','eod',{ symbols: sym, limit: this.rangeMap[rangeKey] || 30 });
  }

  // ── Home & News snapshot 
  async updateSnapshot(symbols = this.state.watchlist.slice(0,5), containerId='snapshotContainer') {
    const ul = document.getElementById(containerId);
    if (!ul) return;
    ul.innerHTML = '';
    const currency = this.getSelectedCurrency();
    const curSym = this.getCurrencySymbol(currency);
    for (let sym of symbols) {
      const data = await this.fetchEOD(sym);
      const d = Array.isArray(data)? data[0]: data;
      if (!d) continue;
      const raw = d.close - d.open;
      const pct = ((raw/d.open)*100).toFixed(1);
      const cls = raw>=0?'green':'red';
      const sign= raw>=0?'+':'';
      ul.insertAdjacentHTML('beforeend', `
        <li>
          <strong>${sym}</strong><br>
          ${curSym}${d.close.toFixed(2)} <span class="${cls}">${sign}${raw.toFixed(2)} (${pct}%)</span>
        </li>`);
    }
  }

  // ── Detail page info panel ──────────────────────────────────────────
  async updateStockDetails(sym, containerId='stockDetails') {
    const div = document.getElementById(containerId);
    if (!div) return;
    div.innerHTML = '<div class="loading">Loading details…</div>';
    const data = await this.fetchEOD(sym);
    const d = Array.isArray(data)? data[0]: data;
    if (!d) return div.innerHTML = '<div class="error">No data</div>';
    const rawOpen = d.open, rawClose = d.close, rawCh = rawClose - rawOpen;
    const pct = ((rawCh/rawOpen)*100).toFixed(1);
    const cls = rawCh>=0?'green':'red';
    const sign= rawCh>=0?'+':'';
    const curSym = this.getCurrencySymbol(this.getSelectedCurrency());
    div.innerHTML = `
      <div class="stock-details">
        <p><strong>${sym}</strong></p>
        <p>Open: ${curSym}${rawOpen.toFixed(2)}</p>
        <p>Close: <span class="${cls}">${curSym}${rawClose.toFixed(2)}</span></p>
        <p>Change: <span class="${cls}">${sign}${rawCh.toFixed(2)} (${pct}%)</span></p>
      </div>`;
  }

  // ── Detail page chart ───────────────────────────────────────────────
  async renderChart(sym, rangeKey='1M') {
    const canvas = document.getElementById('stockChart');
    if (!canvas || !window.Chart) return;
    const raw = await this.fetchHistorical(sym, rangeKey);
    if (!raw?.length) return console.error('no history');
    if (this.currentChart) this.currentChart.destroy();
    const data = raw.sort((a,b)=>new Date(a.date)-new Date(b.date));
    const labels = data.map(d=>new Date(d.date).toLocaleDateString());
    const prices = data.map(d=>d.close);
    const net = prices[prices.length-1] - prices[0];
    this.currentChart = new Chart(canvas.getContext('2d'), {
      type:'line',
      data:{ labels, datasets:[{
        label:`${sym} (${rangeKey})`,
        data:prices,
        borderColor: net>=0?'#007bff':'#c00',
        backgroundColor: net>=0?'rgba(0,123,255,0.1)':'rgba(255,0,0,0.1)',
        fill:true, tension:0.2
      }]},
      options:{ responsive:true }
    });
  }

  // ── News panels ─────────────────────────────────────────────────────
  async updateNewsForSymbol(sym, containerId='newsContainer', limit=5) {
    const div = document.getElementById(containerId);
    if (!div) return;
    div.innerHTML = '<div class="loading">Loading news…</div>';
    const items = await this._request('marketaux','news/all',{
      symbols: sym, filter_entities:true, limit, language:'en'
    });
    if (!items?.length) return div.innerHTML = '<div class="error">No news</div>';
    div.innerHTML = items.map(a=>`
      <div class="news-item">
        <a href="${a.url}" target="_blank">${a.title}</a>
        <p>${a.snippet||a.description||''}</p>
        <small>${a.source} • ${new Date(a.published_at).toLocaleDateString()}</small>
      </div>`).join('');
  }

  // ── Wire up the search form and selectors ──────────────────────────
  initSearch() {
    const form = document.getElementById('stockSearchForm');
    const inp  = document.getElementById('searchStock');
    if (!form||!inp) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const sym = inp.value.trim().toUpperCase();
      if (!sym) return;
      history.replaceState(null,'',`news.html?symbol=${sym}`);
      document.getElementById('newsSymbol').textContent = sym;
      await this.updateSnapshot(this.state.watchlist.slice(0,3),'snapshotContainer');
      await this.updateNewsForSymbol(sym,'newsContainer');
      inp.value = '';
    });
  }

  // ── Decide what to show on load ─────────────────────────────────────
  async route() {
    const page = location.pathname.split('/').pop();
    if (page==='news.html') {
      const sym = new URLSearchParams(location.search).get('symbol')||'AAPL';
      document.getElementById('newsSymbol').textContent = sym;
      await this.updateSnapshot(this.state.watchlist.slice(0,3),'snapshotContainer');
      await this.updateNewsForSymbol(sym,'newsContainer');
    } else {
      // other pages...
    }
  }

  // ── Dark mode & dropdown listeners ─────────────────────────────────
  toggleDark() {
    this.state.darkMode = !this.state.darkMode;
    localStorage.setItem('darkMode', this.state.darkMode);
    document.body.classList.toggle('dark-mode', this.state.darkMode);
  }

  init() {
    document.addEventListener('DOMContentLoaded', async () => {
      document.getElementById('toggleMode')
        ?.addEventListener('click', ()=>this.toggleDark());
      document.body.classList.toggle('dark-mode', this.state.darkMode);
      this.initSearch();
      // re-load on selector change
      ['countrySelect','currencySelect'].forEach(id=>{
        document.getElementById(id)
          ?.addEventListener('change', ()=> this.route());
      });
      await this.route();
    });
  }
}

// bootstrap it
new StockMarketApp().init();
