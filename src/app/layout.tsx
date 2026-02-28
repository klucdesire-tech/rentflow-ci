import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RentFlow CI — Gestion locative",
  description: "Plateforme de gestion locative pour la Côte d'Ivoire",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏠</text></svg>" },
};

const gs = String.raw`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; background: #F0F2F5; overflow-x: hidden; }
  button:hover { opacity: 0.90; transition: opacity .15s; }
  a { text-decoration: none; }
  input:focus, textarea:focus, select:focus { border-color: #6366F1 !important; outline: none; }

  /* ── Topbar mobile (masquée sur desktop) ── */
  .rf-topbar {
    display: none;
    background: #0F172A;
    padding: 12px 16px;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 400;
    width: 100%;
  }
  .rf-topbar-logo { color: #F8FAFC; font-weight: 800; font-size: 16px; }
  .rf-hamburger {
    background: none; border: none; color: #F8FAFC;
    cursor: pointer; font-size: 26px; padding: 4px 8px;
    line-height: 1; border-radius: 6px;
  }
  .rf-hamburger:hover { background: rgba(255,255,255,.1); }

  /* ── Overlay (fond sombre quand menu ouvert) ── */
  .rf-nav-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    z-index: 490;
    cursor: pointer;
  }
  .rf-nav-overlay.visible { display: block; }

  /* ── Grilles et layouts desktop ── */
  .rf-stats-grid  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 14px; }
  .rf-fin-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .rf-houses-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
  .rf-row2        { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rf-detail-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rf-detail-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .rf-filter-bar  { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
  .rf-contract-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .rf-welcome-card { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .rf-history-head { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; padding: 8px 12px; background: #F8FAFC; font-weight: 700; font-size: 11px; color: #6B7280; }
  .rf-history-row  { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; padding: 9px 12px; border-top: 1px solid #F1F5F9; font-size: 12px; color: #374151; }
  .rf-unpaid-send-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rf-tenant-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }

  /* ── Sidebar desktop (fixe, toujours visible) ── */
  .rf-sidebar {
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .rf-main {
    margin-left: 240px;
    flex: 1;
    padding: 26px 34px;
    max-width: calc(100vw - 240px);
    overflow-x: hidden;
  }

  @media (max-width: 1024px) {
    .rf-houses-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }

  /* ══════════════════════════════════════════
     MOBILE — sidebar masquée par défaut,
     s'ouvre en slide depuis la gauche
  ══════════════════════════════════════════ */
  @media (max-width: 768px) {

    /* Afficher la topbar mobile */
    .rf-topbar { display: flex !important; }

    /* Sidebar cachée hors-écran par défaut */
    .rf-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      height: 100vh !important;
      width: 280px !important;
      transform: translateX(-100%) !important;
      z-index: 500 !important;
      padding-top: 60px !important;
    }
    /* Sidebar visible quand .open */
    .rf-sidebar.open {
      transform: translateX(0) !important;
    }

    /* Main prend toute la largeur */
    .rf-main {
      margin-left: 0 !important;
      max-width: 100vw !important;
      width: 100% !important;
      padding: 14px !important;
    }

    /* Grilles adaptées mobile */
    .rf-stats-grid  { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
    .rf-fin-grid    { grid-template-columns: 1fr !important; }
    .rf-houses-grid { grid-template-columns: 1fr !important; }
    .rf-row2        { grid-template-columns: 1fr !important; }
    .rf-detail-2col { grid-template-columns: 1fr !important; }
    .rf-detail-3col { grid-template-columns: 1fr !important; }

    /* Filtres en colonne */
    .rf-filter-bar  { flex-direction: column !important; }
    .rf-filter-bar input,
    .rf-filter-bar select { max-width: 100% !important; width: 100% !important; }

    /* Historique simplifié */
    .rf-history-head { display: none !important; }
    .rf-history-row  { grid-template-columns: 1fr 1fr !important; font-size: 11px !important; }

    /* Divers */
    .rf-contract-right  { flex-direction: row !important; flex-wrap: wrap !important; align-items: center !important; justify-content: flex-start !important; }
    .rf-welcome-card    { flex-direction: column !important; }
    .rf-unpaid-send-btns { grid-template-columns: 1fr !important; }
    .rf-page-title      { font-size: 18px !important; }
    .rf-form-card       { padding: 14px !important; }
    .rf-tenant-header   { padding: 10px 14px !important; }
    .tenant-name        { display: none !important; }
  }

  @media (max-width: 480px) {
    .rf-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
    .rf-history-row { grid-template-columns: 1fr !important; padding: 8px 10px !important; }
    .rf-history-row span { display: block; }
    .rf-main { padding: 10px !important; }
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: gs }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
