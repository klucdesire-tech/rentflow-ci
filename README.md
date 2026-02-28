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
├── lib/
│   ├── data.ts        # Constantes, données initiales, utils
│   └── useLocalStorage.ts  # Hook persistance
└── types/
    └── index.ts       # Types TypeScript
```

## Corrections v14 → v_vercel
- ✅ `genPayments` rendu déterministe (seed basé sur startDate+rent)
- ✅ Typage TypeScript complet sur tous les composants
- ✅ Persistance `localStorage` (données conservées après refresh)
- ✅ `"use client"` correctement placé
- ✅ Suppression des template literals mal fermés
- ✅ Validation formulaires améliorée avec toast d'erreur
- ✅ Structure projet prête pour Vercel / Next.js App Router
