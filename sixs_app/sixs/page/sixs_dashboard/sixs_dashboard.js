// SIXS — Security Operations Dashboard
frappe.pages["sixs-dashboard"].on_page_load = function (wrapper) {
	frappe.sixs_dashboard = new SixsDashboard(wrapper);
};
frappe.pages["sixs-dashboard"].on_page_show = function (wrapper) {
	if (frappe.sixs_dashboard) frappe.sixs_dashboard.on_show();
};

// ─────────────────────────────────────────────────────────────────────────────
class SixsDashboard {
	constructor(wrapper) {
		this.wrapper   = wrapper;
		this.page      = frappe.ui.make_app_page({ parent: wrapper, title: "", single_column: true });
		this.charts    = {};
		this.PAGE_SIZE = 20;
		this._ready    = false;

		// Option B state — server-side pagination for vig/rot, client-side for faltas
		this._ob = {
			"vig-cliente": { open: false, offset: 0, search: "", total: 0, debounce: null },
			"rot-cliente": { open: false, offset: 0, search: "", total: 0, debounce: null },
			"faltas":      { open: false, page: 0,   search: "", all_data: [], filtered: [] },
		};

		this._init();
	}

	_init() {
		this._load_apexcharts().then(() => {
			this._ready = true;
			this._render();
			this._bind_events();
			this.refresh();
		}).catch(() => frappe.msgprint(__("Não foi possível carregar ApexCharts.")));
	}

	_load_apexcharts() {
		if (window.ApexCharts) return Promise.resolve();
		return new Promise((res, rej) => {
			const s = document.createElement("script");
			s.src = "https://cdn.jsdelivr.net/npm/apexcharts@3.46.0/dist/apexcharts.min.js";
			s.onload = res; s.onerror = rej;
			document.head.appendChild(s);
		});
	}

	on_show() {
		if (!this._ready) return;
		Object.values(this.charts).forEach(c => { try { c.destroy(); } catch (_) {} });
		this.charts = {};
		this.refresh();
	}

	// ── HTML Layout ──────────────────────────────────────────────────────────

	_render() { $(this.page.body).html(this._html()); }

	_html() {
		return /* html */`
<div class="sx-wrap">

  <!-- ─ Header ───────────────────────────────────────────────────────── -->
  <header class="sx-topbar">
    <div class="sx-brand">
      <div class="sx-brand-mark">SX</div>
      <div>
        <span class="sx-brand-name">SIXS</span>
        <span class="sx-brand-sub">Central de Operações</span>
      </div>
    </div>
    <div class="sx-controls">
      <button class="sx-btn-refresh" id="sx-refresh">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
        </svg>
        Actualizar
      </button>
    </div>
  </header>

  <!-- ─ KPI Cards ─────────────────────────────────────────────────────── -->
  <div class="sx-section-label">Resumo Operacional</div>
  <div class="sx-kpi-grid">
    ${this._kpi("clientes",        "Total de Clientes",     "🏢")}
    ${this._kpi("ativos",          "Vigilantes Ativos",     "✅")}
    ${this._kpi("mulheres",        "Vigilantes Mulheres",   "♀")}
    ${this._kpi("homens",          "Vigilantes Homens",     "♂")}
    ${this._kpi("armados",         "Vigilantes Armados",    "🔫")}
    ${this._kpi("simples",         "Vigilantes Normais",    "👤")}
    ${this._kpi("reservas",        "Vigilantes Reservas",   "🔄")}
    ${this._kpi("administrativos", "Administrativos",       "📋")}
    ${this._kpi("postos",          "Postos de Vigilância",  "📍")}
    ${this._kpi("postos_ativos",   "Postos Activos",        "🟢")}
    ${this._kpi("tdu",             "Vigilantes TDU",        "⏱")}
    ${this._kpi("h24",             "Vigilantes H24",        "🌐")}
    ${this._kpi("tdn",             "Vigilantes TDN",        "🌙")}
  </div>

  <!-- ─ Demissões ──────────────────────────────────────────────────────── -->
  <div class="sx-section-label">Demissões</div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-demissoes-diarias",  "Demissões Diárias",  "Últimos 30 dias")}
    ${this._chart_card("sx-ch-demissoes-semanais", "Demissões Semanais", "Últimas 12 semanas")}
  </div>

  <!-- ─ Rotatividades ──────────────────────────────────────────────────── -->
  <div class="sx-section-label">Rotatividades</div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-rot-diarias",  "Rotatividades Diárias",  "Últimos 30 dias")}
    ${this._chart_card("sx-ch-rot-semanais", "Rotatividades Semanais", "Últimas 12 semanas")}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-rot-mensais", "Rotatividades Mensais", "Últimos 12 meses", 300)}
  </div>

  <!-- ─ Rotatividades por Cliente — Option B ──────────────────────────── -->
  <div class="sx-row-full">${this._ob_card("rot-cliente",
    "Rotatividades Mensais por Cliente",
    "Top 10 — últimos 6 meses",
    "clientes",
    [{ label: "#" }, { label: "Cliente" }, { label: "Rotatividades", right: true }, { label: "Última Data" }],
    300
  )}</div>

  <!-- ─ Ausências ──────────────────────────────────────────────────────── -->
  <div class="sx-section-label">Ausências</div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-aus-semanais", "Ausências Semanais", "Últimas 12 semanas", 280)}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-aus-mensais", "Ausências Mensais", "Últimos 12 meses", 280)}
  </div>

  <!-- ─ Distribuição ───────────────────────────────────────────────────── -->
  <div class="sx-section-label">Distribuição</div>

  <!-- Vigilantes por Cliente — Option B (full width) -->
  <div class="sx-row-full">${this._ob_card("vig-cliente",
    "Vigilantes por Cliente",
    "Top 10 activos",
    "clientes",
    [{ label: "#" }, { label: "Cliente" }, { label: "Vigilantes", right: true }, { label: "% do Total", right: true }],
    280
  )}</div>

  <div class="sx-row-half">
    ${this._chart_card("sx-ch-armas-deleg",    "Armas por Delegação",      "Total registado")}
    ${this._chart_card("sx-ch-reservas-deleg", "Reservas por Delegação",   "Activos")}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-admitidos", "Admitidos vs Demitidos", "Comparação mensal — últimos 12 meses", 300)}
  </div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-superv-deleg",     "Supervisores por Delegação", "Total registado")}
    ${this._chart_card("sx-ch-feriadores-deleg", "Feriadores por Delegação",   "Activos")}
  </div>

  <!-- ─ Alertas ────────────────────────────────────────────────────────── -->
  <div class="sx-section-label sx-section-label--alert">Alertas & Relatórios</div>

  <!-- Vigilantes com +8 Faltas — Option B (chart + table) -->
  <div class="sx-row-full">${this._ob_card("faltas",
    "Vigilantes com mais de 8 Faltas",
    "Top 10 — acumulado",
    "vigilantes",
    [{ label: "#" }, { label: "Vigilante" }, { label: "Nome" }, { label: "Posto" }, { label: "Delegação" }, { label: "Faltas", right: true }],
    240,
    true  // show export button
  )}</div>

  <!-- Utilizadores Inativos -->
  <div class="sx-table-card" style="margin:0 28px 28px">
    <div class="sx-table-head">
      <div>
        <h3 class="sx-card-title">Utilizadores Inactivos no Sistema</h3>
        <p class="sx-card-sub">Sem acesso há mais de 3 dias</p>
      </div>
    </div>
    <div class="sx-table-scroll">
      <table class="sx-table">
        <thead><tr>
          <th>Utilizador</th><th>Nome Completo</th>
          <th>Último Acesso</th><th class="sx-th-r">Dias Inactivo</th>
        </tr></thead>
        <tbody id="sx-tbody-users">
          <tr><td colspan="4" class="sx-skeleton-cell"><div class="sx-skeleton"></div></td></tr>
        </tbody>
      </table>
    </div>
    <div class="sx-table-foot"><span id="sx-count-users" class="sx-count">—</span></div>
  </div>

  <div class="sx-loading-overlay" id="sx-loading"><div class="sx-spinner"></div></div>
</div>`;
	}

	_kpi(id, label, icon) {
		return /* html */`
<div class="sx-kpi" id="sx-kpi-${id}">
  <div class="sx-kpi-icon">${icon}</div>
  <div class="sx-kpi-label">${label}</div>
  <div class="sx-kpi-value" id="sx-kpi-${id}-val">—</div>
  <div class="sx-kpi-bar" id="sx-kpi-${id}-bar"></div>
</div>`;
	}

	_chart_card(id, title, sub, height = 260) {
		return /* html */`
<div class="sx-card">
  <div class="sx-card-head">
    <div><h3 class="sx-card-title">${title}</h3><p class="sx-card-sub">${sub}</p></div>
  </div>
  <div id="${id}" style="height:${height}px;width:100%"></div>
</div>`;
	}

	// Option B card: top-N chart + collapsible searchable table
	_ob_card(id, title, sub, unit, headers, chart_height = 280, show_export = false) {
		const th = headers.map(h => `<th${h.right ? ' class="sx-th-r"' : ""}>${h.label}</th>`).join("");
		const export_btn = show_export
			? `<button class="sx-btn-export" id="sx-ob-${id}-export">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                   <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
                 </svg>CSV
               </button>`
			: "";

		return /* html */`
<div class="sx-card sx-ob-card">
  <div class="sx-card-head">
    <div><h3 class="sx-card-title">${title}</h3><p class="sx-card-sub">${sub}</p></div>
    <div class="sx-ob-head-right">
      <span class="sx-ob-badge" id="sx-ob-${id}-badge">—</span>
      ${export_btn}
    </div>
  </div>

  <div id="sx-ch-${id}" style="height:${chart_height}px;width:100%"></div>

  <button class="sx-ob-toggle" id="sx-ob-${id}-toggle">
    <span id="sx-ob-${id}-toggle-label">Ver todos os ${unit}</span>
    <svg class="sx-ob-chevron" id="sx-ob-${id}-chevron"
         width="14" height="14" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  <div class="sx-ob-drawer" id="sx-ob-${id}-drawer">
    <div class="sx-ob-searchbar">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" class="sx-ob-input" id="sx-ob-${id}-search"
             placeholder="Filtrar ${unit}…">
    </div>
    <div class="sx-table-scroll">
      <table class="sx-table">
        <thead><tr>${th}</tr></thead>
        <tbody id="sx-ob-${id}-tbody">
          <tr><td colspan="${headers.length}" class="sx-skeleton-cell">
            <div class="sx-skeleton"></div>
          </td></tr>
        </tbody>
      </table>
    </div>
    <div class="sx-ob-footer" id="sx-ob-${id}-footer">
      <span class="sx-count" id="sx-ob-${id}-count">—</span>
      <button class="sx-btn-load-more" id="sx-ob-${id}-more" style="display:none">
        Carregar mais
      </button>
    </div>
  </div>
</div>`;
	}

	// ── Events ───────────────────────────────────────────────────────────────

	_bind_events() {
		const $b = this.page.body;
		$b.on("click", "#sx-refresh", () => this.refresh());

		// ─ OB toggles
		$b.on("click", "#sx-ob-vig-cliente-toggle",  () => this._ob_toggle("vig-cliente"));
		$b.on("click", "#sx-ob-rot-cliente-toggle",  () => this._ob_toggle("rot-cliente"));
		$b.on("click", "#sx-ob-faltas-toggle",       () => this._ob_toggle("faltas"));

		// ─ OB search — server-side debounced
		$b.on("input", "#sx-ob-vig-cliente-search", (e) => {
			clearTimeout(this._ob["vig-cliente"].debounce);
			this._ob["vig-cliente"].debounce = setTimeout(() => {
				this._ob["vig-cliente"].search = e.target.value;
				this._ob["vig-cliente"].offset = 0;
				this._ob_load_server("vig-cliente", true);
			}, 320);
		});
		$b.on("input", "#sx-ob-rot-cliente-search", (e) => {
			clearTimeout(this._ob["rot-cliente"].debounce);
			this._ob["rot-cliente"].debounce = setTimeout(() => {
				this._ob["rot-cliente"].search = e.target.value;
				this._ob["rot-cliente"].offset = 0;
				this._ob_load_server("rot-cliente", true);
			}, 320);
		});
		// ─ OB search — client-side (faltas)
		$b.on("input", "#sx-ob-faltas-search", (e) => {
			this._ob["faltas"].search = e.target.value;
			this._ob["faltas"].page   = 0;
			this._ob_render_faltas_table(true);
		});

		// ─ Load more
		$b.on("click", "#sx-ob-vig-cliente-more", () => {
			this._ob["vig-cliente"].offset += this.PAGE_SIZE;
			this._ob_load_server("vig-cliente", false);
		});
		$b.on("click", "#sx-ob-rot-cliente-more", () => {
			this._ob["rot-cliente"].offset += this.PAGE_SIZE;
			this._ob_load_server("rot-cliente", false);
		});
		$b.on("click", "#sx-ob-faltas-more", () => {
			this._ob["faltas"].page++;
			this._ob_render_faltas_table(false);
		});

		// ─ Export
		$b.on("click", "#sx-ob-faltas-export", () => this._export_faltas());
	}

	// ── Refresh (all data) ────────────────────────────────────────────────────

	refresh() {
		this._show_loading(true);
		Promise.all([
			// Cards
			this._call("get_cards_summary").then(d => this._render_cards(d)),

			// Demissões
			this._call("get_demissoes_diarias",  { days: 30 })
				.then(d => this._bar("sx-ch-demissoes-diarias",  d, "#DC2626")),
			this._call("get_demissoes_semanais", { weeks: 12 })
				.then(d => this._bar("sx-ch-demissoes-semanais", d, "#DC2626")),

			// Rotatividades
			this._call("get_rotatividades_diarias",  { days: 30 })
				.then(d => this._line("sx-ch-rot-diarias",  d, "#D97706")),
			this._call("get_rotatividades_semanais", { weeks: 12 })
				.then(d => this._line("sx-ch-rot-semanais", d, "#D97706")),
			this._call("get_rotatividades_mensais",  { months: 12 })
				.then(d => this._bar("sx-ch-rot-mensais",   d, "#D97706", 300)),

			// OB: Rotatividades por Cliente
			this._call("get_rotatividades_por_cliente", { months: 6 }).then(d => {
				this._stacked_bar("sx-ch-rot-cliente", d, 300);
				this._ob_set_badge("rot-cliente", d.total_clients, "clientes");
				this._ob["rot-cliente"].total = d.total_clients || 0;
			}),

			// Ausências
			this._call("get_ausencias_semanais", { weeks: 12 })
				.then(d => this._bar("sx-ch-aus-semanais", d, "#2563EB", 280)),
			this._call("get_ausencias_mensais",  { months: 12 })
				.then(d => this._bar("sx-ch-aus-mensais",  d, "#2563EB", 280)),

			// OB: Vigilantes por Cliente
			this._call("get_vigilantes_por_cliente").then(d => {
				this._hbar("sx-ch-vig-cliente", d, "#E85D04", 280);
				this._ob_set_badge("vig-cliente", d.total_clients, "clientes");
				this._ob["vig-cliente"].total = d.total_clients || 0;
			}),

			// Distribution charts
			this._call("get_armas_por_delegacao")
				.then(d => this._hbar("sx-ch-armas-deleg",      d, "#7C3AED")),
			this._call("get_reservas_por_delegacao")
				.then(d => this._hbar("sx-ch-reservas-deleg",   d, "#0891B2")),
			this._call("get_admitidos_demitidos", { months: 12 })
				.then(d => this._dual_bar("sx-ch-admitidos",    d, 300)),
			this._call("get_supervisores_por_delegacao")
				.then(d => this._hbar("sx-ch-superv-deleg",     d, "#059669")),
			this._call("get_feriadores_por_delegacao")
				.then(d => this._hbar("sx-ch-feriadores-deleg", d, "#EA580C")),

			// OB: Faltas (single call feeds both chart and table)
			this._call("get_vigilantes_muitas_faltas", { min_faltas: 8 })
				.then(d => this._ob_init_faltas(d)),

			// Users table (non-OB)
			this._call("get_users_inativos", { days: 3 }).then(d => this._render_users(d)),
		]).finally(() => this._show_loading(false));
	}

	_call(method, args) {
		return frappe.call({
			method: `sixs_app.api.dashboard.${method}`, args: args || {},
		}).then(r => r.message || {});
	}

	// ── Cards ─────────────────────────────────────────────────────────────────

	_render_cards(d) {
		if (!d) return;
		Object.keys(d).forEach(k => this._set_kpi(k, d[k]));
	}

	_set_kpi(id, value) {
		const val_el = this.page.body.find(`#sx-kpi-${id}-val`)[0];
		const bar_el = this.page.body.find(`#sx-kpi-${id}-bar`)[0];
		if (!val_el) return;
		const target = parseInt(value) || 0;
		const dur    = 700, start = Date.now();
		const tick   = () => {
			const p    = Math.min((Date.now() - start) / dur, 1);
			const ease = 1 - Math.pow(1 - p, 3);
			val_el.textContent = Math.round(target * ease).toLocaleString("pt-PT");
			if (p < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		if (bar_el) {
			bar_el.style.transform  = "scaleX(0)";
			bar_el.style.transition = "transform 900ms cubic-bezier(.22,1,.36,1)";
			setTimeout(() => { bar_el.style.transform = "scaleX(1)"; }, 80);
		}
	}

	// ── Option B: shared helpers ──────────────────────────────────────────────

	_ob_toggle(id) {
		const state   = this._ob[id];
		state.open    = !state.open;
		const drawer  = this.page.body.find(`#sx-ob-${id}-drawer`)[0];
		const chevron = this.page.body.find(`#sx-ob-${id}-chevron`)[0];
		const label   = this.page.body.find(`#sx-ob-${id}-toggle-label`)[0];
		if (!drawer) return;

		if (state.open) {
			drawer.classList.add("sx-ob-open");
			if (chevron) chevron.style.transform = "rotate(180deg)";
			if (label)   label.textContent = "Fechar";
			// Lazy-load table on first open
			if (id === "vig-cliente" && state.offset === 0)
				this._ob_load_server("vig-cliente", true);
			if (id === "rot-cliente" && state.offset === 0)
				this._ob_load_server("rot-cliente", true);
			if (id === "faltas")
				this._ob_render_faltas_table(true);
		} else {
			drawer.classList.remove("sx-ob-open");
			if (chevron) chevron.style.transform = "";
			if (label)   label.textContent = `Ver todos os ${id === "faltas" ? "vigilantes" : "clientes"}`;
		}
	}

	_ob_set_badge(id, count, unit) {
		const el = this.page.body.find(`#sx-ob-${id}-badge`)[0];
		if (el) el.textContent = `${(count || 0).toLocaleString("pt-PT")} ${unit}`;
	}

	_ob_update_footer(id, loaded, total) {
		const count_el = this.page.body.find(`#sx-ob-${id}-count`)[0];
		const more_btn = this.page.body.find(`#sx-ob-${id}-more`)[0];
		if (count_el) count_el.textContent = `${loaded.toLocaleString("pt-PT")} de ${total.toLocaleString("pt-PT")}`;
		if (more_btn) {
			const remaining = total - loaded;
			if (remaining > 0) {
				more_btn.style.display  = "";
				more_btn.textContent    = `Carregar mais (${remaining} restantes)`;
			} else {
				more_btn.style.display = "none";
			}
		}
	}

	// ── Option B: server-side (vig-cliente & rot-cliente) ────────────────────

	_ob_load_server(id, reset) {
		const state   = this._ob[id];
		const method  = id === "vig-cliente"
			? "get_vigilantes_por_cliente_table"
			: "get_rot_por_cliente_table";
		const args    = { limit: this.PAGE_SIZE, offset: state.offset, search: state.search };
		if (id === "rot-cliente") args.months = 6;

		const tbody = this.page.body.find(`#sx-ob-${id}-tbody`)[0];
		if (reset && tbody) {
			tbody.innerHTML = `<tr><td colspan="4" class="sx-skeleton-cell"><div class="sx-skeleton"></div></td></tr>`;
		}

		this._call(method, args).then(d => {
			if (!d.rows) return;
			if (reset) state.offset = 0;
			state.total = d.total;

			const rows_html = d.rows.map((r, i) => {
				const row_num = state.offset - (reset ? 0 : this.PAGE_SIZE) + i + 1;
				if (id === "vig-cliente") {
					return /* html */`
<tr class="sx-row">
  <td class="sx-td-date">${row_num}</td>
  <td>${r.cliente}</td>
  <td class="sx-td-num">${r.total.toLocaleString("pt-PT")}</td>
  <td class="sx-td-num">${r.pct}%</td>
</tr>`;
				} else {
					return /* html */`
<tr class="sx-row">
  <td class="sx-td-date">${row_num}</td>
  <td>${r.cliente}</td>
  <td class="sx-td-num">${r.total.toLocaleString("pt-PT")}</td>
  <td class="sx-td-date">${r.ultima_data ? frappe.format(r.ultima_data, { fieldtype: "Date" }) : "—"}</td>
</tr>`;
				}
			}).join("");

			if (tbody) {
				if (reset) tbody.innerHTML = rows_html || `<tr><td colspan="4" class="sx-empty">Sem resultados.</td></tr>`;
				else       tbody.insertAdjacentHTML("beforeend", rows_html);
			}

			const loaded = (reset ? 0 : state.offset - this.PAGE_SIZE) + d.rows.length;
			const actual_loaded = reset
				? d.rows.length
				: Math.min(state.offset + d.rows.length, d.total);
			this._ob_update_footer(id, actual_loaded, d.total);
		});
	}

	// ── Option B: client-side (faltas) ────────────────────────────────────────

	_ob_init_faltas(data) {
		const rows = data || [];
		this._ob["faltas"].all_data = rows;

		// Top-10 horizontal bar chart above the toggle
		const top10 = rows.slice(0, 10);
		if (top10.length) {
			this._hbar("sx-ch-faltas", {
				labels: top10.map(r => r.nome_completo || r.vigilante),
				values: top10.map(r => r.total_faltas),
			}, "#DC2626", 240);
		}

		this._ob_set_badge("faltas", rows.length, `vigilante${rows.length !== 1 ? "s" : ""}`);

		// If drawer is already open (re-refresh), re-render table
		if (this._ob["faltas"].open) this._ob_render_faltas_table(true);
	}

	_ob_render_faltas_table(reset) {
		const state    = this._ob["faltas"];
		if (reset) state.page = 0;

		const q        = state.search.toLowerCase();
		const filtered = q
			? state.all_data.filter(r =>
				(r.nome_completo || "").toLowerCase().includes(q) ||
				(r.vigilante     || "").toLowerCase().includes(q) ||
				(r.posto         || "").toLowerCase().includes(q) ||
				(r.delegacao     || "").toLowerCase().includes(q)
			)
			: state.all_data;

		state.filtered = filtered;
		const shown    = (state.page + 1) * this.PAGE_SIZE;
		const page_rows = filtered.slice(0, shown);

		const tbody = this.page.body.find("#sx-ob-faltas-tbody")[0];
		if (!tbody) return;

		if (!page_rows.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="sx-empty">Nenhum vigilante encontrado.</td></tr>`;
		} else {
			tbody.innerHTML = page_rows.map((r, i) => /* html */`
<tr class="sx-row">
  <td class="sx-td-date">${i + 1}</td>
  <td><a href="/app/vigilante/${r.vigilante}" class="sx-link">${r.vigilante}</a></td>
  <td>${r.nome_completo || "—"}</td>
  <td>${r.posto       || "—"}</td>
  <td>${r.delegacao   || "—"}</td>
  <td class="sx-td-num sx-faltas-high">${r.total_faltas}</td>
</tr>`).join("");
		}

		this._ob_update_footer("faltas", page_rows.length, filtered.length);
	}

	// ── Users table ───────────────────────────────────────────────────────────

	_render_users(rows) {
		const tbody  = this.page.body.find("#sx-tbody-users")[0];
		const count  = this.page.body.find("#sx-count-users")[0];
		if (!tbody) return;

		if (!rows?.length) {
			tbody.innerHTML = `<tr><td colspan="4" class="sx-empty">Todos os utilizadores acederam nos últimos 3 dias.</td></tr>`;
			if (count) count.textContent = "0 inactivos";
			return;
		}

		tbody.innerHTML = rows.map(r => /* html */`
<tr class="sx-row">
  <td><a href="/app/user/${r.user}" class="sx-link">${r.user}</a></td>
  <td>${r.full_name || "—"}</td>
  <td class="sx-td-date">${r.last_active ? frappe.format(r.last_active, { fieldtype: "Datetime" }) : "Nunca"}</td>
  <td class="sx-td-num">
    <span class="sx-badge ${r.dias_inativo > 14 ? "sx-badge--overdue" : "sx-badge--unpaid"}">
      ${r.dias_inativo} dias
    </span>
  </td>
</tr>`).join("");

		if (count) count.textContent = `${rows.length} utilizador${rows.length !== 1 ? "es" : ""} inactivo${rows.length !== 1 ? "s" : ""}`;
	}

	// ── Chart factories ───────────────────────────────────────────────────────

	_chart_base(height) {
		return {
			chart: {
				height, toolbar: { show: false },
				fontFamily: "'DM Mono','Courier New',monospace",
				animations: { enabled: true, easing: "easeinout", speed: 600 },
				background: "transparent",
			},
			grid:       { borderColor: "#F1F5F9", strokeDashArray: 4, padding: { left: 4, right: 4 } },
			dataLabels: { enabled: false },
			tooltip:    { style: { fontFamily: "'DM Mono','Courier New',monospace", fontSize: "12px" } },
		};
	}

	_axis_style() {
		return { colors: "#94A3B8", fontFamily: "'DM Mono','Courier New',monospace", fontSize: "11px" };
	}

	_destroy(key) {
		if (this.charts[key]) { try { this.charts[key].destroy(); } catch (_) {} delete this.charts[key]; }
	}

	_make_chart(id, opts) {
		this._destroy(id);
		const el = this.page.body.find(`#${id}`)[0];
		if (!el) return;
		this.charts[id] = new ApexCharts(el, opts);
		this.charts[id].render();
	}

	_bar(el_id, data, color = "#E85D04", height = 260) {
		if (!data?.labels?.length) return;
		this._make_chart(el_id, {
			...this._chart_base(height),
			series: [{ name: "Total", data: data.values }],
			chart:  { ...this._chart_base(height).chart, type: "bar" },
			colors: [color],
			plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
		});
	}

	_line(el_id, data, color = "#E85D04", height = 260) {
		if (!data?.labels?.length) return;
		this._make_chart(el_id, {
			...this._chart_base(height),
			series: [{ name: "Total", data: data.values }],
			chart:  { ...this._chart_base(height).chart, type: "area" },
			colors: [color],
			fill:   { type: "gradient", gradient: { opacityFrom: 0.3, opacityTo: 0.02, stops: [0, 95] } },
			stroke: { curve: "smooth", width: 2.5 },
			xaxis:  { categories: data.labels, labels: { style: this._axis_style(), rotate: -30, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
			yaxis:  { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
		});
	}

	_hbar(el_id, data, color = "#E85D04", height = 260) {
		if (!data?.labels?.length) return;
		const dyn_height = Math.max(height, data.labels.length * 34 + 60);
		this._make_chart(el_id, {
			...this._chart_base(dyn_height),
			series: [{ name: "Total", data: data.values }],
			chart:  { ...this._chart_base(dyn_height).chart, type: "bar" },
			colors: [color],
			plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: "55%",
				dataLabels: { position: "top" } } },
			dataLabels: { enabled: true, offsetX: 4,
				style: { colors: ["#64748B"], fontSize: "11px", fontFamily: "'DM Mono','Courier New',monospace" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style() } },
			yaxis: { labels: { style: { ...this._axis_style(), colors: "#334155" } } },
		});
	}

	_dual_bar(el_id, data, height = 300) {
		if (!data?.labels?.length) return;
		this._make_chart(el_id, {
			...this._chart_base(height),
			series: [
				{ name: "Admitidos", data: data.admitidos },
				{ name: "Demitidos", data: data.demitidos },
			],
			chart:  { ...this._chart_base(height).chart, type: "bar" },
			colors: ["#059669", "#DC2626"],
			plotOptions: { bar: { borderRadius: 3, columnWidth: "55%", grouped: true } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30 }, axisBorder: { show: false }, axisTicks: { show: false } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
			legend: { position: "top", fontFamily: "'DM Mono','Courier New',monospace",
				fontSize: "11px", markers: { width: 8, height: 8, radius: 2 } },
		});
	}

	_stacked_bar(el_id, data, height = 320) {
		if (!data?.labels?.length || !data?.series?.length) return;
		const palette = ["#E85D04","#2563EB","#059669","#D97706","#7C3AED",
		                 "#DC2626","#0891B2","#EA580C","#16A34A","#9333EA"];
		this._make_chart(el_id, {
			...this._chart_base(height),
			series: data.series,
			chart:  { ...this._chart_base(height).chart, type: "bar", stacked: true },
			colors: data.series.map((_, i) => palette[i % palette.length]),
			plotOptions: { bar: { columnWidth: "60%" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30 }, axisBorder: { show: false }, axisTicks: { show: false } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
			legend: { position: "bottom", fontFamily: "'DM Mono','Courier New',monospace",
				fontSize: "10px", markers: { width: 8, height: 8, radius: 2 }, itemMargin: { horizontal: 6 } },
		});
	}

	// ── Utilities ─────────────────────────────────────────────────────────────

	_export_faltas() {
		const data = this._ob["faltas"].all_data || [];
		if (!data.length) return;
		const hdr = ["Vigilante","Nome","Posto","Delegação","Total Faltas"];
		const rows = data.map(r => [r.vigilante, r.nome_completo, r.posto, r.delegacao, r.total_faltas]);
		const csv  = [hdr, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
		const a    = Object.assign(document.createElement("a"), {
			href:     URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
			download: `sixs_faltas_${frappe.datetime.get_today()}.csv`,
		});
		document.body.appendChild(a); a.click(); document.body.removeChild(a);
	}

	_show_loading(on) {
		const el = this.page.body.find("#sx-loading")[0];
		if (el) el.style.display = on ? "flex" : "none";
	}
}
