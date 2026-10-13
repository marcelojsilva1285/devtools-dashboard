/* ---------- Ferramenta 3: Analisador de Logs VirtualPDV ---------- */
class LogAnalyzerTool {
  id = 'logs';
  title = 'Analisador de Logs TMPDV';
  icon = 'file-search';
  files = []; ents = []; view = 'g'; off = new Set();

  // ---------- utilitários ----------
  static esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  static pd(s) {
    const m = /(\d+)\/(\d+)\/(\d+)\s+(\d+):(\d+):(\d+)/.exec(s || '');
    return m ? new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5], +m[6]) : null;
  }
  static fld(b, t) { const m = new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(b); return m ? m[1].trim() : ''; }
  static fmt(d) { return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '-'; }
  static dk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  static cls(t) { return /erro/i.test(t) ? 'bg-red-600' : /avis|warn/i.test(t) ? 'bg-amber-500' : 'bg-sky-600'; }
  static isErr(t) { return /erro/i.test(t); }

  // O arquivo não é XML válido (sem raiz, com < e > dentro do stack trace), então a leitura é por regex.
  static parse(text, name) {
    const Z = LogAnalyzerTool, out = [], re = /<log>([\s\S]*?)<\/log>/g; let m;
    while ((m = re.exec(text))) {
      const b = m[1], c = Z.fld(b, 'conteudo'), tipo = Z.fld(b, 'tipo') || '?';
      const first = c.split(/\r?\n/)[0].replace(/^Message:\s*/, '');
      const sum = first.split('--->').pop().trim().slice(0, 220); // causa raiz = exceção mais interna
      const fr = /em (VirtualPDV[^\r\n]*?) na ([^\r\n]*?):linha (\d+)/.exec(c); // 1º frame do código VirtualPDV
      const ger = Z.fld(b, 'gerador');
      const loc = fr ? fr[2].split(/[\\/]/).pop() + ':' + fr[3] : (ger.split(/[\\/]/).pop() || '');
      out.push({ file: name, dt: Z.pd(Z.fld(b, 'data')), tipo, metodo: Z.fld(b, 'metodo'), c, sum, loc, ger,
        sig: tipo + '|' + sum.replace(/\d+/g, '#').slice(0, 100) + '|' + loc });
    }
    return out;
  }
  static async read(f) {
    let t = await f.text();
    if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(await f.arrayBuffer());
    return t;
  }

  // ---------- interface ----------
  mount(el) {
    this.el = el;
    const box = 'rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161d]';
    const inp = 'rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161d] px-2 py-1.5 text-sm dark:[color-scheme:dark]';
    const lbl = 'flex flex-col text-xs text-slate-500 gap-1';
    el.innerHTML = `
      <div class="p-4 space-y-3 max-w-6xl mx-auto">
        <div data-drop tabindex="0" class="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161d] p-6 text-center transition-colors">
          <div class="font-semibold">Arraste os arquivos de log aqui</div>
          <div class="text-sm text-slate-500">ou clique para selecionar (vários arquivos, de vários dias, Cliente e WebService). Nada é enviado: a leitura é local.</div>
          <input data-fi type="file" multiple class="hidden">
        </div>
        <div data-files class="flex flex-wrap gap-2"></div>
        <div data-app class="hidden space-y-3">
          <div data-stats class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"></div>
          <div class="${box} p-3"><div data-hist class="flex items-end gap-0.5 h-16 overflow-x-auto"></div><div data-hl class="flex justify-between text-xs text-slate-500 mt-1"></div></div>
          <div class="flex flex-wrap items-end gap-3">
            <label class="${lbl}">Dia<select data-day class="${inp}"></select></label>
            <label class="${lbl}">De<input data-d1 type="datetime-local" class="${inp}"></label>
            <label class="${lbl}">Até<input data-d2 type="datetime-local" class="${inp}"></label>
            <label class="${lbl}">Buscar<input data-q type="text" placeholder="mensagem, método, arquivo.cs…" class="${inp} w-56"></label>
            <div data-tipos class="flex flex-wrap gap-2"></div>
            <div class="inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden text-sm">
              <button data-v="g" class="px-3 py-1.5">Agrupado</button><button data-v="c" class="px-3 py-1.5">Cronológico</button>
            </div>
            <button data-a="clr" class="${BTN}">Limpar filtros</button>
            <button data-a="cp" class="${BTN_PRIMARY}">Copiar resumo</button>
            <button data-a="csv" class="${BTN}">Exportar CSV</button>
          </div>
          <div data-list></div>
        </div>
      </div>`;
    this.box = box;
    const zone = $('[data-drop]', el), fi = $('[data-fi]', el);
    zone.onclick = () => fi.click();
    fi.onchange = () => { this.add([...fi.files]); fi.value = ''; };
    // o painel inteiro aceita o arrasto (evita o navegador abrir o arquivo se soltar fora da caixa)
    el.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('border-teal-500', 'bg-teal-500/10'); });
    el.addEventListener('dragleave', e => { if (!e.relatedTarget || !el.contains(e.relatedTarget)) zone.classList.remove('border-teal-500', 'bg-teal-500/10'); });
    el.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('border-teal-500', 'bg-teal-500/10'); this.add([...e.dataTransfer.files]); });
    el.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]'), a = e.target.closest('[data-a]'), v = e.target.closest('[data-v]');
      if (rm) this.rm(+rm.dataset.rm);
      else if (v) { this.view = v.dataset.v; this.draw(); }
      else if (a) ({ clr: () => this.clearFilters(), cp: () => this.copySummary(), csv: () => this.exportCsv() })[a.dataset.a]();
    });
    el.addEventListener('change', e => {
      const t = e.target.closest('[data-tipo]');
      if (t) { this.off.has(t.dataset.tipo) ? this.off.delete(t.dataset.tipo) : this.off.add(t.dataset.tipo); this.draw(); }
      else if (e.target.matches('[data-day],[data-d1],[data-d2]')) this.draw();
    });
    el.addEventListener('input', e => { if (e.target.matches('[data-d1],[data-d2],[data-q]')) this.draw(); });
  }

  async add(list) {
    const Z = LogAnalyzerTool;
    for (const f of list) {
      if (this.files.some(x => x.orig === f.name && x.size === f.size)) continue;
      let nm = f.name, k = 2; // Cliente e WebService geram o mesmo nome de arquivo por dia
      while (this.files.some(x => x.name === nm)) nm = f.name + ' (' + (k++) + ')';
      const txt = await Z.read(f), e = Z.parse(txt, nm), h = txt.slice(0, Math.max(0, txt.indexOf('<log>')));
      const meta = ['Empresa', 'Terminal', 'Versão'].map(c => { const m = new RegExp(c + ':\\s*(.*)').exec(h); return m ? c + ' ' + m[1].trim() : ''; }).filter(Boolean).join(' · ');
      this.files.push({ name: nm, orig: f.name, size: f.size, n: e.length, meta });
      this.ents.push(...e);
    }
    this.render();
  }
  rm(i) { const n = this.files[i].name; this.files.splice(i, 1); this.ents = this.ents.filter(e => e.file !== n); this.render(); }

  render() {
    const Z = LogAnalyzerTool, el = this.el;
    $('[data-files]', el).innerHTML = this.files.map((f, i) =>
      `<span class="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161d] px-3 py-0.5 text-xs">${Z.esc(f.name)} · ${f.n} registros${f.meta ? ' · ' + Z.esc(f.meta) : ''}${f.n ? '' : ' <span class="text-amber-500">⚠ nenhum registro reconhecido</span>'}<button data-rm="${i}" title="Remover" class="text-slate-500 hover:text-red-500">×</button></span>`).join('');
    $('[data-app]', el).classList.toggle('hidden', !this.ents.length);
    const sel = $('[data-day]', el), prev = sel.value, days = {};
    this.ents.forEach(e => { if (e.dt) { const k = Z.dk(e.dt); days[k] = (days[k] || 0) + 1; } });
    sel.innerHTML = `<option value="">Todos os dias</option>` + Object.keys(days).sort().map(k => `<option value="${k}">${k.split('-').reverse().join('/')} (${days[k]})</option>`).join('');
    sel.value = days[prev] ? prev : '';
    if (this.ents.length) this.draw();
  }

  clearFilters() { const el = this.el; ['[data-day]', '[data-d1]', '[data-d2]', '[data-q]'].forEach(s => { $(s, el).value = ''; }); this.off.clear(); this.draw(); }

  filtered() {
    const el = this.el, Z = LogAnalyzerTool, day = $('[data-day]', el).value, q = $('[data-q]', el).value.toLowerCase();
    const a = $('[data-d1]', el).value ? new Date($('[data-d1]', el).value) : null, b = $('[data-d2]', el).value ? new Date($('[data-d2]', el).value) : null;
    return this.ents.filter(e => !this.off.has(e.tipo) && (!day || (e.dt && Z.dk(e.dt) === day)) && (!a || (e.dt && e.dt >= a)) && (!b || (e.dt && e.dt <= b))
      && (!q || (e.c + e.metodo + e.ger).toLowerCase().includes(q))).sort((x, y) => (x.dt || 0) - (y.dt || 0));
  }
  groups(L) { const g = {}; L.forEach(e => (g[e.sig] = g[e.sig] || []).push(e)); return Object.values(g).sort((a, b) => b.length - a.length); }
  span(g) { const d = g.filter(e => e.dt).map(e => +e.dt); return d.length ? [new Date(Math.min(...d)), new Date(Math.max(...d))] : [null, null]; }

  draw() {
    const Z = LogAnalyzerTool, el = this.el, L = this.filtered(), G = this.groups(L), esc = Z.esc, fmt = Z.fmt;
    const ds = L.filter(e => e.dt).map(e => +e.dt), mn = ds.length ? new Date(Math.min(...ds)) : null, mx = ds.length ? new Date(Math.max(...ds)) : null;
    const tipos = {}; this.ents.forEach(e => (tipos[e.tipo] = (tipos[e.tipo] || 0) + 1));
    $('[data-tipos]', el).innerHTML = Object.keys(tipos).map(t => `<label class="inline-flex items-center gap-1 text-sm"><input type="checkbox" data-tipo="${esc(t)}" ${this.off.has(t) ? '' : 'checked'} class="accent-teal-600"> ${esc(t)} (${tipos[t]})</label>`).join('');
    $('[data-stats]', el).innerHTML = [[L.length, 'registros'], [L.filter(e => Z.isErr(e.tipo)).length, 'erros'], [G.length, 'causas distintas'], [this.files.length, 'arquivos'], [fmt(mn), 'primeiro'], [fmt(mx), 'último']]
      .map(s => `<div class="${this.box} p-3"><div class="${String(s[0]).length > 9 ? 'text-sm py-1' : 'text-2xl'} font-semibold">${esc(s[0])}</div><div class="text-xs text-slate-500">${s[1]}</div></div>`).join('');
    this.hist(L, mn, mx);
    ['g', 'c'].forEach(v => { const b = $(`[data-v="${v}"]`, el); b.classList.toggle('bg-teal-600', this.view === v); b.classList.toggle('text-white', this.view === v); });
    const out = $('[data-list]', el);
    if (!L.length) { out.innerHTML = '<div class="text-center text-slate-500 py-8">Nenhum registro com esses filtros.</div>'; return; }
    const det = 'rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161d] mb-1.5';
    const sm = 'cursor-pointer px-3 py-2 flex flex-wrap items-baseline gap-3';
    const pre = 'mono text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0e1116] p-2 overflow-auto max-h-80 whitespace-pre';
    const badge = t => `<span class="text-[11px] font-semibold text-white rounded px-2 py-0.5 ${Z.cls(t)}">${esc(t)}</span>`;
    let html;
    if (this.view === 'g') {
      html = G.slice(0, 300).map(g => {
        const f = g[0], [a, b] = this.span(g), ms = [...new Set(g.map(e => e.metodo))], fs = [...new Set(g.map(e => e.file))];
        return `<details class="${det}"><summary class="${sm}"><span class="font-bold min-w-[3rem] text-right">${g.length}×</span>${badge(f.tipo)}<span class="flex-1 min-w-[14rem] break-words">${esc(f.sum)}<br><span class="mono text-xs text-slate-500">${esc(f.loc)}</span></span><span class="text-xs text-slate-500">${fmt(a)} → ${fmt(b)}</span></summary>
          <div class="px-3 pb-3 space-y-1"><div class="text-xs text-slate-500">Métodos: ${esc(ms.join(', '))} · Arquivos: ${esc(fs.join(', '))}</div><div class="text-xs text-slate-500 break-all">Gerador: ${esc(f.ger)}</div><pre class="${pre}">${esc(f.c)}</pre></div></details>`;
      }).join('') + (G.length > 300 ? `<div class="text-xs text-slate-500 py-2">Mostrando 300 de ${G.length} causas. Refine os filtros.</div>` : '');
    } else {
      html = L.slice(0, 500).map(e => `<details class="${det}"><summary class="${sm}"><span class="text-xs text-slate-500">${fmt(e.dt)}</span>${badge(e.tipo)}<span class="flex-1 min-w-[14rem] break-words"><b>${esc(e.metodo)}</b> — ${esc(e.sum)}<br><span class="mono text-xs text-slate-500">${esc(e.loc)} · ${esc(e.file)}</span></span></summary><div class="px-3 pb-3"><pre class="${pre}">${esc(e.c)}</pre></div></details>`).join('')
        + (L.length > 500 ? `<div class="text-xs text-slate-500 py-2">Mostrando 500 de ${L.length} registros. Refine os filtros.</div>` : '');
    }
    out.innerHTML = html;
  }

  hist(L, mn, mx) {
    const h = $('[data-hist]', this.el), hl = $('[data-hl]', this.el); h.innerHTML = ''; hl.innerHTML = '';
    if (!mn) return;
    const day = (mx - mn) > 2 * 864e5, k = d => day ? d.toLocaleDateString('pt-BR') : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + String(d.getHours()).padStart(2, '0') + 'h';
    const b = {}; L.forEach(e => { if (e.dt) { const x = k(e.dt); b[x] = (b[x] || 0) + 1; } });
    const ks = Object.keys(b), M = Math.max(...Object.values(b));
    h.innerHTML = ks.map(x => `<i title="${x}: ${b[x]}" class="block flex-1 min-w-[8px] rounded-t-sm bg-teal-500" style="height:${Math.max(4, b[x] / M * 100)}%"></i>`).join('');
    hl.innerHTML = `<span>${ks[0]}</span><span>Registros por ${day ? 'dia' : 'hora'} (pico: ${M})</span><span>${ks[ks.length - 1]}</span>`;
  }

  flash(a, txt) { const b = $(`[data-a="${a}"]`, this.el), o = b.dataset.o || (b.dataset.o = b.textContent); b.textContent = txt; clearTimeout(b._t); b._t = setTimeout(() => (b.textContent = o), 1800); }

  async copySummary() {
    const Z = LogAnalyzerTool, L = this.filtered();
    const text = `Resumo de logs (${L.length} registros; ${this.files.map(f => f.name).join(', ')})\n\n` + this.groups(L).map(g => {
      const [a, b] = this.span(g);
      return `${g.length}x [${g[0].tipo}] ${g[0].sum}\n   Local: ${g[0].loc}\n   Métodos: ${[...new Set(g.map(e => e.metodo))].join(', ')}\n   Período: ${Z.fmt(a)} a ${Z.fmt(b)}`;
    }).join('\n\n');
    try { await navigator.clipboard.writeText(text); }
    catch (e) { const t = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove(); }
    this.flash('cp', 'Copiado!');
  }

  exportCsv() {
    const Z = LogAnalyzerTool, L = this.filtered(), q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [['Data', 'Tipo', 'Método', 'Resumo', 'Local', 'Arquivo', 'Conteúdo'].join(';')]
      .concat(L.map(e => [Z.fmt(e.dt), e.tipo, e.metodo, e.sum, e.loc, e.file, e.c].map(q).join(';')));
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'logs-filtrados.csv' });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.flash('csv', 'Gerado!');
  }
}

DevTools.register(new LogAnalyzerTool());
