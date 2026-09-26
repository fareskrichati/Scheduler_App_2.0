/* Local-only, branded schedule images. No account data or private notes are exported. */
(function (root) {
  function scheduleRows(schedule, courses) {
    const groups = new Map();
    [...schedule].filter(item => item.type === 'class').sort((a, b) =>
      `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)
    ).forEach(item => {
      const key = JSON.stringify([item.title, item.start, item.end, item.location || '']);
      if (!groups.has(key)) groups.set(key, { title: item.title, start: item.start, end: item.end, location: item.location || '', dates: [] });
      const row = groups.get(key);
      if (!row.dates.includes(item.date)) row.dates.push(item.date);
    });
    return [...groups.values(), ...courses.map(item => ({ title: item.title, online: true, dates: [] }))];
  }

  function weekdayLabel(dates) {
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days = new Set(dates.map(date => (new Date(`${date}T12:00:00`).getDay() + 6) % 7));
    return names.filter((name, index) => days.has(index)).join(', ');
  }

  function timeLabel(time) {
    if (!time) return 'Time not set';
    const [hour, minute] = time.split(':').map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function wrap(ctx, text, width) {
    const lines = [];
    let line = '';
    for (const char of String(text)) {
      if (ctx.measureText(line + char).width > width && line) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += char;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }

  async function makeImages(rows) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not create the schedule image.');
    const layout = rows.map(row => [
      { text: row.title, font: '700 30px sans-serif', color: '#19354b', height: 40 },
      { text: row.online ? 'Online • No scheduled meeting time' : `${timeLabel(row.start)} – ${timeLabel(row.end)}${row.location ? ` • ${row.location}` : ''}`, font: '24px sans-serif', color: '#365874', height: 34 },
      { text: row.online ? 'No scheduled weekdays' : weekdayLabel(row.dates), font: '22px sans-serif', color: '#56677a', height: 32 },
    ].map(section => {
      ctx.font = section.font;
      return { ...section, lines: wrap(ctx, section.text, 1080) };
    }));
    // Measure before drawing so every class fits on one page without clipping.
    const contentHeight = layout.reduce((total, sections) => total + 42 + sections.reduce((height, section) => height + section.lines.length * section.height + 8, 0), 0);
    const scale = Math.min(1, 1140 / Math.max(1, contentHeight));
    ctx.fillStyle = '#f4f8fc'; ctx.fillRect(0, 0, 1200, 1500);
    const gradient = ctx.createLinearGradient(60, 55, 140, 135);
    gradient.addColorStop(0, '#7eaed6'); gradient.addColorStop(1, '#c3ddf0');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(60, 55, 80, 80, 24); ctx.fill();
    ctx.fillStyle = '#19354b'; ctx.font = '800 44px sans-serif'; ctx.fillText('U', 84, 112);
    ctx.font = '700 42px sans-serif'; ctx.fillText('UniPlan', 162, 91);
    ctx.font = '22px sans-serif'; ctx.fillText('My school schedule', 164, 126);
    ctx.fillStyle = '#56677a'; ctx.font = '20px sans-serif';
    ctx.fillText('Class days and local meeting times', 60, 183);
    ctx.save();
    ctx.translate(60, 240);
    ctx.scale(scale, scale);
    let y = 0;
    for (const sections of layout) {
      for (const section of sections) {
        ctx.font = section.font; ctx.fillStyle = section.color;
        for (const line of section.lines) {
          ctx.fillText(line, 0, y); y += section.height;
        }
        y += 8;
      }
      ctx.strokeStyle = '#d9e4ed'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke();
      y += 42;
    }
    ctx.restore();
    ctx.fillStyle = '#56677a'; ctx.font = '18px sans-serif';
    ctx.fillText('Shared with UniPlan', 60, 1450);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The schedule image could not be created.');
    return [new File([blob], 'uniplan-schedule.png', { type: 'image/png' })];
  }

  async function open(schedule, courses) {
    if (document.querySelector('#schedule-share-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'schedule-share-dialog';
    dialog.className = 'schedule-share-dialog';
    dialog.setAttribute('aria-label', 'Share your schedule');
    dialog.innerHTML = `<div class="panel-header"><div><p class="panel-label">UniPlan</p><h3>Share your schedule</h3></div><button type="button" class="icon-button" aria-label="Close schedule sharing">×</button></div><p role="status" aria-live="polite">Preparing your schedule…</p><div class="schedule-share-actions"></div><div class="schedule-share-preview"></div>`;
    document.body.append(dialog);
    const urls = [];
    dialog.addEventListener('close', () => { urls.forEach(url => URL.revokeObjectURL(url)); dialog.remove(); });
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.showModal();
    const status = dialog.querySelector('[role="status"]');
    const rows = scheduleRows(schedule, courses);
    if (!rows.length) { status.textContent = 'Add a class first, then share your schedule.'; return; }
    try {
      const files = await makeImages(rows);
      if (!dialog.isConnected) return;
      const actions = dialog.querySelector('.schedule-share-actions');
      const canShare = Boolean(navigator.share && navigator.canShare && navigator.canShare({ files }));
      status.textContent = canShare ? 'Your classes, days and times are ready to share.' : 'Download your schedule image and attach it to a message.';
      if (canShare) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'primary-button'; button.textContent = 'Share schedule';
        button.onclick = async () => {
          button.disabled = true;
          try { await navigator.share({ files, title: 'My UniPlan school schedule' }); status.textContent = 'Schedule shared.'; }
          catch (error) { status.textContent = error.name === 'AbortError' ? 'Sharing canceled. Your schedule is ready when you are.' : 'Sharing is unavailable. Download the image below to send it.'; }
          finally { button.disabled = false; }
        };
        actions.append(button);
      }
      files.forEach((file, index) => {
        const url = URL.createObjectURL(file); urls.push(url);
        const link = document.createElement('a'); link.href = url; link.download = file.name;
        link.className = 'ghost-button'; link.textContent = 'Download schedule';
        actions.append(link);
        const image = document.createElement('img'); image.src = url; image.alt = 'UniPlan school schedule';
        dialog.querySelector('.schedule-share-preview').append(image);
      });
    } catch (error) { status.textContent = 'Could not prepare your schedule. Close this window and try again.'; }
  }
  root.UniPlanScheduleShare = { open, scheduleRows };
  if (typeof module !== 'undefined') module.exports = { scheduleRows, weekdayLabel, makeImages };
})(typeof window !== 'undefined' ? window : globalThis);
