/* ====================================================================
 * Ferramenta 4: Visualizador de JWT
 * Decodifica header e payload no próprio navegador (o token não sai da sua máquina).
 * A assinatura NÃO é verificada. Reaproveita o carregador do Monaco do formatador,
 * então js/tools/json-xml.js precisa ser carregado antes deste arquivo.
 * ==================================================================== */
class JwtTool {
  id = 'jwt';
  title = 'Visualizador de JWT';
  icon = 'key-round';
  payloadText = '';

  // Base64URL -> texto UTF-8
  static b64url(s) {
    const b = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)));
  }

  // Retorna null para entrada vazia e lança Error (em português) se o token for inválido.
  static decode(raw) {
    const t = raw.trim().replace(/^bearer\s+/i, '').replace(/["'\s]/g, '');
    if (!t) return null;
    const p = t.split('.');
    if (p.length < 2 || p.length > 3) throw new Error('Um JWT tem 3 partes separadas por ponto (header.payload.assinatura).');
    const parte = (i, nome) => {
      try { const v = JSON.parse(JwtTool.b64url(p[i])); if (v === null || typeof v !== 'object') throw 0; return v; }
      catch (e) { throw new Error(`O ${nome} não é um Base64URL com JSON válido.`); }
    };
    return { header: parte(0, 'header'), payload: parte(1, 'payload') };
  }

  // Duração legível com até 2 unidades (ex.: "2 h 5 min")
  static rel(ms) {
    let r = Math.abs(Math.round(ms / 1000)); const out = [];
    for (const [n, l] of [[86400, 'd'], [3600, 'h'], [60, 'min'], [1, 's']]) {
      if (r >= n) { out.push(Math.floor(r / n) + ' ' + l); r %= n; }
      if (out.length === 2) break;
    }
    return out.join(' ') || '0 s';
  }

  mount(el) {
    const box = 'rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-[#1e1e1e]';
    el.innerHTML = `
      <div class="h-full min-h-[560px] flex flex-col p-4 gap-3">
        <textarea data-token rows="4" spellcheck="false" placeholder="Cole o JWT aqui (aceita o prefixo &quot;Bearer &quot;)" class="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161d] p-2 text-sm mono"></textarea>
        <div class="flex flex-wrap gap-2 items-center">
          <button data-a="copy" class="${BTN}"><span data-copy-label>Copiar payload</span></button>
          <button data-a="clear" class="${BTN}">Limpar</button>
          <span class="text-xs text-slate-500">Decodificado no navegador. A assinatura não é verificada.</span>
        </div>
        <div data-status class="text-sm min-h-[1.25rem]"></div>
        <div class="flex-1 min-h-0 grid md:grid-cols-3 gap-3">
          <div class="flex flex-col gap-3">
            <div><div class="text-xs font-semibold mb-1 px-1">Header</div><div data-hdr class="h-36 ${box}"></div></div>
            <div><div class="text-xs font-semibold mb-1 px-1">Datas</div><div data-dates class="text-sm space-y-1 px-1"></div></div>
          </div>
          <div class="md:col-span-2 flex flex-col min-h-[320px]"><div class="text-xs font-semibold mb-1 px-1">Payload</div><div data-pay class="flex-1 min-h-0 ${box}"></div></div>
        </div>
      </div>`;
    this.el = el;
    this.hdr = this.viewer($('[data-hdr]', el));
    this.pay = this.viewer($('[data-pay]', el));
    const input = $('[data-token]', el);
    input.addEventListener('input', () => { clearTimeout(this.t); this.t = setTimeout(() => this.render(input.value), 200); });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'clear') { input.value = ''; this.render(''); } else this.copy();
    });
  }

  // Visualizador somente leitura: Monaco (cores e Ctrl+F) ou textarea se o Monaco não carregar.
  viewer(host) {
    const v = { text: '', ed: null, ta: null };
    v.set = t => {
      v.text = t;
      if (v.ed) { v.ed.setValue(t); v.ed.setScrollPosition({ scrollLeft: 0, scrollTop: 0 }); }
      else if (v.ta) v.ta.value = t;
    };
    v.layout = () => v.ed && v.ed.layout();
    JsonXmlTool.loadMonaco().then(m => {
      if (m) v.ed = m.editor.create(host, { value: v.text, language: 'json', readOnly: true, automaticLayout: true, theme: App.isDark() ? 'vs-dark' : 'vs', minimap: { enabled: false }, fontSize: 13, tabSize: 2, scrollBeyondLastLine: false });
      else { v.ta = Object.assign(document.createElement('textarea'), { readOnly: true, className: 'fallback-editor mono', value: v.text }); host.appendChild(v.ta); }
    });
    return v;
  }

  setTheme(dark) { if (window.monaco) monaco.editor.setTheme(dark ? 'vs-dark' : 'vs'); }
  onShow() { this.hdr && this.hdr.layout(); this.pay && this.pay.layout(); }

  msg(text, kind) {
    const s = $('[data-status]', this.el);
    s.textContent = text;
    s.className = 'text-sm min-h-[1.25rem] ' + (kind === 'warn' ? 'text-amber-600 dark:text-amber-400' : kind ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400');
  }

  render(raw) {
    const dates = $('[data-dates]', this.el);
    let tok;
    try { tok = JwtTool.decode(raw); } catch (e) {
      this.hdr.set(''); this.pay.set(''); this.payloadText = ''; dates.innerHTML = '';
      return this.msg('✖ ' + e.message, false);
    }
    if (!tok) { this.hdr.set(''); this.pay.set(''); this.payloadText = ''; dates.innerHTML = ''; return this.msg('', true); }
    this.payloadText = JSON.stringify(tok.payload, null, 2);
    this.hdr.set(JSON.stringify(tok.header, null, 2));
    this.pay.set(this.payloadText);

    const now = Date.now(), p = tok.payload;
    const fmt = s => new Date(s * 1000).toLocaleString('pt-BR');
    const when = s => { const d = s * 1000 - now; return (d > 0 ? 'em ' : 'há ') + JwtTool.rel(d); };
    const L = { exp: 'Expira (exp)', iat: 'Emitido (iat)', nbf: 'Válido a partir de (nbf)' };
    dates.innerHTML = Object.keys(L).filter(k => typeof p[k] === 'number').map(k =>
      `<div><span class="font-medium">${L[k]}:</span> ${fmt(p[k])} <span class="text-slate-500">(${when(p[k])})</span></div>`).join('') ||
      '<div class="text-slate-500">O payload não tem exp, iat nem nbf.</div>';

    if (typeof p.nbf === 'number' && p.nbf * 1000 > now) this.msg(`Token ainda não é válido: começa ${when(p.nbf)} (${fmt(p.nbf)}).`, 'warn');
    else if (typeof p.exp !== 'number') this.msg('Token sem data de expiração (exp).', 'warn');
    else if (p.exp * 1000 <= now) this.msg(`✖ Token expirado ${when(p.exp)} (${fmt(p.exp)}).`, false);
    else this.msg(`✔ Token dentro da validade: expira ${when(p.exp)} (${fmt(p.exp)}).`, true);
  }

  async copy() {
    if (!this.payloadText) return this.msg('Não há payload para copiar.', false);
    try { await navigator.clipboard.writeText(this.payloadText); }
    catch (e) { // fallback para ambientes onde a Clipboard API é bloqueada
      const t = Object.assign(document.createElement('textarea'), { value: this.payloadText });
      document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove();
    }
    const l = $('[data-copy-label]', this.el);
    l.textContent = 'Copiado!';
    clearTimeout(this.ct);
    this.ct = setTimeout(() => (l.textContent = 'Copiar payload'), 2000);
  }
}

DevTools.register(new JwtTool());
