/* ---------- Ferramenta 1: Formatador JSON / XML ---------- */
class JsonXmlTool {
  id = 'json-xml';
  title = 'Formatador JSON / XML';
  icon = 'braces';
  panels = []; active = 0; counter = 0; diffOn = false;

  // Painel selecionado: format(), decodeB64(), clear() etc. agem sempre nele.
  get panel() { return this.panels[this.active]; }
  get editor() { return this.panel && this.panel.editor; }
  get lang() { return this.panel ? this.panel.lang : 'json'; }
  set lang(v) { if (this.panel) this.panel.lang = v; }

  mount(el) {
    el.innerHTML = `
      <div class="h-full flex flex-col p-4 gap-3">
        <div class="flex flex-wrap gap-2 items-center">
          <button data-a="json" class="${BTN_PRIMARY}">Formatar JSON</button>
          <button data-a="xml" class="${BTN_PRIMARY}">Formatar XML</button>
          <button data-a="b64" class="${BTN_PRIMARY}">Decodificar Base64</button>
          <button data-a="clear" class="${BTN}">Limpar</button>
          <span class="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></span>
          <button data-a="copy" class="${BTN} flex items-center gap-2"><i data-lucide="copy" class="w-4 h-4"></i><span data-copy-label>Copiar</span></button>
          <button data-a="download" class="${BTN} flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i>Baixar Arquivo</button>
          <span class="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></span>
          <button data-a="add" class="${BTN}">+ Painel</button>
          <button data-a="remove" class="${BTN}">− Painel</button>
          <span data-diffinfo class="ml-auto text-xs text-amber-600 dark:text-amber-400"></span>
          <button data-a="diff" class="${BTN} flex items-center gap-2"><i data-lucide="git-compare" class="w-4 h-4"></i>Destacar diferenças</button>
        </div>
        <div data-status class="text-sm min-h-[1.25rem]"></div>
        <div data-panels class="flex-1 min-h-0 flex gap-3"></div>
      </div>`;
    this.el = el;
    this.status = $('[data-status]', el);
    if (!document.getElementById('dx-style')) {
      const st = document.createElement('style'); st.id = 'dx-style';
      st.textContent = '.dx-del{background:rgba(239,68,68,.28)}.dx-add{background:rgba(34,197,94,.28)}';
      document.head.appendChild(st);
    }
    const acts = {
      json: () => this.format('json'), xml: () => this.format('xml'), b64: () => this.decodeB64(),
      clear: () => this.clear(), copy: () => this.copy(), download: () => this.download(),
      add: () => this.addPanel(), remove: () => this.removePanel(), diff: () => this.toggleDiff()
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) acts[b.dataset.a](); });
    this.addPanel('{"exemplo":true,"itens":[1,2,3]}');
    this.addPanel();
    this.select(this.panels[0]);
  }

  // Carrega o Monaco uma única vez e compartilha entre todos os painéis (null = usar textarea).
  static loadMonaco() {
    if (JsonXmlTool._mp) return JsonXmlTool._mp;
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min';
    return (JsonXmlTool._mp = new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), 8000);
      try {
        require.config({ paths: { vs: base + '/vs' } });
        // Worker proxy: permite carregar os workers do Monaco a partir do CDN.
        window.MonacoEnvironment = { getWorkerUrl: () => URL.createObjectURL(new Blob([
          `self.MonacoEnvironment={baseUrl:'${base}/'};importScripts('${base}/vs/base/worker/workerMain.js');`
        ], { type: 'text/javascript' })) };
        // O CSS do Monaco é buscado e injetado como <style> (links externos de CSS podem ser bloqueados).
        fetch(base + '/vs/editor/editor.main.min.css')
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(css => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); })
          .catch(() => {})
          .finally(() => require(['vs/editor/editor.main'], () => { clearTimeout(timer); resolve(window.monaco); }, () => resolve(null)));
      } catch (e) { clearTimeout(timer); resolve(null); }
    }));
  }

  addPanel(value) {
    if (this.panels.length >= 4) return this.msg('Limite de 4 painéis lado a lado.', 'warn');
    const n = ++this.counter;
    const wrap = document.createElement('div');
    wrap.className = 'flex-1 min-w-0 flex flex-col rounded-lg border-2 border-transparent p-1';
    wrap.innerHTML = `
      <div class="flex items-center gap-2 mb-1 px-1">
        <input data-title value="Painel ${n}" aria-label="Nome do painel" class="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none border-b border-transparent focus:border-teal-500">
        <span data-badge class="hidden px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-600/10 text-teal-700 dark:text-teal-300"></span>
      </div>
      <div data-host class="flex-1 min-h-0 rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-[#1e1e1e]"></div>`;
    $('[data-panels]', this.el).appendChild(wrap);
    const p = { wrap, host: $('[data-host]', wrap), titleEl: $('[data-title]', wrap), badgeEl: $('[data-badge]', wrap), lang: 'json', editor: null, mon: null };
    this.panels.push(p);
    wrap.addEventListener('mousedown', () => this.select(p), true);
    p.titleEl.addEventListener('focus', () => this.select(p));
    this.select(p);
    JsonXmlTool.loadMonaco().then(m => this.buildEditor(p, m, value));
  }

  buildEditor(p, m, value) {
    if (!p.wrap.isConnected) return; // painel removido enquanto o Monaco carregava
    if (m) {
      const ed = m.editor.create(p.host, {
        value: value || '', language: 'json', automaticLayout: true, theme: App.isDark() ? 'vs-dark' : 'vs',
        minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false
      });
      const coll = ed.createDecorationsCollection([]);
      ed.onDidFocusEditorText(() => this.select(p));
      ed.onDidChangeModelContent(() => this.scheduleDiff());
      p.mon = ed;
      p.editor = {
        getValue: () => ed.getValue(), setValue: v => ed.setValue(v), layout: () => ed.layout(),
        setLang: l => m.editor.setModelLanguage(ed.getModel(), l),
        decorate: items => coll.set(items.map(i => ({ range: new m.Range(i.line, 1, i.line, 1), options: { isWholeLine: true, className: i.cls } })))
      };
    } else { // sem Monaco: textarea simples (sem realce de diferenças)
      const ta = document.createElement('textarea');
      ta.className = 'fallback-editor mono'; ta.spellcheck = false; ta.value = value || '';
      ta.placeholder = 'Cole seu JSON ou XML aqui...';
      ta.addEventListener('focus', () => this.select(p));
      ta.addEventListener('input', () => this.scheduleDiff());
      p.host.appendChild(ta);
      p.editor = { getValue: () => ta.value, setValue: v => { ta.value = v; this.scheduleDiff(); }, setLang() {}, layout() {}, decorate() {} };
    }
  }

  select(p) {
    this.active = this.panels.indexOf(p);
    this.panels.forEach(q => {
      const on = q === p;
      q.wrap.classList.toggle('border-teal-500', on);
      q.wrap.classList.toggle('border-transparent', !on);
    });
    if (this.diffOn) this.updateDiff();
  }

  removePanel() {
    if (this.panels.length <= 1) return this.msg('É preciso manter ao menos um painel.', 'warn');
    const p = this.panel;
    if (p.mon) { const md = p.mon.getModel(); p.mon.dispose(); md && md.dispose(); }
    p.wrap.remove();
    this.panels.splice(this.active, 1);
    this.select(this.panels[Math.min(this.active, this.panels.length - 1)]);
    this.msg('Painel removido.', true);
  }

  async copy() {
    if (!this.editor) return;
    const text = this.editor.getValue();
    if (!text.trim()) return this.msg('Nada para copiar: o painel está vazio.', false);
    try { await navigator.clipboard.writeText(text); }
    catch (e) { // fallback para ambientes onde a Clipboard API é bloqueada
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove();
    }
    const lbl = $('[data-copy-label]', this.el);
    lbl.textContent = 'Copiado!';
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => (lbl.textContent = 'Copiar'), 2000);
    this.msg(`Conteúdo de "${this.panel.titleEl.value}" copiado.`, true);
  }

  // ---------- Destaque de diferenças (só quando o botão está ativo) ----------
  toggleDiff() {
    this.diffOn = !this.diffOn;
    ['bg-amber-500/20', 'border-amber-500'].forEach(c => $('[data-a="diff"]', this.el).classList.toggle(c, this.diffOn));
    this.updateDiff();
  }

  scheduleDiff() {
    if (!this.diffOn) return;
    clearTimeout(this.diffTimer);
    this.diffTimer = setTimeout(() => this.updateDiff(), 300);
  }

  // Compara o painel selecionado com o vizinho da direita (ou da esquerda, se for o último).
  updateDiff() {
    const info = $('[data-diffinfo]', this.el);
    this.panels.forEach(p => p.editor && p.editor.decorate([]));
    if (!this.diffOn) { info.textContent = ''; return; }
    if (this.panels.length < 2) { info.textContent = 'Adicione outro painel para comparar.'; return; }
    const j = this.active < this.panels.length - 1 ? this.active + 1 : this.active - 1;
    const a = this.panels[Math.min(this.active, j)], b = this.panels[Math.max(this.active, j)];
    if (!a.editor || !b.editor) return;
    const lines = e => e.getValue().split('\n').map(l => l.trimEnd());
    const { del, add } = JsonXmlTool.lineDiff(lines(a.editor), lines(b.editor));
    a.editor.decorate(del.map(line => ({ line, cls: 'dx-del' })));
    b.editor.decorate(add.map(line => ({ line, cls: 'dx-add' })));
    const nomes = `${a.titleEl.value} × ${b.titleEl.value}`;
    info.textContent = del.length || add.length
      ? `${nomes}: ${del.length} linha(s) só à esquerda (vermelho), ${add.length} só à direita (verde)`
      : `${nomes}: conteúdos idênticos`;
  }

  // Diferença por linhas (LCS). Retorna os números (base 1) das linhas exclusivas de cada lado.
  static lineDiff(A, B) {
    const del = [], add = [];
    if (A.length * B.length > 4e6) { // textos muito grandes: comparação simplificada por conjunto de linhas
      const sa = new Set(A), sb = new Set(B);
      A.forEach((l, i) => { if (!sb.has(l)) del.push(i + 1); });
      B.forEach((l, i) => { if (!sa.has(l)) add.push(i + 1); });
      return { del, add };
    }
    const n = A.length, m = B.length, w = m + 1, t = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        t[i * w + j] = A[i] === B[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { i++; j++; }
      else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) del.push(++i);
      else add.push(++j);
    }
    while (i < n) del.push(++i);
    while (j < m) add.push(++j);
    return { del, add };
  }

  setTheme(dark) { if (window.monaco) monaco.editor.setTheme(dark ? 'vs-dark' : 'vs'); }
  onShow() { this.panels.forEach(p => p.editor && p.editor.layout()); }

  msg(text, ok) {
    this.status.textContent = text;
    const color = ok === 'warn' ? 'text-amber-600 dark:text-amber-400' : ok ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400';
    this.status.className = 'text-sm min-h-[1.25rem] ' + color;
  }

  // Identifica o formato real do conteúdo, independentemente do botão clicado.
  detect(s) {
    const c = s[0];
    if (c === '<') return 'xml';
    if (c === '{' || c === '[' || c === '"') return 'json';
    try { JSON.parse(s); return 'json'; } catch (e) { return null; }
  }

  badge(kind) {
    const b = this.panel && this.panel.badgeEl; if (!b) return;
    b.textContent = kind ? kind.toUpperCase() + ' detectado' : '';
    b.classList.toggle('hidden', !kind);
  }

  spotlight(kind) { // destaca por 2,5 s o botão do formato identificado
    const btn = $(`[data-a="${kind}"]`, this.el);
    const ring = ['ring-2', 'ring-amber-400', 'ring-offset-2', 'dark:ring-offset-[#0e1116]'];
    btn.classList.add(...ring);
    setTimeout(() => btn.classList.remove(...ring), 2500);
  }

  format(kind) {
    if (!this.editor) return;
    const src = this.editor.getValue().trim();
    if (!src) return this.msg('O editor está vazio. Cole um conteúdo para formatar.', false);
    const real = this.detect(src) || kind;
    const swapped = real !== kind;
    const aviso = swapped ? `Você clicou em ${kind.toUpperCase()}, mas o conteúdo é ${real.toUpperCase()}. ` : '';
    try {
      const out = real === 'json' ? JSON.stringify(JSON.parse(src), null, 2) : this.prettyXml(src);
      this.editor.setValue(out); this.editor.setLang(real); this.lang = real;
      this.badge(real);
      if (swapped) { this.spotlight(real); this.msg(aviso + `Formatado como ${real.toUpperCase()}.`, 'warn'); }
      else this.msg(real.toUpperCase() + ' formatado com sucesso.', true);
    } catch (e) {
      this.badge(real);
      this.msg(aviso + (real === 'json' ? this.ptJson(e, src) : this.ptXml(e.message)), false);
    }
  }

  // Tradução das mensagens de erro do navegador (Chrome, Firefox e Safari).
  ptJson(e, src) {
    const m = e.message;
    let pos = (/position (\d+)/.exec(m) || [])[1];
    let line = (/line (\d+)/.exec(m) || [])[1], col = (/column (\d+)/.exec(m) || [])[1];
    if (pos !== undefined && !line) {
      const antes = src.slice(0, +pos).split('\n');
      line = antes.length; col = antes[antes.length - 1].length + 1;
    }
    const tok = (/Unexpected token (?:'(.)'|(\S))/.exec(m) || []).slice(1).find(Boolean);
    let why = 'sintaxe inválida';
    if (/Unexpected end|end of data/i.test(m)) why = 'o JSON terminou antes da hora (falta fechar chave, colchete ou aspas)';
    else if (/after JSON/i.test(m)) why = 'há conteúdo extra após o fim do JSON';
    else if (/Expected property name|double-quoted property name/i.test(m)) why = 'esperava um nome de propriedade entre aspas duplas (vírgula sobrando no final?)';
    else if (/Expected ',' or '}'/i.test(m)) why = 'esperava "," ou "}" (falta uma vírgula?)';
    else if (/Expected ',' or '\]'/i.test(m)) why = 'esperava "," ou "]" (falta uma vírgula?)';
    else if (/Expected ':'/i.test(m)) why = 'esperava ":" depois do nome da propriedade';
    else if (/Unterminated string/i.test(m)) why = 'texto sem aspas de fechamento';
    else if (/Bad control character|control character/i.test(m)) why = 'caractere de controle inválido dentro de um texto (quebra de linha?)';
    else if (/Bad escaped/i.test(m)) why = 'sequência de escape inválida dentro de um texto';
    else if (tok) why = `caractere inesperado "${tok}"`;
    else if (/unexpected character/i.test(m)) why = 'caractere inesperado';
    return `JSON inválido${line ? ` (linha ${line}, coluna ${col})` : ''}: ${why}.`;
  }

  ptXml(text) {
    const t = text.replace(/\s+/g, ' ');
    const lc = /line (\d+) at column (\d+)/i.exec(t) || /Line Number (\d+), Column (\d+)/i.exec(t);
    const dict = [
      [/Opening and ending tag mismatch|mismatched tag/i, 'a tag de abertura não corresponde à tag de fechamento'],
      [/Extra content at the end/i, 'há conteúdo extra após o elemento raiz'],
      [/Premature end of data|unclosed token/i, 'o XML terminou antes de fechar todas as tags'],
      [/Start tag expected/i, 'o XML deve começar com uma tag "<"'],
      [/invalid element name|invalid token/i, 'nome de tag ou caractere inválido'],
      [/attributes construct error|mandates value for attribute|AttValue/i, 'atributo sem valor ou sem aspas'],
      [/redefined|duplicate attribute/i, 'atributo repetido na mesma tag'],
      [/EntityRef|undefined entity/i, 'entidade inválida (use &amp; no lugar de "&")'],
      [/Namespace prefix|prefix not bound/i, 'prefixo de namespace não declarado'],
      [/Document is empty|no root/i, 'documento sem elemento raiz']
    ];
    const why = (dict.find(([re]) => re.test(t)) || [])[1] || 'estrutura mal formada';
    return `XML inválido${lc ? ` (linha ${lc[1]}, coluna ${lc[2]})` : ''}: ${why}.`;
  }

  prettyXml(src) {
    const doc = new DOMParser().parseFromString(src, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(err.textContent);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const walk = (n, d) => {
      const pad = '  '.repeat(d);
      if (n.nodeType === 3) { const t = n.nodeValue.trim(); return t ? pad + esc(t) + '\n' : ''; }
      if (n.nodeType === 4) return pad + '<![CDATA[' + n.nodeValue + ']]>\n';
      if (n.nodeType === 8) return pad + '<!--' + n.nodeValue + '-->\n';
      if (n.nodeType !== 1) return '';
      const attrs = [...n.attributes].map(a => ` ${a.name}="${esc(a.value).replace(/"/g, '&quot;')}"`).join('');
      const kids = [...n.childNodes].filter(c => c.nodeType !== 3 || c.nodeValue.trim());
      if (!kids.length) return `${pad}<${n.nodeName}${attrs}/>\n`;
      if (kids.length === 1 && kids[0].nodeType === 3) return `${pad}<${n.nodeName}${attrs}>${esc(kids[0].nodeValue.trim())}</${n.nodeName}>\n`;
      return `${pad}<${n.nodeName}${attrs}>\n${kids.map(c => walk(c, d + 1)).join('')}${pad}</${n.nodeName}>\n`;
    };
    const decl = /^\s*<\?xml[^>]*\?>/.exec(src);
    return ((decl ? decl[0].trim() + '\n' : '') + walk(doc.documentElement, 0)).trimEnd();
  }

  // ---------- Base64 embutido ----------
  // Converte Base64 (inclusive base64url) para texto UTF-8; retorna null se não for Base64 válido.
  static b64ToText(s) {
    if (typeof s !== 'string') return null;
    const t = s.trim().replace(/\s+/g, '');
    if (t.length < 16 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(t)) return null;
    try {
      const b64 = t.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(t.length / 4) * 4, '=');
      return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    } catch (e) { return null; }
  }

  // Só considera "decodificado" se o resultado for JSON ou XML válido (evita falsos positivos).
  parseDecoded(text) {
    const s = text.trim();
    if (s[0] === '{' || s[0] === '[') { try { return { kind: 'json', value: JSON.parse(s) }; } catch (e) {} }
    if (s[0] === '<') { try { return { kind: 'xml', text: this.prettyXml(s) }; } catch (e) {} }
    return null;
  }

  // Percorre o JSON e troca cada campo Base64 pelo conteúdo decodificado (recursivo).
  expandB64(node, stats) {
    if (typeof node === 'string') {
      const txt = JsonXmlTool.b64ToText(node);
      const r = txt && this.parseDecoded(txt);
      if (!r) return node;
      stats.n++;
      return r.kind === 'json' ? this.expandB64(r.value, stats) : r.text;
    }
    if (Array.isArray(node)) return node.map(v => this.expandB64(v, stats));
    if (node && typeof node === 'object') {
      const o = {}; for (const k in node) o[k] = this.expandB64(node[k], stats); return o;
    }
    return node;
  }

  // Mesmo processo para XML: decodifica o texto das tags que contêm Base64.
  expandXmlB64(src, stats) {
    const doc = new DOMParser().parseFromString(src, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) throw new Error(err.textContent);
    const w = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_CDATA_SECTION);
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      const txt = JsonXmlTool.b64ToText(n.nodeValue);
      const r = txt && this.parseDecoded(txt);
      if (!r) return;
      stats.n++;
      n.nodeValue = '\n' + (r.kind === 'json' ? JSON.stringify(this.expandB64(r.value, stats), null, 2) : r.text) + '\n';
    });
    return this.prettyXml(new XMLSerializer().serializeToString(doc));
  }

  decodeB64() {
    if (!this.editor) return;
    const src = this.editor.getValue().trim();
    if (!src) return this.msg('O editor está vazio. Cole um conteúdo com Base64.', false);
    const kind = this.detect(src), stats = { n: 0 };
    try {
      let out, lang = kind || 'json';
      if (kind === 'json') out = JSON.stringify(this.expandB64(JSON.parse(src), stats), null, 2);
      else if (kind === 'xml') out = this.expandXmlB64(src, stats);
      else { // o conteúdo inteiro pode ser um único Base64
        const txt = JsonXmlTool.b64ToText(src);
        if (txt === null) return this.msg('Não encontrei Base64 para decodificar.', 'warn');
        const r = this.parseDecoded(txt); stats.n = 1;
        out = r ? (r.kind === 'json' ? JSON.stringify(r.value, null, 2) : r.text) : txt;
        lang = r ? r.kind : 'plaintext';
      }
      if (!stats.n) return this.msg('Nenhum campo Base64 com JSON ou XML dentro foi encontrado.', 'warn');
      this.editor.setValue(out); this.editor.setLang(lang); this.lang = lang === 'xml' ? 'xml' : 'json';
      this.badge(kind || lang);
      this.msg(`${stats.n} campo(s) Base64 decodificado(s) com sucesso.`, true);
    } catch (e) {
      this.msg(kind === 'xml' ? this.ptXml(e.message) : this.ptJson(e, src), false);
    }
  }

  clear() { this.editor && this.editor.setValue(''); this.msg('', true); this.badge(null); }

  download() {
    if (!this.editor) return;
    const content = this.editor.getValue();
    if (!content.trim()) return this.msg('Nada para baixar: o painel está vazio.', false);
    const ext = content.trim().startsWith('<') ? 'xml' : (this.lang === 'xml' ? 'xml' : 'json');
    const mime = ext === 'xml' ? 'application/xml' : 'application/json';
    const nome = (this.panel.titleEl.value || 'arquivo').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'arquivo';
    const url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nome + '.' + ext });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.msg('Arquivo ' + nome + '.' + ext + ' gerado.', true);
  }
}


DevTools.register(new JsonXmlTool());