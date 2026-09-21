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
│   ├── page.tsx       # RentFlow (composants + styles)
│   └── mon-prof/      # Mon Prof — professeur particulier IA (voir plus bas)
├── lib/
│   ├── data.ts        # Constantes, données initiales, utils
│   ├── useLocalStorage.ts  # Hook persistance
│   └── monprof/       # Moteur pédagogique de Mon Prof
└── types/
    ├── index.ts       # Types RentFlow
    └── monprof.ts     # Types Mon Prof
```

## Corrections v14 → v_vercel
- ✅ `genPayments` rendu déterministe (seed basé sur startDate+rent)
- ✅ Typage TypeScript complet sur tous les composants
- ✅ Persistance `localStorage` (données conservées après refresh)
- ✅ `"use client"` correctement placé
- ✅ Suppression des template literals mal fermés
- ✅ Validation formulaires améliorée avec toast d'erreur
- ✅ Structure projet prête pour Vercel / Next.js App Router


---

# 🎓 Mon Prof — professeur particulier

Application de tutorat disponible sur la route **`/mon-prof`** (ex. `http://localhost:3000/mon-prof`).
Elle est autonome : elle ne partage avec RentFlow que le projet Next.js.

Mon Prof n'est pas un chatbot qui parle du cours. C'est un **moteur pédagogique** :
il explique, questionne, analyse la réponse, remédie, fait pratiquer, puis valide —
et il ne passe à l'étape suivante que lorsque la maîtrise a été *démontrée*.

## Le principe de fonctionnement

```
DIAGNOSTIC → EXPLICATION → QUESTION → ANALYSE
                              ↙            ↘
                        ERREUR          RÉUSSITE
                          ↓                 ↓
                    REMÉDIATION      APPROFONDISSEMENT
                          ↘            ↙
                           EXERCICE
                              ↓
                         VALIDATION
                              ↓
                        ÉTAPE SUIVANTE
```

Une notion n'est jamais validée parce que l'élève dit « oui ». `canValidate()` exige
quatre preuves distinctes **et** un exercice différent de l'exemple du cours :

| Dimension | Ce qu'il faut démontrer | Seuil |
|-----------|-------------------------|-------|
| Comprendre | Expliquer la notion avec ses mots | 70 % |
| Identifier | Reconnaître la méthode à utiliser | 60 % |
| Appliquer  | Réussir un calcul | 70 % |
| Raisonner  | Justifier son résultat | 60 % |
| Transfert  | Réussir un exercice de difficulté ≥ 2 | obligatoire |

Tant qu'il manque quelque chose, Mon Prof **change de stratégie d'explication**
(simple → exemple → analogie → visuel → démonstration → reformulation) plutôt que
de répéter la même chose, puis reteste la dimension la plus faible.

## Les sept moteurs

| Fichier | Rôle |
|---------|------|
| `lib/monprof/tutor.ts` | Machine à états : conduite du cours, modes explication / question / coach / correction / révision / examen / défi |
| `lib/monprof/mastery.ts` | Niveau de maîtrise par dimension, règle de validation, prérequis, révision espacée |
| `lib/monprof/answer.ts` | Détection d'intention (« je ne comprends pas », « indice », « examen »…), correction des réponses, détection des erreurs typiques |
| `lib/monprof/parser.ts` | Transformation d'un cours brut en progression : chapitres → notions → prérequis → exercices |
| `lib/monprof/expr.ts` | Évaluateur d'expressions (sans `eval`) : reconnaît les calculs du cours et en génère des variantes vérifiées |
| `lib/monprof/voice.ts` | Voix du professeur (synthèse vocale) et micro (reconnaissance vocale) |
| `lib/monprof/storage.ts` | Mémoire de l'élève : progression, erreurs fréquentes, diagnostic — `localStorage` |

## Ce que l'élève voit

- **Le tableau** se construit au fil de l'explication (définitions, formules, étapes de calcul, points à retenir).
- **La conversation** avec Mon Prof : explications, questions, indices gradués (3 niveaux), corrections.
- **La progression** : maîtrise du cours, statut de chaque étape (🟢 acquis · 🟠 en cours · 🔴 non acquis · 🔒 verrouillé par un prérequis).
- **Les quatre barres de maîtrise** de l'étape en cours, qui montrent exactement ce qu'il reste à démontrer.
- **« Ce que je retiens de toi »** : les erreurs revenues plusieurs fois, conservées d'une session à l'autre.

Raccourcis reconnus dans la zone de réponse : *je ne comprends pas*, *explique autrement*,
*un indice*, *donne la réponse*, *examen*, *révision*, *plus dur*.

## Apporter son propre cours

Écran **Coller mon cours** : coller du texte ou importer un `.txt` / `.md`. L'analyseur
découpe le cours en notions, chaîne les prérequis et prépare explications, vérifications
et exercices.

Les exercices chiffrés ne sont générés que lorsqu'un calcul du cours a été **reconnu et
vérifié** (le résultat annoncé par le cours est recalculé ; s'il ne correspond pas, le
calcul est ignoré). Mon Prof n'invente donc jamais une réponse numérique. Pour le reste
du contenu, il produit des questions de compréhension, d'explication et de raisonnement,
corrigées par mots-clés.

## Limites assumées de cette version

- **Pas d'appel à un LLM** : le comportement pédagogique est déterministe et embarqué.
  Les réponses ouvertes sont évaluées par mots-clés, pas par compréhension sémantique.
- **Pas d'extraction PDF** : ouvrir le PDF et coller le texte (l'application le dit).
- **Voix** : dépend du navigateur (Web Speech API). Absente ⇒ tout fonctionne à l'écrit.
- **Données locales** : tout reste dans le navigateur, aucun compte, aucun serveur.

## Cours intégrés

Deux cours écrits à la main servent de référence de qualité pour l'analyseur :
**Les pourcentages** (4 notions) et **Statistiques descriptives** (6 notions, des données
à l'écart-type).
