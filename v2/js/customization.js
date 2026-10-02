/* Appearance preferences are independent of profile and planner content. */
const PlannerCustomization = (() => {
  const cardLabels = { todo: 'To-do list', homework: 'Homework', exams: 'Exams', classes: 'Today’s classes' };
  const themes = ['classic', 'christmas', 'halloween', 'valentine', 'spring', 'autumn', 'ocean', 'lavender', 'sunset'];
  const presets = {
    classic: { name: '☀️ Classic', theme: 'classic' },
    christmas: { name: '🎄 Snowy Christmas', theme: 'christmas', background: 'pattern', font: 'rounded' },
    halloween: { name: '🎃 Halloween night', theme: 'halloween', mode: 'dark', background: 'pattern' },
    valentine: { name: '💗 Rose garden', theme: 'valentine', font: 'serif', density: 'comfortable' },
    spring: { name: '🌷 Spring garden', theme: 'spring', background: 'pattern', font: 'rounded' },
    autumn: { name: '🍂 Cozy autumn', theme: 'autumn', font: 'serif', density: 'comfortable' },
    ocean: { name: '🌊 Ocean focus', theme: 'ocean', density: 'compact', decorations: false },
    lavender: { name: '🪻 Lavender calm', theme: 'lavender', font: 'rounded', density: 'comfortable' },
    sunset: { name: '🌅 Sunset journal', theme: 'sunset', font: 'serif', defaultView: 'month' },
    midnight: { name: '🌙 Midnight study', theme: 'ocean', mode: 'dark', background: 'solid', density: 'compact', decorations: false },
  };
  function defaults() {
    return { mode: 'light', density: 'compact', decorations: true, background: 'gradient', font: 'system', textSize: 'normal', weekStart: 'sunday', defaultView: 'week', customColors: false, backgroundColor: '#f7f1e6', accentColor: '#7eaed6', calendarColor: '#fffaf1', cards: Object.keys(cardLabels), hiddenCards: [] };
  }
  function normalize(value) {
    const d = defaults();
    const v = value && typeof value === 'object' ? value : {};
    const choices = {mode:['light','dark','system'], density:['compact','comfortable'], background:['solid','gradient','pattern','photo'], font:['system','rounded','serif'], textSize:['small','normal','large'], weekStart:['sunday','monday'], defaultView:['month','week','day']};
    for (const [key, values] of Object.entries(choices)) if (values.includes(v[key])) d[key] = v[key];
    for (const key of ['decorations','customColors']) if (typeof v[key] === 'boolean') d[key] = v[key];
    for (const key of ['backgroundColor','accentColor','calendarColor']) if (/^#[\da-f]{6}$/i.test(v[key] || '')) d[key] = v[key];
    if (Array.isArray(v.cards)) d.cards = [...new Set([...v.cards.filter(key => Object.hasOwn(cardLabels, key)), ...d.cards])];
    if (Array.isArray(v.hiddenCards)) d.hiddenCards = [...new Set(v.hiddenCards.filter(key => Object.hasOwn(cardLabels, key)))];
    return d;
  }
  function preset(key) {
    const p = presets[key] || presets.classic;
    return { theme: p.theme, customization: normalize(p) };
  }
  function contrast(color) {
    const rgb = color.slice(1).match(/../g).map(part => {const n = parseInt(part,16)/255; return n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4;});
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .179 ? '#151515' : '#ffffff';
  }
  let readSettings, commit, root, media;
  const photoKey = 'uniplan-background-photo-v1';
  const $ = (id) => document.getElementById(id);
  function apply(settings) {
    const c = normalize(settings.customization);
    const html = document.documentElement;
    html.dataset.theme = themes.includes(settings.theme) ? settings.theme : 'classic';
    html.dataset.mode = c.mode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : c.mode;
    for (const key of ['density','background','font','textSize']) html.dataset[key] = c[key];
    html.dataset.decorations = String(c.decorations);
    html.dataset.customColors = String(c.customColors);
    html.style.fontSize = (document.body.classList.contains('mobile-preview') ? {small:'13px',normal:'14px',large:'16px'} : {small:'14px',normal:'16px',large:'18px'})[c.textSize];
    const variables = ['--bg','--accent','--accent-deep','--accent-soft','--custom-calendar','--calendar-ink','--calendar-muted','--accent-ink'];
    variables.forEach(key => html.style.removeProperty(key));
    if (c.customColors) {
      html.style.setProperty('--bg', c.backgroundColor);
      html.style.setProperty('--accent', c.accentColor);
      html.style.setProperty('--accent-deep', html.dataset.mode === 'dark' ? `color-mix(in srgb, ${c.accentColor} 60%, white)` : `color-mix(in srgb, ${c.accentColor} 55%, black)`);
      html.style.setProperty('--accent-soft', `color-mix(in srgb, ${c.accentColor} 18%, var(--surface-strong))`);
      html.style.setProperty('--accent-ink', contrast(c.accentColor));
      html.style.setProperty('--custom-calendar', c.calendarColor);
      html.style.setProperty('--calendar-ink', contrast(c.calendarColor));
      html.style.setProperty('--calendar-muted', `color-mix(in srgb, ${contrast(c.calendarColor)} 72%, ${c.calendarColor})`);
    }
    let photo = '';
    try {photo = localStorage.getItem(photoKey) || '';} catch { /* Storage can be unavailable. */ }
    html.style.removeProperty('--planner-photo');
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)) html.style.setProperty('--planner-photo', `url("${photo}")`);
    c.cards.forEach((key, index) => {
      const card = document.querySelector(`.topbar-stats [data-tab-target="${key}"]`);
      if (card) {card.style.order = index; card.hidden = c.hiddenCards.includes(key);}
    });
    const stats = document.querySelector('.topbar-stats');
    if (stats) stats.hidden = c.hiddenCards.length === c.cards.length;
  }
  function render(settings) {
    apply(settings);
    if (!root) return;
    const c = normalize(settings.customization);
    $('settings-theme').value = settings.theme;
    root.querySelectorAll('[data-customization]').forEach(input => {
      const value = c[input.dataset.customization];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
    });
    $('custom-colors').hidden = !c.customColors;
    $('custom-photo-controls').hidden = c.background !== 'photo';
    $('customization-presets').querySelectorAll('button').forEach(button => {
      const p = preset(button.dataset.preset);
      button.setAttribute('aria-pressed', String(settings.theme === p.theme && JSON.stringify(c) === JSON.stringify(p.customization)));
    });
    const cards = $('customization-cards'); cards.replaceChildren();
    c.cards.forEach((key, index) => {
      const row = document.createElement('div');row.className='customization-card-row';
      const label = document.createElement('label');
      const toggle = document.createElement('input');toggle.type='checkbox';toggle.checked=!c.hiddenCards.includes(key);
      toggle.addEventListener('change', () => update({hiddenCards: toggle.checked ? c.hiddenCards.filter(k=>k!==key) : [...c.hiddenCards,key]}));
      label.append(toggle, document.createTextNode(cardLabels[key])); row.append(label);
      for (const [direction, symbol] of [[-1,'↑'],[1,'↓']]) {
        const button = document.createElement('button');button.type='button';button.className='small-button';button.textContent=symbol;
        button.setAttribute('aria-label', `Move ${cardLabels[key]} ${direction===-1?'earlier':'later'}`);
        button.disabled=index+direction<0||index+direction>=c.cards.length;
        button.addEventListener('click',()=>{const ordered=[...c.cards];[ordered[index],ordered[index+direction]]=[ordered[index+direction],ordered[index]];update({cards:ordered});});row.append(button);
      }
      cards.append(row);
    });
  }
  function update(changes, theme, message = 'Customization saved.') {
    const previous = readSettings();
    const next = {theme:theme || previous.theme, customization:normalize({...previous.customization,...changes})};
    try {
      commit(next, Object.hasOwn(changes, "defaultView"));
      render(next);
      $('customization-status').textContent=message;
    } catch { $('customization-status').textContent='Could not save customization. Device storage may be full.'; }
  }
  async function upload(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) throw new Error('Choose a JPG, PNG, or WebP under 10 MB.');
    const image = new Image(); const url=URL.createObjectURL(file);
    try {
      image.src=url;await image.decode();
      const ratio=Math.min(1,1200/Math.max(image.width,image.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      localStorage.setItem(photoKey,canvas.toDataURL('image/jpeg',.75));
      update({background:'photo'},undefined,'Background saved on this device.');
    } finally {URL.revokeObjectURL(url);}
  }
  function init(getSettings, onChange) {
    readSettings=getSettings;commit=onChange;root=$('app-customization');
    $('customization-presets').replaceChildren();
    Object.entries(presets).forEach(([key,p])=>{
      const button=document.createElement('button');button.type='button';button.className='customization-preset';button.dataset.preset=key;button.textContent=p.name;
      button.addEventListener('click',()=>{const selected=preset(key);update(selected.customization,selected.theme,`${p.name} applied and saved.`);});$('customization-presets').append(button);
    });
    $('settings-theme').addEventListener('change',event=>update({},event.target.value));
    root.querySelectorAll('[data-customization]').forEach(input=>input.addEventListener('change',()=>update({[input.dataset.customization]:input.type==='checkbox'?input.checked:input.value})));
    $('customization-default').addEventListener('click',()=>update(defaults(),'classic','Default appearance restored. Your planner content and profile are unchanged.'));
    $('custom-photo').addEventListener('change',async event=>{
      try {await upload(event.target.files[0]);} catch(error) {$('customization-status').textContent=error.message || 'Could not save this image. Try a smaller image.';} finally {event.target.value='';}
    });
    $('custom-photo-remove').addEventListener('click',()=>{localStorage.removeItem(photoKey);update({background:'gradient'},undefined,'Photo removed from this device.');});
    media=window.matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',()=>apply(readSettings()));
    render(readSettings());
  }
  return {defaults,normalize,preset,apply,render,init};
})();
