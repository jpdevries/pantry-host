/**
 * Generate a self-contained HTML file for a recipe with schema.org JSON-LD.
 * Use with <a download> and a data: URI for zero-JS downloads.
 */

export interface ExportableRecipe {
  title: string;
  slug: string | null;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: string[];
  source: string;
  sourceUrl: string | null;
  photoUrl: string | null;
  ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDuration(minutes: number | null): string | undefined {
  if (!minutes) return undefined;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}`;
}

function formatIngredient(ing: { ingredientName: string; quantity: number | null; unit: string | null }): string {
  const parts: string[] = [];
  if (ing.quantity != null) parts.push(String(ing.quantity));
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.ingredientName);
  return parts.join(' ');
}

function parseInstructionSteps(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean);
}

function buildJsonLd(recipe: ExportableRecipe): string {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
  };
  if (recipe.description) ld.description = recipe.description;
  if (recipe.servings) ld.recipeYield = `${recipe.servings} servings`;
  if (recipe.prepTime) ld.prepTime = formatDuration(recipe.prepTime);
  if (recipe.cookTime) ld.cookTime = formatDuration(recipe.cookTime);
  if (recipe.photoUrl) ld.image = recipe.photoUrl;
  if (recipe.tags.length) ld.keywords = recipe.tags;
  if (recipe.requiredCookware.length) ld.tool = recipe.requiredCookware;
  if (recipe.sourceUrl) ld.isBasedOn = recipe.sourceUrl;

  ld.recipeIngredient = recipe.ingredients.map(formatIngredient);

  ld.recipeInstructions = parseInstructionSteps(recipe.instructions).map((text) => ({
    '@type': 'HowToStep',
    text,
  }));

  // Structured ingredients for lossless Pantry Host round-trip
  ld['pantryHost:ingredients'] = recipe.ingredients.map((ing) => ({
    name: ing.ingredientName,
    quantity: ing.quantity,
    unit: ing.unit,
  }));

  return JSON.stringify(ld, null, 2);
}

export function generateRecipeHTML(recipe: ExportableRecipe): string {
  const steps = parseInstructionSteps(recipe.instructions);
  const jsonLd = buildJsonLd(recipe);

  const timeInfo: string[] = [];
  if (recipe.prepTime) timeInfo.push(`Prep: ${recipe.prepTime} min`);
  if (recipe.cookTime) timeInfo.push(`Cook: ${recipe.cookTime} min`);
  if (recipe.servings) timeInfo.push(`Servings: ${recipe.servings}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Pantry Host">
<title>${esc(recipe.title)} — Pantry Host</title>
<script type="application/ld+json">
${jsonLd}
</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a1a;background:#fafafa;padding:2rem 1rem}
.recipe{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:2rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-family:Georgia,'Times New Roman',serif;font-size:1.75rem;line-height:1.3;margin-bottom:.5rem}
.description{color:#555;margin-bottom:1.25rem}
.meta{display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.875rem;color:#666;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #e5e5e5}
.photo{width:100%;border-radius:6px;margin-bottom:1.5rem}
.section-title{font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;color:#333}
.ingredients{list-style:none;margin-bottom:2rem}
.ingredients li{padding:.35rem 0;border-bottom:1px solid #f0f0f0}
.ingredients li:last-child{border-bottom:none}
.instructions{list-style:none;counter-reset:step;margin-bottom:2rem}
.instructions li{counter-increment:step;padding:.5rem 0 .5rem 2rem;position:relative;border-bottom:1px solid #f0f0f0}
.instructions li:last-child{border-bottom:none}
.instructions li::before{content:counter(step);position:absolute;left:0;font-weight:700;color:#999;font-size:.875rem}
.tags{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.5rem}
.tag{font-size:.75rem;background:#f0f0f0;color:#555;padding:.2rem .6rem;border-radius:999px}
.cookware{font-size:.875rem;color:#666;margin-bottom:1.5rem}
.source{font-size:.875rem;color:#888;margin-bottom:1rem}
.source a{color:#888}
.footer{text-align:center;font-size:.75rem;color:#aaa;margin-top:2rem;padding-top:1rem;border-top:1px solid #e5e5e5}
.footer a{color:#aaa}
@media print{body{padding:0;background:#fff}.recipe{border:none;box-shadow:none;padding:1rem}.footer{display:none}}
@media(max-width:480px){body{padding:1rem .5rem}.recipe{padding:1.25rem}h1{font-size:1.4rem}}
</style>
</head>
<body>
<article class="recipe">
<h1>${esc(recipe.title)}</h1>
${recipe.description ? `<p class="description">${esc(recipe.description)}</p>` : ''}
${timeInfo.length ? `<div class="meta">${timeInfo.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
${recipe.photoUrl ? `<img class="photo" src="${esc(recipe.photoUrl)}" alt="${esc(recipe.title)}" onerror="this.style.display='none'">` : ''}
${recipe.ingredients.length ? `
<h2 class="section-title">Ingredients</h2>
<ul class="ingredients">
${recipe.ingredients.map((ing) => `<li>${esc(formatIngredient(ing))}</li>`).join('\n')}
</ul>` : ''}
${steps.length ? `
<h2 class="section-title">Instructions</h2>
<ol class="instructions">
${steps.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ol>` : ''}
${recipe.tags.length ? `<div class="tags">${recipe.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
${recipe.requiredCookware.length ? `<p class="cookware">Cookware: ${recipe.requiredCookware.map(esc).join(', ')}</p>` : ''}
${recipe.sourceUrl ? `<p class="source">Source: <a href="${esc(recipe.sourceUrl)}">${esc(recipe.source || recipe.sourceUrl)}</a></p>` : recipe.source ? `<p class="source">Source: ${esc(recipe.source)}</p>` : ''}
</article>
<p class="footer">Exported from <a href="https://pantryhost.app">Pantry&nbsp;Host</a></p>
</body>
</html>`;
}

export function recipeToDataURI(recipe: ExportableRecipe): string {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(generateRecipeHTML(recipe));
}

/**
 * Convert a same-origin image to a base64 data URI via the Canvas API.
 * Zero dependencies — uses the browser's native <canvas> element.
 */
export function imageToDataURI(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function renderRecipeArticle(recipe: ExportableRecipe): string {
  const steps = parseInstructionSteps(recipe.instructions);
  const timeInfo: string[] = [];
  if (recipe.prepTime) timeInfo.push(`Prep: ${recipe.prepTime} min`);
  if (recipe.cookTime) timeInfo.push(`Cook: ${recipe.cookTime} min`);
  if (recipe.servings) timeInfo.push(`Servings: ${recipe.servings}`);
  const slug = recipe.slug || recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `<article class="recipe" id="recipe-${esc(slug)}">
<h2>${esc(recipe.title)}</h2>
${recipe.description ? `<p class="description">${esc(recipe.description)}</p>` : ''}
${timeInfo.length ? `<div class="meta">${timeInfo.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
${recipe.photoUrl ? `<img class="photo" src="${esc(recipe.photoUrl)}" alt="${esc(recipe.title)}" onerror="this.style.display='none'">` : ''}
${recipe.ingredients.length ? `
<h3 class="section-title">Ingredients</h3>
<ul class="ingredients">
${recipe.ingredients.map((ing) => `<li>${esc(formatIngredient(ing))}</li>`).join('\n')}
</ul>` : ''}
${steps.length ? `
<h3 class="section-title">Instructions</h3>
<ol class="instructions">
${steps.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ol>` : ''}
${recipe.tags.length ? `<div class="tags">${recipe.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
${recipe.requiredCookware.length ? `<p class="cookware">Cookware: ${recipe.requiredCookware.map(esc).join(', ')}</p>` : ''}
${recipe.sourceUrl ? `<p class="source">Source: <a href="${esc(recipe.sourceUrl)}">${esc(recipe.source || recipe.sourceUrl)}</a></p>` : recipe.source ? `<p class="source">Source: ${esc(recipe.source)}</p>` : ''}
</article>`;
}

export function generateRecipeBookHTML(recipes: ExportableRecipe[]): string {
  const jsonLd = JSON.stringify(recipes.map((r) => JSON.parse(buildJsonLd(r))), null, 2);

  const tocItems = recipes.map((r) => {
    const slug = r.slug || r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `<li><a href="#recipe-${esc(slug)}">${esc(r.title)}</a></li>`;
  });

  const articles = recipes.map(renderRecipeArticle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Pantry Host">
<title>Recipe Collection — Pantry Host</title>
<script type="application/ld+json">
${jsonLd}
</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1a1a1a;background:#fafafa;padding:2rem 1rem}
.book{max-width:640px;margin:0 auto}
nav{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:1.5rem 2rem;margin-bottom:2rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
nav h1{font-family:Georgia,'Times New Roman',serif;font-size:1.75rem;margin-bottom:1rem}
nav ol{padding-left:1.25rem}
nav li{padding:.25rem 0}
nav a{color:#1a1a1a;text-decoration:none}
nav a:hover{text-decoration:underline}
.recipe{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:2rem;margin-bottom:2rem;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h2{font-family:Georgia,'Times New Roman',serif;font-size:1.5rem;line-height:1.3;margin-bottom:.5rem}
.description{color:#555;margin-bottom:1.25rem}
.meta{display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.875rem;color:#666;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid #e5e5e5}
.photo{width:100%;border-radius:6px;margin-bottom:1.5rem}
.section-title{font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;color:#333}
.ingredients{list-style:none;margin-bottom:2rem}
.ingredients li{padding:.35rem 0;border-bottom:1px solid #f0f0f0}
.ingredients li:last-child{border-bottom:none}
.instructions{list-style:none;counter-reset:step;margin-bottom:2rem}
.instructions li{counter-increment:step;padding:.5rem 0 .5rem 2rem;position:relative;border-bottom:1px solid #f0f0f0}
.instructions li:last-child{border-bottom:none}
.instructions li::before{content:counter(step);position:absolute;left:0;font-weight:700;color:#999;font-size:.875rem}
.tags{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.5rem}
.tag{font-size:.75rem;background:#f0f0f0;color:#555;padding:.2rem .6rem;border-radius:999px}
.cookware{font-size:.875rem;color:#666;margin-bottom:1.5rem}
.source{font-size:.875rem;color:#888;margin-bottom:1rem}
.source a{color:#888}
.footer{text-align:center;font-size:.75rem;color:#aaa;margin-top:1rem;padding-top:1rem;border-top:1px solid #e5e5e5}
.footer a{color:#aaa}
@media print{body{padding:0;background:#fff}.recipe{border:none;box-shadow:none;padding:1rem;page-break-after:always}.recipe:last-child{page-break-after:auto}nav{page-break-after:always}.footer{display:none}}
@media(max-width:480px){body{padding:1rem .5rem}.recipe{padding:1.25rem}h2{font-size:1.3rem}}
</style>
</head>
<body>
<div class="book">
<nav>
<h1>Recipe Collection</h1>
<p style="color:#666;font-size:.875rem;margin-bottom:1rem">${recipes.length} recipes</p>
<ol>
${tocItems.join('\n')}
</ol>
</nav>
${articles.join('\n')}
<p class="footer">Exported from <a href="https://pantryhost.app">Pantry&nbsp;Host</a></p>
</div>
</body>
</html>`;
}

export function recipeBookToDataURI(recipes: ExportableRecipe[]): string {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(generateRecipeBookHTML(recipes));
}

// ── ICS / Calendar Export ──

/** Escape text for ICS DESCRIPTION/SUMMARY fields */
function icsEsc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Fold ICS lines to 75-octet max per RFC 5545 */
function icsFold(line: string): string {
  const parts: string[] = [];
  while (line.length > 75) {
    parts.push(line.slice(0, 75));
    line = ' ' + line.slice(75);
  }
  parts.push(line);
  return parts.join('\r\n');
}

function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

/**
 * Generate an .ics calendar event for a recipe.
 * DTSTART defaults to now — the user repositions it in their calendar app.
 * Event duration is based on prepTime + cookTime.
 */
export interface ICSOptions {
  /** Base64-encoded image to inline as ATTACH. Omit to use URI reference. */
  inlineImageBase64?: string;
  /** MIME type of the inline image (default: image/jpeg). */
  inlineImageType?: string;
}

export function generateRecipeICS(recipe: ExportableRecipe, options?: ICSOptions): string {
  const now = new Date();
  const uid = `recipe-${recipe.slug || recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${now.getTime()}@pantryhost.app`;

  // Build structured DESCRIPTION
  const descParts: string[] = [];

  const meta: string[] = [];
  if (recipe.servings) meta.push(`Servings: ${recipe.servings}`);
  if (recipe.prepTime) meta.push(`Prep: ${recipe.prepTime} min`);
  if (recipe.cookTime) meta.push(`Cook: ${recipe.cookTime} min`);
  if (meta.length) descParts.push(meta.join(' | '));

  if (recipe.description) descParts.push(recipe.description);

  if (recipe.ingredients.length) {
    descParts.push('INGREDIENTS');
    for (const ing of recipe.ingredients) {
      descParts.push(`- ${formatIngredient(ing)}`);
    }
  }

  const steps = parseInstructionSteps(recipe.instructions);
  if (steps.length) {
    descParts.push('');
    descParts.push('INSTRUCTIONS');
    steps.forEach((s, i) => descParts.push(`${i + 1}. ${s}`));
  }

  if (recipe.requiredCookware.length) {
    descParts.push('');
    descParts.push(`Cookware: ${recipe.requiredCookware.join(', ')}`);
  }

  descParts.push('');
  descParts.push('Exported from Pantry Host — https://pantryhost.app');

  const description = icsEsc(descParts.join('\n'));

  // Use VEVENT with an all-day date. VTODO is not supported by iOS
  // Calendar's webcal:// handler. All-day event for today — the user
  // drags it to the correct date in their calendar app.
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pantry Host//Recipe Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsTimestamp(now)}`,
    `DTSTART;VALUE=DATE:${today}`,
    `DTEND;VALUE=DATE:${today}`,
    icsFold(`SUMMARY:${icsEsc(recipe.title)}`),
    icsFold(`DESCRIPTION:${description}`),
  ];

  if (recipe.tags.length) {
    lines.push(icsFold(`CATEGORIES:${recipe.tags.map(icsEsc).join(',')}`));
  }

  const url = recipe.sourceUrl || null;
  if (url) lines.push(icsFold(`URL:${url}`));

  if (options?.inlineImageBase64) {
    // Inline base64-encoded image (local uploads, optimized 400px variant)
    const fmtType = options.inlineImageType || 'image/jpeg';
    lines.push(icsFold(`ATTACH;FMTTYPE=${fmtType};ENCODING=BASE64;VALUE=BINARY:${options.inlineImageBase64}`));
  } else if (recipe.photoUrl && recipe.photoUrl.startsWith('http')) {
    // External URL — reference only, no inlining
    const fmtType = recipe.photoUrl.endsWith('.png') ? 'image/png' : 'image/jpeg';
    lines.push(icsFold(`ATTACH;FMTTYPE=${fmtType}:${recipe.photoUrl}`));
  }

  if (recipe.prepTime) lines.push(`X-RECIPE-PREP-TIME:${recipe.prepTime} min`);
  if (recipe.cookTime) lines.push(`X-RECIPE-COOK-TIME:${recipe.cookTime} min`);
  if (recipe.servings) lines.push(`X-RECIPE-SERVINGS:${recipe.servings}`);
  if (recipe.requiredCookware.length) lines.push(icsFold(`X-RECIPE-COOKWARE:${recipe.requiredCookware.map(icsEsc).join(',')}`));

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

export function recipeToICSDataURI(recipe: ExportableRecipe): string {
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(generateRecipeICS(recipe));
}

/**
 * Download an ICS file via Blob URL. Works on iOS Safari where data: URI
 * downloads are blocked. Creates a temporary link, clicks it, then cleans up.
 */
/**
 * Download an ICS file. On iOS Safari, navigates to a server endpoint
 * that returns text/calendar (the only method iOS supports). On desktop,
 * uses a Blob URL with <a download>.
 */
export function downloadRecipeICS(recipe: ExportableRecipe, apiBase = ''): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS && recipe.slug) {
    // iOS Safari requires a real HTTP response with text/calendar content type.
    window.location.href = `${apiBase}/api/recipe-ics?slug=${encodeURIComponent(recipe.slug)}`;
    return;
  }

  const ics = generateRecipeICS(recipe);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${recipe.slug || 'recipe'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
