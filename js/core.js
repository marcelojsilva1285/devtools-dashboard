/* ====================================================================
 * // TUTORIAL PARA ADICIONAR NOVA FERRAMENTA:
 * Para incluir uma "Ferramenta 3" amanhã, replique estes passos:
 *
 *  1. Crie o arquivo js/tools/ferramenta3.js
 *
 *  2. Dentro dele, escreva uma classe com esta "interface":
 *
 *       class Ferramenta3 {
 *         id = 'ferramenta3';          // identificador único (sem espaços)
 *         title = 'Minha Ferramenta';  // título no menu e no cabeçalho
 *         icon = 'hash';               // nome de um ícone do Lucide (lucide.dev/icons)
 *         mount(el) { el.innerHTML = '...'; }  // monta a UI uma única vez
 *         onShow() { }                 // opcional: roda sempre que a aba fica visível
 *         setTheme(dark) { }           // opcional: roda ao alternar o tema
 *       }
 *
 *  3. No fim do mesmo arquivo, registre a ferramenta:
 *
 *       DevTools.register(new Ferramenta3());
 *
 *  4. Em index.html, adicione uma linha (antes de js/app.js):
 *
 *       <script src="js/tools/ferramenta3.js"></script>
 *
 *  Pronto: o menu, o painel e a navegação são criados automaticamente.
 * ==================================================================== */

// Registro central das ferramentas (preenchido pelos arquivos em js/tools/)
const DevTools = {
  tools: [],
  register(tool) { this.tools.push(tool); }
};

const $ = (sel, root = document) => root.querySelector(sel);
const BTN = 'px-3 py-1.5 rounded-md text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';
const BTN_PRIMARY = 'px-3 py-1.5 rounded-md text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white transition-colors';
