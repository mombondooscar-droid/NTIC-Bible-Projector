/**
 * ============================================================
 *  scripts/panels/lowerthird/ltPreview.js — Aperçu Lower Third
 *  NTIC Bible Projector · US-REFACTOR-LT
 *  Dépendances globales : esc, App
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION DE L'APERÇU — STYLE GRADUATION (VERSET)
// ─────────────────────────────────────────────────────────────
function _buildLTPreviewGraduation(settings, ref, text) {
  const font = settings.ltFontFamily || 'Arial Black';
  return `
    <div class="lt-preview-graduation" style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; pointer-events:none;">
      <div class="reference-badge" style="position:absolute; left:0; top:0; height:64px; min-width:240px; padding:0 36px; display:flex; align-items:center; justify-content:center; border-radius:32px; background:linear-gradient(90deg, #0a2f8b 0%, #2347d1 35%, #d6009d 100%); box-shadow:0 12px 24px rgba(0,0,0,.35); z-index:3;">
        <span style="color:${settings.ltRefColor}; font-size:${settings.ltRefSize}px; font-family:'${font}', sans-serif; font-weight:900; letter-spacing:1.8px; text-transform:uppercase; white-space:nowrap;">${esc(ref)}</span>
      </div>
      <div class="main-card" style="position:absolute; left:0; right:0; top:34px; height:calc(${settings.ltHeight}px - 34px); border-radius:40px; background:white; padding:8px; box-shadow:0 18px 32px rgba(0,0,0,.28);">
        <div class="card-inner" style="position:relative; width:100%; height:100%; border-radius:32px; background:linear-gradient(180deg, rgba(255,255,255,.99), rgba(250,250,250,.98)); overflow:hidden;">
          <div class="verset-text" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:0 72px; text-align:center; color:${settings.ltVerseColor}; font-size:${settings.ltVerseSize}px; font-family:'${font}', sans-serif; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; line-height:1.15; text-shadow:0 1px 0 rgba(255,255,255,.85);">
            ${esc(text)}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION DE L'APERÇU — STYLE GRADUATION (PERSONNE)
// ─────────────────────────────────────────────────────────────
function _buildLTPreviewGraduationPerson(settings, nom, titre) {
  const nameSize  = settings.personNameSize  || 30;
  const titleSize = settings.personTitleSize || 24;
  const font      = settings.ltFontFamily    || 'Arial Black';
  return `
    <div style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; display:flex; align-items:flex-end; pointer-events:none;">
      <div style="background:#ffffff; height:120px; flex:1; border-top-right-radius:60px; display:flex; flex-direction:column; justify-content:center; padding-left:40px; box-shadow:0 4px 15px rgba(0,0,0,.2); overflow:hidden;">
        <p style="font-size:${nameSize}px; font-family:'${font}', sans-serif; font-weight:900; color:#222; margin:0; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(nom)}</p>
      </div>
      <div style="background:linear-gradient(to right, #0a194e, #4a148c, #b71c1c); height:120px; flex:1; border-top-left-radius:60px; display:flex; flex-direction:column; justify-content:center; padding-left:40px; box-shadow:0 4px 15px rgba(0,0,0,.2); overflow:hidden;">
        <p style="font-size:${titleSize}px; font-family:'${font}', sans-serif; font-weight:700; color:#ffffff; margin:0; text-transform:uppercase; letter-spacing:.08em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(titre)}</p>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  CONSTRUCTION DE L'APERÇU — STYLE TOURPAC (VERSET)
// ─────────────────────────────────────────────────────────────
function _buildLTPreviewTourpac(settings, ref, text) {
  const font = settings.ltFontFamily || 'Arial Black';
  return `
    <div class="lt-preview-tourpac" style="position:relative; width:${settings.ltWidth}px; height:${settings.ltHeight}px; pointer-events:none;">
      <div class="lt" style="position:relative; width:100%; height:100%; display:flex; align-items:stretch; clip-path:polygon(0% 0%, calc(100% - 24px) 0%, 100% 22px, 100% 100%, 0% 100%); border-radius:3px 16px 16px 3px; box-shadow:0 30px 50px -20px rgba(0,0,0,.45);">
        <div class="lt-bar" style="width:8px; flex-shrink:0; display:flex; flex-direction:column; border-radius:3px 0 0 3px; overflow:hidden;">
          <span style="flex:1; background:#009A44;"></span>
          <span style="flex:1; background:#FBDE4A;"></span>
          <span style="flex:1; background:#DC241F;"></span>
        </div>
        <div class="lt-body" style="flex:1; background:rgba(255,255,255,.92); backdrop-filter:blur(24px); padding:12px 20px 14px 18px; display:flex; flex-direction:column; gap:4px; border-radius:0 14px 14px 0; position:relative;">
          <div class="lt-l1" style="font-family:'${font}', sans-serif; font-weight:700; font-size:${settings.ltRefSize}px; letter-spacing:.08em; text-transform:uppercase; color:#009A44; line-height:1.25;">${esc(ref)}</div>
          <div class="lt-l2" style="font-family:'${font}', sans-serif; font-weight:300; font-style:italic; font-size:${settings.ltVerseSize}px; line-height:1.55; letter-spacing:.02em; color:#000; overflow-y:auto; max-height:100%; white-space:pre-wrap;">${esc(text)}</div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
//  RAFRAÎCHISSEMENT DE L'APERÇU (appelé depuis le panneau principal)
// ─────────────────────────────────────────────────────────────
function _refreshLTPreview() {
  const container = document.getElementById('lt-preview-box');
  if (!container) return;
  const inner = container.querySelector('.lt-preview-inner');
  if (!inner) return;

  const s = App.settings;
  const isGraduation = s.ltType !== 'tourpac';

  // Aperçu personne graduation : quand une personne est active et style graduation
  if (isGraduation && App.currentPersonActive && App.lastProjectedPersonNom) {
    inner.innerHTML = _buildLTPreviewGraduationPerson(
      s,
      App.lastProjectedPersonNom,
      App.lastProjectedPersonTitre || ''
    );
    return;
  }

  // Aperçu verset (par défaut)
  const ref = App.lastBibleRef || 'Jean 3:16';
  let text = App.lastBibleText || 'Dieu a tant aimé le monde qu\'il a donné son Fils unique...';
  if (text.length > 100) text = text.slice(0, 100) + '…';

  const html = isGraduation
    ? _buildLTPreviewGraduation(s, ref, text)
    : _buildLTPreviewTourpac(s, ref, text);

  inner.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
//  EXPOSITION GLOBALE
// ─────────────────────────────────────────────────────────────
window._refreshLTPreview = _refreshLTPreview;

console.warn('[ltPreview] Chargé ✓');