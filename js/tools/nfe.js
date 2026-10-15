/* ====================================================================
 * Ferramenta 3: Consulta NF-e / NFC-e
 *  - Valida chaves de acesso (estrutura, UF, CNPJ, modelo, dígito verificador)
 *  - Abre o portal de consulta certo (copiando a chave para a área de transferência)
 *  - Mostra um resumo da nota a partir do XML (colado ou arrastado)
 * Não consulta a SEFAZ: isso exige certificado digital ou captcha.
 * ==================================================================== */

const UF_COD = { 11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF' };

const ENCAT_URL = 'https://nfce.encat.org/consulte-sua-nota-qr-code-versao-2-0/';
const NFE_NACIONAL_URL = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=';

// Endereços de consulta por chave da NFC-e (campo urlChave). Conferidos em 15/10/2026 em fontes públicas
// (não direto na tabela do ENCAT, que bloqueia leitura automática) e as fontes divergem entre si.
// Confira na lista oficial do ENCAT e corrija na tela ("Editar links"). PI, PR e SC ficaram sem endereço confirmado.
const NFCE_URLS = {
  AC: 'https://www.sefaznet.ac.gov.br/nfce/consulta', AL: 'https://www.sefaz.al.gov.br/nfce/consulta',
  AM: 'https://www.sefaz.am.gov.br/nfce/consulta', AP: 'https://www.sefaz.ap.gov.br/nfce/consulta',
  BA: 'https://www.sefaz.ba.gov.br/nfce/consulta', CE: 'https://www.sefaz.ce.gov.br/nfce/consulta',
  DF: 'https://www.fazenda.df.gov.br/nfce/consulta', ES: 'https://www.sefaz.es.gov.br/nfce/consulta',
  GO: 'https://www.sefaz.go.gov.br/nfce/consulta', MA: 'https://www.sefaz.ma.gov.br/nfce/consulta',
  MG: 'http://nfce.fazenda.mg.gov.br/portalnfce', MS: 'https://www.dfe.ms.gov.br/nfce/consulta',
  MT: 'http://www.sefaz.mt.gov.br/nfce/consultanfce', PA: 'https://www.sefa.pa.gov.br/nfce/consulta',
  PB: 'https://www.receita.pb.gov.br/nfce/consulta', PE: 'https://nfce.sefaz.pe.gov.br/nfce/consulta',
  RJ: 'https://www.fazenda.rj.gov.br/nfce/consulta', RN: 'https://www.set.rn.gov.br/nfce/consulta',
  RO: 'https://www.sefin.ro.gov.br/nfce/consulta', RR: 'https://www.sefaz.rr.gov.br/nfce/consulta',
  RS: 'https://www.sefaz.rs.gov.br/nfce/consulta', SE: 'http://www.nfce.se.gov.br/nfce/consulta',
  SP: 'https://www.nfce.fazenda.sp.gov.br/consulta', TO: 'https://www.sefaz.to.gov.br/nfce/consulta'
};
const NFCE_LS_KEY = 'devtools.nfce.urls'; // edições feitas na tela (localStorage deste navegador)

class NfeTool {
  id = 'nfe';
  title = 'Consulta NF-e / NFC-e';
  icon = 'file-search';
  rows = []; xmls = [];

  static esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  static PAG = { '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão de crédito', '04': 'Cartão de débito', '05': 'Crédito loja', '10': 'Vale alimentação', '11': 'Vale refeição', '12': 'Vale presente', '13': 'Vale combustível', '15': 'Boleto', '16': 'Depósito', '17': 'PIX', '18': 'Transferência', '19': 'Fidelidade', '90': 'Sem pagamento', '99': 'Outros' };

  // ---------- Validação ----------
  // Dígito verificador (módulo 11). Cada caractere vale ASCII − 48, o que cobre também o CNPJ alfanumérico.
  static dv(s) {
    let p = 2, soma = 0;
    for (let i = s.length - 1; i >= 0; i--) { soma += (s.charCodeAt(i) - 48) * p; p = p === 9 ? 2 : p + 1; }
    const r = soma % 11; return r < 2 ? 0 : 11 - r;
  }
  static cnpjOk(c) {
    if (/^(.)\1+$/.test(c)) return false;
    const calc = n => { let p = n - 7, s = 0; for (let i = 0; i < n; i++) { s += (c.charCodeAt(i) - 48) * p; p = p === 2 ? 9 : p - 1; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }
  static analisar(raw) {
    const k = raw.toUpperCase().replace(/[^0-9A-Z]/g, ''), d = (a, b) => k.slice(a, b), r = { key: k };
    if (k.length !== 44) return { ...r, erro: `tem ${k.length} caracteres (esperado: 44)` };
    Object.assign(r, { uf: UF_COD[d(0, 2)], mes: d(4, 6), ano: '20' + d(2, 4), cnpj: d(6, 20), mod: d(20, 22), serie: d(22, 25), num: d(25, 34), tp: d(34, 35) });
    if (!/^\d{6}$/.test(d(0, 6)) || !/^\d{24}$/.test(d(20, 44))) r.erro = 'há letras fora do campo do CNPJ';
    else if (!r.uf) r.erro = `código de UF ${d(0, 2)} inexistente`;
    else if (+r.mes < 1 || +r.mes > 12) r.erro = `mês de emissão inválido (${r.mes})`;
    else if (!['55', '65'].includes(r.mod)) r.erro = `modelo ${r.mod} não é NF-e (55) nem NFC-e (65)`;
    else if (!NfeTool.cnpjOk(r.cnpj)) r.erro = 'CNPJ do emitente inválido';
    else if (NfeTool.dv(d(0, 43)) !== +k[43]) r.erro = 'dígito verificador incorreto';
    r.ok = !r.erro; return r;
  }

  // ---------- Links dos portais ----------
  overrides() { try { return JSON.parse(localStorage.getItem(NFCE_LS_KEY)) || {}; } catch (e) { return {}; } }
  urls() { return { ...NFCE_URLS, ...this.overrides() }; }

  mount(el) {
    const ta = 'w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12161d] p-2 text-sm mono';
    el.innerHTML = `
      <div class="max-w-6xl mx-auto p-4 space-y-4">
        <div class="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button data-tab="keys" class="px-3 py-2 text-sm font-medium border-b-2">Chaves de acesso</button>
          <button data-tab="xml" class="px-3 py-2 text-sm font-medium border-b-2">Nota (XML)</button>
        </div>
        <div data-msg class="text-sm min-h-[1.25rem]"></div>
        <section data-sec="keys" class="space-y-3">
          <textarea data-keys rows="5" class="${ta}" placeholder="Cole até 10 chaves de NF-e/NFC-e, uma por linha (espaços e pontos são ignorados)"></textarea>
          <div class="flex flex-wrap gap-2 items-center">
            <button data-a="validate" class="${BTN_PRIMARY}">Validar chaves</button>
            <button data-a="clearkeys" class="${BTN}">Limpar</button>
            <a href="${ENCAT_URL}" target="_blank" rel="noopener" class="ml-auto text-xs underline">Lista oficial de portais (ENCAT)</a>
          </div>
          <div class="overflow-x-auto"><table data-table class="w-full text-sm"></table></div>
          <details class="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <summary class="cursor-pointer text-sm font-medium">Editar links dos portais NFC-e</summary>
            <div data-links class="grid sm:grid-cols-2 gap-2 mt-3"></div>
            <div class="flex items-center gap-3 mt-3"><button data-a="reset" class="${BTN}">Restaurar padrão</button>
              <span class="text-xs text-slate-500">As edições ficam salvas só neste navegador, para este endereço do site.</span></div>
          </details>
        </section>
        <section data-sec="xml" class="hidden space-y-3">
          <div data-drop class="rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm">
            Arraste até 10 arquivos .xml aqui ou <button data-a="pick" class="underline">escolha os arquivos</button>
            <input data-file type="file" accept=".xml,text/xml" multiple hidden>
          </div>
          <textarea data-xml rows="5" class="${ta}" placeholder="...ou cole o XML da nota aqui (pode colar mais de um)"></textarea>
          <div class="flex gap-2"><button data-a="show" class="${BTN_PRIMARY}">Visualizar</button><button data-a="clearxml" class="${BTN}">Limpar</button></div>
          <div data-notes class="space-y-3"></div>
        </section>
      </div>`;
    this.el = el;
    const acts = {
      validate: () => this.validar(), clearkeys: () => { $('[data-keys]', el).value = ''; this.rows = []; this.renderRows(); this.msg('', true); },
      reset: () => { localStorage.removeItem(NFCE_LS_KEY); this.renderLinks(); this.msg('Links restaurados para o padrão.', true); },
      pick: () => $('[data-file]', el).click(), show: () => this.showXmls(this.split($('[data-xml]', el).value)),
      clearxml: () => { $('[data-xml]', el).value = ''; $('[data-notes]', el).innerHTML = ''; this.xmls = []; this.msg('', true); }
    };
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab],[data-a],[data-k],[data-f]'); if (!t) return;
      if (t.dataset.tab) this.tab(t.dataset.tab);
      else if (t.dataset.a) acts[t.dataset.a]();
      else if (t.dataset.k) this.consultar(+t.dataset.k);
      else this.abrirFormatador(+t.dataset.f);
    });
    el.addEventListener('change', e => { // salva edição de link
      const i = e.target.closest('[data-uf]'); if (!i) return;
      const ov = this.overrides(), v = i.value.trim();
      if (v === (NFCE_URLS[i.dataset.uf] || '')) delete ov[i.dataset.uf]; else ov[i.dataset.uf] = v;
      localStorage.setItem(NFCE_LS_KEY, JSON.stringify(ov));
      this.msg(`Link de ${i.dataset.uf} salvo neste navegador.`, true);
    });
    const drop = $('[data-drop]', el), file = $('[data-file]', el);
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('border-teal-500'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('border-teal-500'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('border-teal-500'); this.lerArquivos(e.dataTransfer.files); });
    file.addEventListener('change', () => { this.lerArquivos(file.files); file.value = ''; });
    this.renderLinks(); this.tab('keys');
  }

  tab(n) {
    this.el.querySelectorAll('[data-sec]').forEach(s => s.classList.toggle('hidden', s.dataset.sec !== n));
    this.el.querySelectorAll('[data-tab]').forEach(b => {
      const on = b.dataset.tab === n;
      b.classList.toggle('border-teal-500', on); b.classList.toggle('border-transparent', !on);
    });
  }

  msg(text, ok) {
    const m = $('[data-msg]', this.el);
    m.textContent = text;
    m.className = 'text-sm min-h-[1.25rem] ' + (ok === 'warn' ? 'text-amber-600 dark:text-amber-400' : ok ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400');
  }

  renderLinks() {
    const u = this.urls(), e = NfeTool.esc;
    $('[data-links]', this.el).innerHTML = Object.entries(UF_COD).sort((a, b) => a[1].localeCompare(b[1])).map(([, uf]) =>
      `<label class="flex items-center gap-2 text-xs"><span class="w-6 font-semibold">${uf}</span>
        <input data-uf="${uf}" value="${e(u[uf] || '')}" placeholder="sem endereço cadastrado" class="flex-1 min-w-0 rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 mono"></label>`).join('');
  }

  validar() {
    const linhas = $('[data-keys]', this.el).value.split('\n').filter(l => l.trim());
    if (!linhas.length) return this.msg('Cole ao menos uma chave.', false);
    this.rows = linhas.slice(0, 10).map(NfeTool.analisar);
    this.renderRows();
    const ok = this.rows.filter(r => r.ok).length;
    this.msg(`${ok} de ${this.rows.length} chave(s) válida(s).` + (linhas.length > 10 ? ` Só as 10 primeiras foram analisadas (${linhas.length} coladas).` : ''), ok === this.rows.length ? true : 'warn');
  }

  renderRows() {
    const c = 'py-2 pr-3 whitespace-nowrap', e = NfeTool.esc;
    const cnpj = s => s.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
    $('[data-table]', this.el).innerHTML = !this.rows.length ? '' :
      `<thead><tr class="text-left text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">${['Chave', 'Situação da chave', 'UF', 'Tipo', 'Emissão', 'CNPJ emitente', 'Série / Nº', ''].map(h => `<th class="py-2 pr-3">${h}</th>`).join('')}</tr></thead><tbody>` +
      this.rows.map((r, i) => `<tr class="border-b border-slate-200 dark:border-slate-800">
        <td class="${c} mono text-xs">${e(r.key.replace(/(.{4})/g, '$1 ').trim())}</td>
        <td class="py-2 pr-3 ${r.ok ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'}">${r.ok ? '✔ válida' : '✖ ' + e(r.erro)}</td>
        <td class="${c}">${e(r.uf || '-')}</td><td class="${c}">${r.mod ? (r.mod === '65' ? 'NFC-e' : r.mod === '55' ? 'NF-e' : 'mod. ' + e(r.mod)) : '-'}</td>
        <td class="${c}">${r.ano ? e(r.mes + '/' + r.ano) : '-'}</td><td class="${c} mono text-xs">${r.cnpj ? e(cnpj(r.cnpj)) : '-'}</td>
        <td class="${c}">${r.serie ? +r.serie + ' / ' + +r.num : '-'}</td>
        <td class="${c}"><button data-k="${i}" ${r.ok ? '' : 'disabled title="Corrija a chave antes de consultar"'} class="${BTN} disabled:opacity-40 disabled:cursor-not-allowed">Consultar</button></td></tr>`).join('') + '</tbody>';
  }

  // Copia a chave e abre o portal: o portal é de outro site, então não dá para preencher o campo nem passar pelo captcha.
  consultar(i) {
    const r = this.rows[i], nfce = r.mod === '65';
    let url = nfce ? this.urls()[r.uf] : NFE_NACIONAL_URL, aviso = '';
    if (!url) { url = ENCAT_URL; aviso = ` Sem endereço cadastrado para ${r.uf}: abri a lista do ENCAT (cadastre o link em "Editar links").`; }
    navigator.clipboard.writeText(r.key).catch(() => {});
    window.open(url, '_blank', 'noopener');
    this.msg(`Chave copiada: cole no campo do portal ${nfce ? 'da SEFAZ-' + r.uf : 'nacional da NF-e'}.${aviso}`, aviso ? 'warn' : true);
  }

  // ---------- Visualizador de XML ----------
  split(text) {
    const t = text.trim(); if (!t) return [];
    return t.split(t.includes('<?xml') ? /(?=<\?xml)/ : /(?=<nfeProc[\s>])/).map(s => s.trim()).filter(Boolean);
  }

  async lerArquivos(files) {
    const lista = [...files].filter(f => /\.xml$/i.test(f.name) || f.type.includes('xml'));
    if (!lista.length) return this.msg('Nenhum arquivo .xml encontrado.', false);
    this.showXmls(await Promise.all(lista.slice(0, 10).map(f => f.text())), lista.length);
  }

  showXmls(list, total) {
    const out = $('[data-notes]', this.el); out.innerHTML = ''; this.xmls = [];
    if (!list.length) return this.msg('Cole ou arraste o XML da nota.', false);
    list.slice(0, 10).forEach(x => {
      try { out.insertAdjacentHTML('beforeend', this.card(x, this.xmls.push(x) - 1)); }
      catch (err) { out.insertAdjacentHTML('beforeend', `<div class="text-sm text-red-600 dark:text-red-400">✖ ${NfeTool.esc(err.message)}</div>`); }
    });
    const n = total || list.length;
    this.msg(n > 10 ? `Só os 10 primeiros arquivos foram exibidos (${n} enviados).` : '', 'warn');
  }

  card(xml, idx) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML inválido: não foi possível ler o conteúdo.');
    const e = NfeTool.esc, first = (p, t, n = 0) => (p && p.getElementsByTagName(t)[n]) || null;
    const g = (p, t) => { const x = first(p, t); return x ? x.textContent.trim() : ''; };
    const inf = first(doc, 'infNFe'), ev = first(doc, 'infEvento');
    if (!inf && !ev) throw new Error('Não encontrei <infNFe> nem <infEvento>: não parece uma NF-e/NFC-e.');
    const OK = 'bg-teal-600/15 text-teal-700 dark:text-teal-300', WARN = 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
    const badge = (t, cls) => `<span class="px-2 py-0.5 rounded text-xs font-semibold ${cls}">${e(t)}</span>`;
    const btn = `<button data-f="${idx}" class="${BTN}">Abrir no formatador</button>`;
    const box = (head, body) => `<details open class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161d]"><summary class="cursor-pointer p-3 text-sm font-medium flex flex-wrap items-center gap-2">${head}</summary><div class="p-3 pt-0 space-y-3">${body}</div></details>`;
    if (!inf) { // XML de evento (cancelamento, carta de correção etc.)
      const ret = first(doc, 'infEvento', 1) || ev, ok = ['135', '136', '155'].includes(g(ret, 'cStat'));
      return box(`${badge(ok ? 'Evento registrado' : 'Evento: status ' + g(ret, 'cStat'), ok ? OK : WARN)} ${e(g(ev, 'descEvento') || 'Evento ' + g(ev, 'tpEvento'))}`,
        `<p class="text-sm mono break-all">Chave: ${e(g(ev, 'chNFe'))}</p><p class="text-sm">Protocolo ${e(g(ret, 'nProt'))}: ${e(g(ret, 'xMotivo'))}</p>${btn}`);
    }
    const ide = first(inf, 'ide'), emit = first(inf, 'emit'), dest = first(inf, 'dest'), tot = first(inf, 'ICMSTot'), prot = first(doc, 'infProt');
    const tipo = g(ide, 'mod') === '65' ? 'NFC-e' : 'NF-e', cs = g(prot, 'cStat');
    const st = !prot ? badge('Sem protocolo', WARN) : ['100', '150'].includes(cs) ? badge('Autorizada', OK) : badge('Status ' + cs, WARN);
    const money = v => v === '' ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const num = v => v === '' ? '-' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const end = ['xLgr', 'nro', 'xBairro', 'xMun', 'UF'].map(t => g(first(emit, 'enderEmit'), t)).filter(Boolean).join(', ');
    const emi = g(ide, 'dhEmi') || g(ide, 'dEmi'), dt = !emi ? '-' : emi.length > 10 ? new Date(emi).toLocaleString('pt-BR') : emi;
    const itens = [...inf.getElementsByTagName('det')].map(d => { const p = first(d, 'prod'); return `<tr class="border-b border-slate-200 dark:border-slate-800"><td class="py-1 pr-2">${e(d.getAttribute('nItem'))}</td><td class="pr-2">${e(g(p, 'cProd'))}</td><td class="pr-2">${e(g(p, 'xProd'))}</td><td class="pr-2 text-right whitespace-nowrap">${num(g(p, 'qCom'))} ${e(g(p, 'uCom'))}</td><td class="pr-2 text-right">${num(g(p, 'vUnCom'))}</td><td class="text-right">${money(g(p, 'vProd'))}</td></tr>`; }).join('');
    const pagos = [...inf.getElementsByTagName('detPag')].map(d => `${e(NfeTool.PAG[g(d, 'tPag')] || 'Pagamento ' + g(d, 'tPag'))}: ${money(g(d, 'vPag'))}`).join(' · ') || '-';
    const amb = g(ide, 'tpAmb') === '2' ? ' ' + badge('Homologação', WARN) : '';
    return box(`${st}${amb} ${tipo} nº ${e(g(ide, 'nNF'))} série ${e(g(ide, 'serie'))} · ${e(g(emit, 'xNome'))} · ${money(g(tot, 'vNF'))}`, `
      <div class="grid sm:grid-cols-2 gap-3 text-sm">
        <div><b>Emitente</b><br>${e(g(emit, 'xNome'))}<br>CNPJ ${e(g(emit, 'CNPJ'))} · IE ${e(g(emit, 'IE') || '-')}<br>${e(end)}</div>
        <div><b>Destinatário</b><br>${e(g(dest, 'xNome') || 'Consumidor não identificado')}<br>${e(g(dest, 'CNPJ') || g(dest, 'CPF') || g(dest, 'idEstrangeiro') || '-')}</div>
        <div><b>Emissão</b><br>${e(dt)} · ${e(g(ide, 'natOp'))}</div>
        <div><b>Protocolo</b><br>${prot ? `${e(g(prot, 'nProt'))}: ${e(cs)} ${e(g(prot, 'xMotivo'))}<br>${e(g(prot, 'dhRecbto'))}` : 'XML sem protocolo de autorização'}</div>
      </div>
      <p class="text-xs mono break-all">Chave: ${e((inf.getAttribute('Id') || '').replace(/^NFe/, ''))}</p>
      <div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800"><th class="py-1">#</th><th>Cód.</th><th>Produto</th><th class="text-right">Qtd.</th><th class="text-right">Unit.</th><th class="text-right">Total</th></tr></thead><tbody>${itens}</tbody></table></div>
      <p class="text-sm">Produtos ${money(g(tot, 'vProd'))} · Desconto ${money(g(tot, 'vDesc'))} · <b>Total ${money(g(tot, 'vNF'))}</b></p>
      <p class="text-sm">Pagamento: ${pagos}</p>${btn}`);
  }

  // Envia o XML para o Formatador JSON/XML (em um painel novo) e mostra aquela ferramenta.
  abrirFormatador(i) {
    const f = DevTools.tools.find(t => t.id === 'json-xml');
    if (!f) return this.msg('Formatador JSON/XML não encontrado.', false);
    App.show('json-xml');
    f.loadText(this.xmls[i], 'nota-' + (i + 1));
  }
}

DevTools.register(new NfeTool());
