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
		this.wrapper = wrapper;
		this.page    = frappe.ui.make_app_page({
			parent: wrapper, title: "", single_column: true,
		});
		this.charts  = {};
		this._ready  = false;
		this._init();
	}

	_init() {
		this._load_apexcharts().then(() => {
			this._ready = true;
			this._render();
			this._bind_events();
			this.refresh();
		}).catch(() => frappe.msgprint(__("Não foi possível carregar ApexCharts. Verifique a ligação à internet.")));
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
		if (this._ready) {
			Object.values(this.charts).forEach(c => { try { c.destroy(); } catch (_) {} });
			this.charts = {};
			this.refresh();
		}
	}

	// ── Render ───────────────────────────────────────────────────────────────

	_render() {
		$(this.page.body).html(this._html());
	}

	_html() {
		return /* html */`
<div class="sx-wrap">

  <!-- ─ Header ──────────────────────────────────────────────────────── -->
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

  <!-- ─ Section: Resumo ─────────────────────────────────────────────── -->
  <div class="sx-section-label">Resumo Operacional</div>
  <div class="sx-kpi-grid">
    ${this._kpi("clientes",       "Total de Clientes",      "🏢")}
    ${this._kpi("ativos",         "Vigilantes Ativos",      "✅")}
    ${this._kpi("mulheres",       "Vigilantes Mulheres",    "♀")}
    ${this._kpi("homens",         "Vigilantes Homens",      "♂")}
    ${this._kpi("armados",        "Vigilantes Armados",     "🔫")}
    ${this._kpi("simples",        "Vigilantes Normais",     "👤")}
    ${this._kpi("reservas",       "Vigilantes Reservas",    "🔄")}
    ${this._kpi("administrativos","Administrativos",        "📋")}
    ${this._kpi("postos",         "Postos de Vigilância",   "📍")}
    ${this._kpi("postos_ativos",  "Postos Ativos",          "🟢")}
    ${this._kpi("tdu",            "Vigilantes TDU",         "⏱")}
    ${this._kpi("h24",            "Vigilantes H24",         "🌐")}
    ${this._kpi("tdn",            "Vigilantes TDN",         "🌙")}
  </div>

  <!-- ─ Section: Demissões ──────────────────────────────────────────── -->
  <div class="sx-section-label">Demissões</div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-demissoes-diarias",  "Demissões Diárias",  "Últimos 30 dias")}
    ${this._chart_card("sx-ch-demissoes-semanais", "Demissões Semanais", "Últimas 12 semanas")}
  </div>

  <!-- ─ Section: Rotatividades ──────────────────────────────────────── -->
  <div class="sx-section-label">Rotatividades</div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-rot-diarias",  "Rotatividades Diárias",  "Últimos 30 dias")}
    ${this._chart_card("sx-ch-rot-semanais", "Rotatividades Semanais", "Últimas 12 semanas")}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-rot-mensais", "Rotatividades Mensais", "Últimos 12 meses", 300)}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-rot-por-cliente", "Rotatividades Mensais por Cliente", "Últimos 6 meses — top 10 clientes", 320)}
  </div>

  <!-- ─ Section: Ausências ──────────────────────────────────────────── -->
  <div class="sx-section-label">Ausências</div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-aus-semanais", "Ausências Semanais", "Últimas 12 semanas", 280)}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-aus-mensais", "Ausências Mensais", "Últimos 12 meses", 280)}
  </div>

  <!-- ─ Section: Distribuição ───────────────────────────────────────── -->
  <div class="sx-section-label">Distribuição</div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-vig-cliente",  "Vigilantes por Cliente",     "Activos — top 15")}
    ${this._chart_card("sx-ch-armas-deleg",  "Armas por Delegação",        "Total registado")}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-admitidos", "Admitidos vs Demitidos", "Comparação mensal", 300)}
  </div>
  <div class="sx-row-half">
    ${this._chart_card("sx-ch-reservas-deleg",   "Reservas por Delegação",    "Activos")}
    ${this._chart_card("sx-ch-superv-deleg",     "Supervisores por Delegação","Total registado")}
  </div>
  <div class="sx-row-full">
    ${this._chart_card("sx-ch-feriadores-deleg", "Feriadores por Delegação",  "Activos", 260)}
  </div>

  <!-- ─ Section: Alertas ────────────────────────────────────────────── -->
  <div class="sx-section-label sx-section-label--alert">Alertas & Relatórios</div>

  <div class="sx-table-card" style="margin-bottom:16px">
    <div class="sx-table-head">
      <div>
        <h3 class="sx-card-title">Vigilantes com mais de 8 Faltas</h3>
        <p class="sx-card-sub">Acumulado — vigilantes activos com maior número de faltas</p>
      </div>
      <button class="sx-btn-export" id="sx-export-faltas">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>CSV
      </button>
    </div>
    <div class="sx-table-scroll">
      <table class="sx-table">
        <thead><tr>
          <th>#</th><th>Vigilante</th><th>Nome</th>
          <th>Posto</th><th>Delegação</th><th class="sx-th-r">Total Faltas</th>
        </tr></thead>
        <tbody id="sx-tbody-faltas"><tr><td colspan="6" class="sx-skeleton-cell"><div class="sx-skeleton"></div></td></tr></tbody>
      </table>
    </div>
    <div class="sx-table-foot"><span id="sx-count-faltas" class="sx-count">—</span></div>
  </div>

  <div class="sx-table-card" style="margin-bottom:28px">
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
        <tbody id="sx-tbody-users"><tr><td colspan="4" class="sx-skeleton-cell"><div class="sx-skeleton"></div></td></tr></tbody>
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

	_chart_card(chart_id, title, sub, height = 260) {
		return /* html */`
<div class="sx-card">
  <div class="sx-card-head">
    <div>
      <h3 class="sx-card-title">${title}</h3>
      <p class="sx-card-sub">${sub}</p>
    </div>
  </div>
  <div id="${chart_id}" style="height:${height}px;width:100%"></div>
</div>`;
	}

	// ── Events ───────────────────────────────────────────────────────────────

	_bind_events() {
		const $b = this.page.body;
		$b.on("click", "#sx-refresh", () => this.refresh());
		$b.on("click", "#sx-export-faltas", () => this._export_faltas());
	}

	// ── Data Loading ─────────────────────────────────────────────────────────

	refresh() {
		this._show_loading(true);
		Promise.all([
			this._call("get_cards_summary").then(d => this._render_cards(d)),

			this._call("get_demissoes_diarias",     { days: 30 })
				.then(d => this._bar("sx-ch-demissoes-diarias",  d, "#DC2626")),
			this._call("get_demissoes_semanais",    { weeks: 12 })
				.then(d => this._bar("sx-ch-demissoes-semanais", d, "#DC2626")),

			this._call("get_rotatividades_diarias",    { days: 30 })
				.then(d => this._line("sx-ch-rot-diarias",  d, "#D97706")),
			this._call("get_rotatividades_semanais",   { weeks: 12 })
				.then(d => this._line("sx-ch-rot-semanais", d, "#D97706")),
			this._call("get_rotatividades_mensais",    { months: 12 })
				.then(d => this._bar("sx-ch-rot-mensais",   d, "#D97706", 300)),
			this._call("get_rotatividades_por_cliente",{ months: 6 })
				.then(d => this._stacked_bar("sx-ch-rot-por-cliente", d, 320)),

			this._call("get_ausencias_semanais", { weeks: 12 })
				.then(d => this._bar("sx-ch-aus-semanais", d, "#2563EB", 280)),
			this._call("get_ausencias_mensais",  { months: 12 })
				.then(d => this._bar("sx-ch-aus-mensais",  d, "#2563EB", 280)),

			this._call("get_vigilantes_por_cliente")
				.then(d => this._hbar("sx-ch-vig-cliente",  d, "#E85D04")),
			this._call("get_armas_por_delegacao")
				.then(d => this._hbar("sx-ch-armas-deleg",  d, "#7C3AED")),
			this._call("get_admitidos_demitidos", { months: 12 })
				.then(d => this._dual_bar("sx-ch-admitidos", d, 300)),
			this._call("get_reservas_por_delegacao")
				.then(d => this._hbar("sx-ch-reservas-deleg",   d, "#0891B2")),
			this._call("get_supervisores_por_delegacao")
				.then(d => this._hbar("sx-ch-superv-deleg",     d, "#059669")),
			this._call("get_feriadores_por_delegacao")
				.then(d => this._hbar("sx-ch-feriadores-deleg", d, "#EA580C", 260)),

			this._call("get_vigilantes_muitas_faltas", { min_faltas: 8 })
				.then(d => this._render_faltas(d)),
			this._call("get_users_inativos", { days: 3 })
				.then(d => this._render_users(d)),
		]).finally(() => this._show_loading(false));
	}

	_call(method, args) {
		return frappe.call({
			method: `sixs_app.api.dashboard.${method}`,
			args: args || {},
		}).then(r => r.message || {});
	}

	// ── Cards ─────────────────────────────────────────────────────────────────

	_render_cards(d) {
		if (!d) return;
		Object.keys(d).forEach(key => this._set_kpi(key, d[key]));
	}

	_set_kpi(id, value) {
		const el  = this.page.body.find(`#sx-kpi-${id}-val`)[0];
		const bar = this.page.body.find(`#sx-kpi-${id}-bar`)[0];
		if (!el) return;

		const target = parseInt(value) || 0;
		const dur    = 700;
		const start  = Date.now();
		const tick   = () => {
			const p    = Math.min((Date.now() - start) / dur, 1);
			const ease = 1 - Math.pow(1 - p, 3);
			el.textContent = Math.round(target * ease).toLocaleString("pt-PT");
			if (p < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);

		if (bar) {
			bar.style.transform    = "scaleX(0)";
			bar.style.transition   = "transform 900ms cubic-bezier(.22,1,.36,1)";
			setTimeout(() => { bar.style.transform = "scaleX(1)"; }, 100);
		}
	}

	// ── Chart helpers ─────────────────────────────────────────────────────────

	_chart_base(height) {
		return {
			chart: {
				height:     height || 260,
				toolbar:    { show: false },
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

	_make_chart(el_id, options) {
		this._destroy(el_id);
		const el = this.page.body.find(`#${el_id}`)[0];
		if (!el) return;
		this.charts[el_id] = new ApexCharts(el, options);
		this.charts[el_id].render();
	}

	// Column bar (single series)
	_bar(el_id, data, color = "#E85D04", height = 260) {
		if (!data?.labels?.length) return;
		this._make_chart(el_id, {
			...this._chart_base(height),
			series: [{ name: "Total", data: data.values }],
			chart:  { ...this._chart_base(height).chart, type: "bar" },
			colors: [color],
			plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30, hideOverlappingLabels: true } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
		});
	}

	// Line chart (single series)
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

	// Horizontal bar
	_hbar(el_id, data, color = "#E85D04", height = 260) {
		if (!data?.labels?.length) return;
		this._make_chart(el_id, {
			...this._chart_base(Math.max(height, data.labels.length * 32 + 40)),
			series: [{ name: "Total", data: data.values }],
			chart:  { ...this._chart_base(height).chart, type: "bar" },
			colors: [color],
			plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: "55%",
				dataLabels: { position: "top" } } },
			dataLabels: { enabled: true, offsetX: 4,
				style: { colors: ["#64748B"], fontSize: "11px", fontFamily: "'DM Mono','Courier New',monospace" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style() } },
			yaxis: { labels: { style: { ...this._axis_style(), colors: "#334155" } } },
		});
	}

	// Dual bar (admitidos vs demitidos)
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
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30 } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
			legend: { position: "top", fontFamily: "'DM Mono','Courier New',monospace", fontSize: "11px",
				markers: { width: 8, height: 8, radius: 2 } },
		});
	}

	// Stacked bar (rotatividades por cliente)
	_stacked_bar(el_id, data, height = 320) {
		if (!data?.labels?.length || !data?.series?.length) return;

		const palette = ["#E85D04","#2563EB","#059669","#D97706","#7C3AED",
		                 "#DC2626","#0891B2","#EA580C","#16A34A","#9333EA"];
		const colors  = data.series.map((_, i) => palette[i % palette.length]);

		this._make_chart(el_id, {
			...this._chart_base(height),
			series: data.series,
			chart:  { ...this._chart_base(height).chart, type: "bar", stacked: true },
			colors,
			plotOptions: { bar: { borderRadius: 0, columnWidth: "60%" } },
			xaxis: { categories: data.labels, labels: { style: this._axis_style(), rotate: -30 } },
			yaxis: { labels: { style: this._axis_style(), formatter: v => Math.round(v) } },
			legend: { position: "bottom", fontFamily: "'DM Mono','Courier New',monospace",
				fontSize: "10px", markers: { width: 8, height: 8, radius: 2 }, itemMargin: { horizontal: 6 } },
		});
	}

	// ── Tables ────────────────────────────────────────────────────────────────

	_render_faltas(rows) {
		this._faltas_data = rows || [];
		const tbody    = this.page.body.find("#sx-tbody-faltas")[0];
		const count_el = this.page.body.find("#sx-count-faltas")[0];
		if (!tbody) return;

		if (!rows?.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="sx-empty">Nenhum vigilante com mais de 8 faltas.</td></tr>`;
			if (count_el) count_el.textContent = "0 registos";
			return;
		}

		tbody.innerHTML = rows.map((r, i) => /* html */`
<tr class="sx-row">
  <td class="sx-td-date">${i + 1}</td>
  <td><a href="/app/vigilante/${r.vigilante}" class="sx-link">${r.vigilante}</a></td>
  <td>${r.nome_completo || "—"}</td>
  <td>${r.posto       || "—"}</td>
  <td>${r.delegacao   || "—"}</td>
  <td class="sx-td-num sx-faltas-high">${r.total_faltas}</td>
</tr>`).join("");

		if (count_el) count_el.textContent = `${rows.length} vigilante${rows.length !== 1 ? "s" : ""}`;
	}

	_render_users(rows) {
		const tbody    = this.page.body.find("#sx-tbody-users")[0];
		const count_el = this.page.body.find("#sx-count-users")[0];
		if (!tbody) return;

		if (!rows?.length) {
			tbody.innerHTML = `<tr><td colspan="4" class="sx-empty">Todos os utilizadores acederam nos últimos 3 dias.</td></tr>`;
			if (count_el) count_el.textContent = "0 inactivos";
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

		if (count_el) count_el.textContent = `${rows.length} utilizador${rows.length !== 1 ? "es" : ""} inactivo${rows.length !== 1 ? "s" : ""}`;
	}

	_export_faltas() {
		if (!this._faltas_data?.length) return;
		const headers = ["Vigilante", "Nome", "Posto", "Delegação", "Total Faltas"];
		const rows    = this._faltas_data.map(r => [r.vigilante, r.nome_completo, r.posto, r.delegacao, r.total_faltas]);
		const csv     = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
		const a       = Object.assign(document.createElement("a"), {
			href:     URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
			download: `sixs_faltas_${frappe.datetime.get_today()}.csv`,
		});
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	_show_loading(on) {
		const el = this.page.body.find("#sx-loading")[0];
		if (el) el.style.display = on ? "flex" : "none";
	}
}
