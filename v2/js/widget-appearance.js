// Shared with the standalone Scriptable download. Keep both copies in sync.
const WIDGET_THEMES = {
  "classic": {
    "bg": "#f7f1e6",
    "surface": "#fffaf1",
    "ink": "#151515",
    "muted": "#667085",
    "accent": "#7eaed6",
    "deep": "#2f5f8e",
    "soft": "#f7f1e6"
  },
  "christmas": {
    "bg": "#f3f6ef",
    "surface": "#ffffff",
    "soft": "#e9f0e6",
    "ink": "#20382b",
    "muted": "#5b6c60",
    "accent": "#b8424c",
    "deep": "#8d2531"
  },
  "halloween": {
    "bg": "#f6effa",
    "surface": "#fffaf2",
    "soft": "#eee2f3",
    "ink": "#352341",
    "muted": "#746079",
    "accent": "#e6a052",
    "deep": "#884313"
  },
  "valentine": {
    "bg": "#fceff3",
    "surface": "#ffffff",
    "soft": "#f9e4eb",
    "ink": "#502c3b",
    "muted": "#846272",
    "accent": "#d782a0",
    "deep": "#9b3c5f"
  },
  "spring": {
    "bg": "#f1f8ee",
    "surface": "#ffffff",
    "soft": "#e6f2df",
    "ink": "#31412e",
    "muted": "#62765b",
    "accent": "#8dbd80",
    "deep": "#416e36"
  },
  "autumn": {
    "bg": "#faf1e7",
    "surface": "#ffffff",
    "soft": "#f5e6d4",
    "ink": "#4b3326",
    "muted": "#806958",
    "accent": "#c9955f",
    "deep": "#88542b"
  },
  "ocean": {
    "bg": "#edf7fa",
    "surface": "#ffffff",
    "soft": "#e0f0f5",
    "ink": "#19394b",
    "muted": "#506d7d",
    "accent": "#2e94ad",
    "deep": "#176079"
  },
  "lavender": {
    "bg": "#f5effa",
    "surface": "#ffffff",
    "soft": "#ece3f5",
    "ink": "#3c2b4e",
    "muted": "#72617d",
    "accent": "#a386c7",
    "deep": "#704c99"
  },
  "sunset": {
    "bg": "#fff1e9",
    "surface": "#ffffff",
    "soft": "#fbe4d9",
    "ink": "#513535",
    "muted": "#876769",
    "accent": "#e69b85",
    "deep": "#9b4f3c"
  }
};
function widgetAppearance(settings = {}, systemDark = false) {
  const c = settings.customization || {};
  const p = { ...(Object.prototype.hasOwnProperty.call(WIDGET_THEMES, settings.theme) ? WIDGET_THEMES[settings.theme] : WIDGET_THEMES.classic) };
  const dark = c.mode === 'dark' || (c.mode === 'system' && systemDark);
  if (dark) Object.assign(p, {bg:'#121722',surface:'#222c3a',soft:'#19212d',ink:'#f0f3f9',muted:'#b6c2d2'});
  const valid = value => /^#[0-9a-f]{6}$/i.test(value || '');
  const mix = (a,b,t) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*t+parseInt(b.slice(i,i+2),16)*(1-t)).toString(16).padStart(2,'0')).join('');
  if (c.customColors === true) {
    if (valid(c.backgroundColor)) p.bg = c.backgroundColor;
    if (valid(c.accentColor)) p.accent = c.accentColor;
    if (valid(c.calendarColor)) p.surface = c.calendarColor;
  }
  const contrast = color => {
    const rgb = [1,3,5].map(i => {const n=parseInt(color.slice(i,i+2),16)/255; return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#151515':'#ffffff';
  };
  p.cardInk = c.customColors ? contrast(p.surface) : p.ink;
  p.cardMuted = c.customColors ? mix(p.cardInk,p.surface,.72) : p.muted;
  if (dark || c.customColors) p.deep = mix(p.accent,contrast(p.bg),.6);
  if (c.customColors) {p.ink=contrast(p.bg);p.muted=mix(p.ink,p.bg,.72);}
  p.end = c.background === 'solid' || c.customColors ? p.bg : p.soft;
  p.dark = dark;
  return p;
}
