/* ---------- Ferramenta 2: Gerador de CPF ---------- */
class CpfTool {
  id = 'cpf';
  title = 'Gerador de CPF';
  icon = 'contact';

  mount(el) {
    el.innerHTML = `
      <div class="h-full flex items-center justify-center p-6">
        <div class="w-full max-w-xl text-center space-y-6">
          <div data-out class="mono text-4xl sm:text-6xl font-semibold tracking-tight break-all py-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12161d]"></div>
          <label class="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
            <input data-fmt type="checkbox" checked class="w-4 h-4 accent-teal-600"> Com formatação (XXX.XXX.XXX-XX)
          </label>
          <div class="flex gap-3 justify-center">
            <button data-gen class="${BTN_PRIMARY}">Gerar Novo CPF</button>
            <button data-copy class="${BTN} min-w-[7rem]">Copiar</button>
          </div>
        </div>
      </div>`;
    this.out = $('[data-out]', el); this.fmt = $('[data-fmt]', el); this.copyBtn = $('[data-copy]', el);
    $('[data-gen]', el).onclick = () => this.generate();
    this.fmt.onchange = () => this.render();
    this.copyBtn.onclick = () => this.copy();
    this.generate();
  }

  // Algoritmo oficial: dígito = 11 - (soma(dígito_i * peso_i) mod 11); se >= 10, vira 0.
  static digit(nums) {
    const w = nums.length + 1;
    const sum = nums.reduce((acc, n, i) => acc + n * (w - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  }

  generate() {
    let base;
    do { base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)); }
    while (base.every(n => n === base[0])); // descarta sequências repetidas (ex.: 111.111.111-11)
    const d1 = CpfTool.digit(base);
    const d2 = CpfTool.digit([...base, d1]);
    this.digits = [...base, d1, d2].join('');
    this.render();
  }

  render() {
    const d = this.digits;
    this.out.textContent = this.fmt.checked ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
  }

  async copy() {
    const text = this.out.textContent;
    try { await navigator.clipboard.writeText(text); }
    catch (e) { // fallback para ambientes onde a Clipboard API é bloqueada
      const t = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (_) {} t.remove();
    }
    this.copyBtn.textContent = 'Copiado!';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.copyBtn.textContent = 'Copiar'), 2000);
  }
}


DevTools.register(new CpfTool());
