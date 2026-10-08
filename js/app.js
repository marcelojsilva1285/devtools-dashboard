/* ---------- App: menu, navegação e tema ---------- */
const App = {
  isDark: () => document.documentElement.classList.contains('dark'),
  init() {
    const menu = $('#menu'), panels = $('#panels');
    this.items = {}; this.panels = {};
    DevTools.tools.forEach(t => {
      const b = document.createElement('button');
      b.className = 'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800';
      b.innerHTML = `<i data-lucide="${t.icon}" class="w-4 h-4 shrink-0"></i><span class="hidden md:inline">${t.title}</span>`;
      b.title = t.title; b.onclick = () => this.show(t.id);
      menu.appendChild(b); this.items[t.id] = b;
      const p = document.createElement('section');
      p.className = 'absolute inset-0 hidden overflow-auto'; panels.appendChild(p);
      this.panels[t.id] = p; t.mount(p);
    });
    $('#themeBtn').onclick = () => this.toggleTheme();
    try { if (localStorage.getItem('theme') === 'light') document.documentElement.classList.remove('dark'); } catch (e) {}
    lucide.createIcons();
    this.show(DevTools.tools[0].id);
  },
  show(id) {
    DevTools.tools.forEach(t => {
      const on = t.id === id;
      this.panels[t.id].classList.toggle('hidden', !on);
      this.items[t.id].classList.toggle('bg-teal-600/10', on);
      this.items[t.id].classList.toggle('text-teal-700', on);
      this.items[t.id].classList.toggle('dark:text-teal-300', on);
      if (on) { $('#toolTitle').textContent = t.title; t.onShow && t.onShow(); }
    });
  },
  toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    DevTools.tools.forEach(t => t.setTheme && t.setTheme(dark));
  }
};
document.addEventListener('DOMContentLoaded', () => App.init());
