# WCAG AA Contrast Audit — Repeatable Plan

Run this audit whenever theme tokens, opacity values, or palette colors change.

## Trigger

Ask Claude Code: **"Run the WCAG contrast audit plan"** or **"/plan wcag-contrast-audit"**

## What it checks

The add-to-list CTA (and any element using `currentColor` + `opacity`) against all palette × mode combinations:

| Palette | Modes |
|---------|-------|
| Default (no class) | Light, Dark |
| Rosé (`.theme-rose`) | Light, Dark |
| Rebecca Purple (`.theme-rebecca`) | Light, Dark |
| Claude (`.theme-claude`) | Light, Dark |
| High Contrast (`.high-contrast`) | Light, Dark |

**10 combinations total.**

## Steps

### 1. Gather current token values

Read the CSS custom properties from `packages/app/styles/globals.css` (or `packages/web/src/globals.css` — they're synced) for each palette × mode:

- `--color-text-primary` (used by `currentColor` in card context)
- `--color-bg-card` (the surface behind the CTA)
- `--color-bg-body` (fallback surface)
- `--color-accent` (active state background)

### 2. Compute effective colors

For elements using `opacity`, alpha-blend the foreground over the background:

```
effective_channel = fg_channel × opacity + bg_channel × (1 - opacity)
```

### 3. Calculate WCAG 2.1 relative luminance

```
L = 0.2126 × R' + 0.7152 × G' + 0.0722 × B'
where C' = C/255 ≤ 0.03928 ? C/12.92 : ((C + 0.055) / 1.055) ^ 2.4
```

### 4. Calculate contrast ratio

```
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

### 5. Check against thresholds

| WCAG Level | Normal text (< 18pt) | Large text (≥ 18pt / 14pt bold) |
|------------|---------------------|---------------------------------|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

### 6. Node.js one-liner

Run this from the repo root — update the `opacity` and `combos` values as needed:

```bash
node -e '
function hexToRGB(h){h=h.replace("#","");return[parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)];}
function lum(r,g,b){const[a,b2,c]=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return .2126*a+.7152*b2+.0722*c;}
function cr(l1,l2){return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
function blend(fg,bg,a){return fg.map((f,i)=>Math.round(f*a+bg[i]*(1-a)));}
const opacity=0.6;
const combos=[
  ["Default Light","#09090b","#ffffff"],["Default Dark","#fafafa","#18181b"],
  ["Rosé Light","#09090b","#ffffff"],["Rosé Dark","#fafafa","#2d1520"],
  ["Rebecca Light","#09090b","#ffffff"],["Rebecca Dark","#fafafa","#1c1230"],
  ["Claude Light","#09090b","#ffffff"],["Claude Dark","#fafafa","#2d2b28"],
  ["HC Light","#000000","#ffffff"],["HC Dark","#ffffff","#000000"]
];
console.log("Palette|Effective|Ratio|AA?");
for(const[n,t,bg]of combos){const e=blend(hexToRGB(t),hexToRGB(bg),opacity);const r=cr(lum(...e),lum(...hexToRGB(bg)));console.log(n+"|#"+e.map(c=>c.toString(16).padStart(2,"0")).join("")+"|"+r.toFixed(2)+":1|"+(r>=4.5?"PASS":"FAIL"));}
'
```

### 7. Fix violations

- If light modes fail: increase `opacity` (minimum 0.58 for current tokens)
- If dark modes fail: usually fine since light-on-dark has higher inherent contrast
- Never use hard-coded colors — always `currentColor`, `var(--color-*)`, or opacity
