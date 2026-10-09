/* Assemble the 2.0 shell before the existing planner binds its controls. */
(() => {
  const shell = document.querySelector('.app-shell');
  const legacyHeader = shell.querySelector('.topbar');
  const dashboard = shell.querySelector('.dashboard');
  const nav = shell.querySelector('.tab-row');
  const iconPaths = { today:'<circle cx="10" cy="10" r="4"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M4 4l1 1m10 10 1 1M4 16l1-1M15 5l1-1"/>', calendar:'<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M7 1v4m6-4v4"/>', todo:'<path d="m2 5 2 2 3-4m3 2h8M2 13l2 2 3-4m3 2h8"/>',classes:'<path d="M10 5C7 3 4 3 2 4v12c3-1 5-1 8 1 3-2 5-2 8-1V4c-2-1-5-1-8 1Zm0 0v12"/>',more:'<circle cx="4" cy="10" r="1"/><circle cx="10" cy="10" r="1"/><circle cx="16" cy="10" r="1"/>' };
  Object.assign(iconPaths,{
   events:'<rect x="2" y="4" width="16" height="14" rx="2"/><path d="M6 2v4m8-4v4M2 9h16m-12 4h3m3 0h2"/>',
   homework:'<path d="M4 2h8l4 4v12H4zM12 2v5h4M7 11h6m-6 3h4"/>',
   exams:'<path d="M6 4H3v14h14V4h-3M7 2h6v4H7zM6 10l2 2 5-3m-7 6h7"/>',
   reminders:'<path d="M4 14h12l-2-3V7a4 4 0 0 0-8 0v4zM8 17h4M10 1v2"/>',
   settings:'<circle cx="10" cy="10" r="3"/><path d="m8 1 4 0 1 3 3 1 2 3-2 2 1 3-3 3-3-1-3 2-3-2 1-3-3-2 1-4 3-1z"/>',
   customize:'<path d="m13 2 5 5-9 9H4v-5zM10 5l5 5M2 19h16"/>'
  });
  const icon = key => `<svg viewBox="0 0 20 20" aria-hidden="true">${iconPaths[key] || iconPaths.todo}</svg>`;
  const labels = {today:'Today',calendar:'Calendar',todo:'To-Do',classes:'Classes',events:'Events',homework:'Homework',exams:'Exams',reminders:'Reminders',settings:'Settings',more:'More'};
  const todayNav=document.createElement('button');todayNav.type='button';todayNav.className='tab-button';todayNav.id='tab-today';todayNav.dataset.tab='today';todayNav.setAttribute('role','tab');nav.prepend(todayNav);
  nav.querySelectorAll('button').forEach(b=>{b.innerHTML=`${icon(b.dataset.tab)}<span>${labels[b.dataset.tab]}</span>`});
  const sidebar=document.createElement('aside');sidebar.className='v2-sidebar';sidebar.innerHTML='<a class="v2-brand" href="index.html"><span class="brand-mark">U</span>UniPlan <small>2.5.2</small></a><p class="v2-sidebar-caption">YOUR PERSONAL PLANNER</p>';
  sidebar.append(nav);const bottom=document.createElement('div');bottom.className='v2-sidebar-bottom';bottom.innerHTML='<button type="button" data-v2-canvas>↗ Canvas & imports</button><p id="v2-profile"></p>';sidebar.append(bottom);
  const main=document.createElement('div');main.className='v2-main';const header=document.createElement('header');header.className='v2-topline';header.innerHTML='<div class="v2-breadcrumb">My planner <span>/</span> <b id="v2-current-section">Today</b></div><a class="v2-mobile-brand v2-brand" href="index.html"><span class="brand-mark">U</span>UniPlan <small>2.5.2</small></a><div class="v2-actions"></div>';
  const add=document.querySelector('#quick-add');add.innerHTML='<span aria-hidden="true">+</span> Add new';header.querySelector('.v2-actions').append(document.querySelector('#open-canvas'),document.querySelector('#open-settings'),add);
  const customize=document.createElement('button');customize.type='button';customize.id='open-customize';customize.className='icon-button';customize.setAttribute('aria-label','Customize app');customize.title='Customize app';customize.innerHTML=icon('customize');header.querySelector('.v2-actions').append(customize);
  add.innerHTML='<span aria-hidden="true">+</span>';add.title='Add new';
  const heading=document.createElement('div');heading.className='v2-heading';heading.innerHTML='<h1 id="v2-date"></h1><p id="v2-section-description">Your classes, plans, and deadlines. One place.</p><p id="v2-sync-status" role="status"></p>';
  legacyHeader.hidden=true;main.append(header,heading,dashboard);shell.prepend(sidebar);shell.append(main);
  const panels=shell.querySelector('.tab-panels');const today=document.createElement('section');today.className='tab-panel';today.id='panel-today';today.dataset.panel='today';today.setAttribute('role','tabpanel');today.setAttribute('aria-labelledby','tab-today');
  today.innerHTML='<div class="v2-week-strip" id="v2-week-strip" aria-label="Choose a day"></div><div class="v2-today-columns"><div><article class="panel-card v2-up-next"><p class="panel-label">UP NEXT</p><div id="v2-up-next"></div></article><article class="panel-card"><div class="panel-header"><h3>Your full day</h3><button type="button" class="small-button" data-v2-calendar>Calendar ↗</button></div><p class="settings-note" id="v2-agenda-date"></p><div class="day-summary" id="v2-day-list"></div><details class="completed-section"><summary>Completed <span id="v2-day-completed-count">(0)</span></summary><div class="day-summary" id="v2-day-completed"></div></details></article></div><div><article class="panel-card"><div class="panel-header"><h3>Needs your attention</h3><button class="small-button" type="button" data-v2-todo>All to-dos ↗</button></div><div id="v2-attention"></div></article><article class="panel-card v2-next-exam"><p class="panel-label">COMING UP</p><div id="v2-next-exam"></div></article></div></div>';
  today.querySelector(".v2-up-next").after(today.querySelector(".v2-next-exam"));
  const fullDay = today.querySelector('#v2-day-list').closest('.panel-card');
  fullDay.classList.add('v2-full-day');
  today.querySelector('.v2-today-columns').after(fullDay);
  today.querySelector('#v2-attention').closest('.panel-card').classList.add('v2-attention-card');
  panels.prepend(today);
  const more=document.createElement('section');more.className='tab-panel';more.id='panel-more';more.dataset.panel='more';more.setAttribute('role','tabpanel');more.setAttribute('aria-label','More planner tools');more.innerHTML='<div class="v2-more-grid">'+['homework','exams','events','reminders','settings'].map(k=>`<button type="button" data-v2-page="${k}">${icon(k)}<strong>${labels[k]}</strong></button>`).join('')+'</div>';panels.append(more);
  const mobileNav=document.createElement('nav');mobileNav.className='v2-bottom-nav';mobileNav.setAttribute('role','tablist');mobileNav.setAttribute('aria-label','Main navigation');mobileNav.innerHTML=['today','calendar','todo','classes','more'].map(k=>`<button type="button" class="tab-button" role="tab" data-tab="${k}">${icon(k)}<span>${labels[k]}</span></button>`).join('');shell.append(mobileNav);
  const feed=document.querySelector('#settings-canvas-feed');const mode=document.createElement('section');mode.className='v2-canvas-mode';mode.innerHTML='<fieldset><legend>Canvas import mode</legend><label><input type="radio" name="v2-canvas-mode" value="manual" checked><span><strong>Manually check & add</strong><small>Review new and changed items, then choose what to add.</small></span></label><label><input type="radio" name="v2-canvas-mode" value="automatic"><span><strong>Automatically add every 3 days</strong><small>Check your saved feed in the background and add new assignments and exams. Existing items stay yours to edit.</small></span></label></fieldset><button type="button" class="small-button" id="v2-save-import-mode">Save import preference</button><button type="button" class="small-button" id="v2-import-now">Check & add now</button><p id="v2-canvas-status" class="settings-note" role="status"></p>';
  feed.closest('label').insertAdjacentElement('afterend',mode);
  const imports=document.querySelector('[data-school-import-panel="homework"]').cloneNode(true);
  imports.dataset.schoolImportPanel='all';
  document.querySelector('#todo-list').before(imports);
  imports.querySelector('summary').textContent='Import homework & exams from Canvas';
  document.querySelectorAll('.todo-filters,.collection-filter').forEach(el=>el.hidden=true);
  const help=document.createElement('button');help.type='button';help.className='ghost-button';help.dataset.v2Tutorial='';help.textContent='Show tutorial';
  document.querySelector('#settings-whats-new').after(help);
  document.querySelectorAll('.auth-brand .eyebrow').forEach(x=>x.textContent='UniPlan · Update 2.5.2');
})();
