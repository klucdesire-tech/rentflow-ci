# 🏠 RentFlow CI

Plateforme de gestion locative pour la Côte d'Ivoire.

## Stack
- **Next.js 14** (App Router)
- **TypeScript**
- **React 18**
- Styles inline (aucune dépendance CSS externe)
- Persistance via `localStorage`

## Déploiement sur Vercel

### Option 1 — Vercel CLI (recommandé)
```bash
npm i -g vercel
cd rentflow
npm install
vercel
```

### Option 2 — GitHub + Vercel Dashboard
1. Pushez ce dossier sur un repo GitHub
2. Allez sur [vercel.com](https://vercel.com) → **New Project**
3. Importez votre repo
4. Vercel détecte automatiquement Next.js — cliquez **Deploy**
5. ✅ C'est en ligne !

### Option 3 — Drag & Drop
1. Buildez localement : `npm run build`
2. Uploadez le dossier `.next` sur [vercel.com/new](https://vercel.com/new)

## Développement local
```bash
npm install
npm run dev
# → http://localhost:3000
```

## Comptes démo
| Rôle        | Identifiant | Code |
|-------------|-------------|------|
| Propriétaire| —           | 0000 |
| Locataire 1 | C001        | 1234 |
| Locataire 2 | C002        | 5678 |
| Locataire 3 | C003        | 9999 |

## Structure
```
src/
├── app/
│   ├── layout.tsx     # Layout Next.js + metadata
│   └── page.tsx       # App complète (composants + styles)
├── hermes/            # HERMES — plateforme Data Analytics (voir ci-dessous)
├── lib/
│   ├── data.ts        # Constantes, données initiales, utils
│   └── useLocalStorage.ts  # Hook persistance
└── types/
    └── index.ts       # Types TypeScript
sql/hermes/            # Entrepôt de données Postgres / Supabase
```

## 📈 HERMES Analytics

HERMES n'est plus seulement un agent d'analyse : c'est une plateforme Data
Analytics complète, accessible dans l'espace propriétaire (menu **HERMES Analytics**).

```
 Sources RentFlow        Data Engineering          Data Warehouse           BI / Dashboards
 ────────────────        ────────────────          ──────────────           ───────────────
 rf_houses      ─┐       extract → staging         dim_date                 Couche sémantique
 rf_contracts   ─┼──▶    contrôles qualité   ──▶   dim_property      ──▶    (15 métriques, 12 dimensions)
 payments       ─┘       quarantaine               dim_lease                 ├─ Tableau de bord
                         lignage, journal          dim_channel               ├─ Explorateur BI + SQL + CSV
                                                   fact_rent                 └─ Agent HERMES (insights,
                                                   fact_occupancy               questions en langage naturel)
                                                   fact_deposit
```

| Couche | Fichiers | Rôle |
|---|---|---|
| **Data Engineering** | `src/hermes/engineering/` | Extraction et normalisation (dates fr-FR → ISO, périodes `AAAA-MM`), 15 contrôles qualité (unicité, intégrité référentielle, cohérence), quarantaine des lignes bloquantes, lignage, historique d'exécution. |
| **Data Warehouse** | `src/hermes/warehouse/`, `sql/hermes/` | Modèle en étoile au grain mensuel : 3 tables de faits, 4 dimensions. Calculé en mémoire dans l'app et déployable tel quel sur Postgres / Supabase. |
| **BI** | `src/hermes/bi/semantic.ts`, `sql.ts` | Couche sémantique : chaque métrique (recouvrement, ponctualité, occupation, perte de vacance…) est définie **une seule fois** et sert aux dashboards, à l'explorateur, à l'agent et au SQL généré. |
| **Dashboarding** | `src/hermes/ui/` | Tableau de bord filtrable (période, ville) avec KPI et variations, courbes, barres, heatmap de paiement ; explorateur (métriques × 2 dimensions, filtres, tableau croisé, export CSV, SQL équivalent). Graphiques SVG sans dépendance. |
| **Agent HERMES** | `src/hermes/bi/agent.ts` | Constats automatiques (tendance, concentration des impayés, vacance, canaux, prévision, qualité des données) et questions en français → requête sémantique. |

### Déployer l'entrepôt sur Postgres / Supabase
```bash
psql "$DATABASE_URL" -f sql/hermes/001_warehouse_schema.sql   # staging, étoile, journal
psql "$DATABASE_URL" -f sql/hermes/002_refresh_warehouse.sql  # fonction ELT hermes.refresh_warehouse()
psql "$DATABASE_URL" -f sql/hermes/003_marts.sql              # vues BI mart_* et kpi_monthly
# Charger hermes.stg_* depuis vos sources, puis :
psql "$DATABASE_URL" -c "SELECT hermes.refresh_warehouse();"
```
Les vues `hermes.mart_rent`, `mart_occupancy`, `mart_deposit` et `kpi_monthly` se
branchent directement sur Metabase, Superset, Power BI ou Looker Studio, avec les
mêmes libellés et définitions que l'app (bouton **Voir le SQL** dans l'explorateur).

## Corrections v14 → v_vercel
- ✅ `genPayments` rendu déterministe (seed basé sur startDate+rent)
- ✅ Typage TypeScript complet sur tous les composants
- ✅ Persistance `localStorage` (données conservées après refresh)
- ✅ `"use client"` correctement placé
- ✅ Suppression des template literals mal fermés
- ✅ Validation formulaires améliorée avec toast d'erreur
- ✅ Structure projet prête pour Vercel / Next.js App Router
