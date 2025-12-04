# 🌱 Aux P'tits Pois

Site web pour AMAP avec réservation de paniers et paiement en ligne.

## C'est quoi ce projet ?

Aux P'tits Pois c'est une plateforme pour une AMAP (Association pour le Maintien d'une Agriculture Paysanne). 

Les gens peuvent :
- Voir les producteurs et leurs produits
- Réserver des paniers
- Payer en ligne avec Stripe
- Choisir un point de retrait

Les admins peuvent :
- Gérer les paniers et les stocks
- Changer le thème du site selon les saisons
- Voir toutes les commandes

## Stack technique

**Frontend :**
- Next.js (React)
- CSS pur (pas de framework CSS)
- JavaScript (pas de TypeScript)

**Backend :**
- Node.js + Express
- PostgreSQL
- Prisma ORM

**Paiement :**
- Stripe

**Emails :**
- Nodemailer

## Structure du projet
```
aux-ptits-pois/
├── frontend/          # Application Next.js
│   ├── src/
│   │   ├── app/      # Pages
│   │   ├── components/
│   │   └── styles/
│   └── package.json
│
├── backend/           # API Express
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   └── services/
│   ├── prisma/
│   └── package.json
│
└── README.md
```

## Installation

### Prérequis

Tu dois avoir installé sur ton PC :
- Node.js (version 18 ou plus)
- PostgreSQL
- npm ou yarn

### Étapes d'installation

1. Clone le repo
```bash
git clone https://github.com/ton-username/aux-ptits-pois.git
cd aux-ptits-pois
```

2. Installe le backend
```bash
cd backend
npm install
```

3. Configure la base de données

Crée un fichier `.env` dans le dossier `backend/` :
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aux_ptits_pois"
PORT=4000
NODE_ENV=development

JWT_SECRET="ton-super-secret-jwt-ici"
JWT_EXPIRE="7d"

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="ton-email@gmail.com"
EMAIL_PASSWORD="ton-mot-de-passe"
EMAIL_FROM="noreply@auxptitspois.com"

FRONTEND_URL="http://localhost:3000"
```

4. Crée la base de données
```bash
npx prisma migrate dev --name init
```

5. Remplis la base avec des données de test (optionnel)
```bash
npm run seed
```

6. Lance le backend
```bash
npm run dev
```

Le backend tourne sur http://localhost:4000

7. Dans un autre terminal, installe le frontend
```bash
cd ../frontend
npm install
```

8. Configure le frontend

Crée un fichier `.env.local` dans le dossier `frontend/` :
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
NEXT_PUBLIC_STRIPE_PUBLIC_KEY="pk_test_..."
```

9. Lance le frontend
```bash
npm run dev
```

Le site est accessible sur http://localhost:3000

## Commandes utiles

### Backend
```bash
npm run dev          # Lance le serveur en mode développement
npm start            # Lance le serveur en production
npm run migrate      # Applique les migrations Prisma
npm run seed         # Remplit la base avec des données de test
```

### Frontend
```bash
npm run dev          # Lance Next.js en mode dev
npm run build        # Build pour la production
npm start            # Lance en production
```

## Fonctionnalités principales

### Pour les clients
- ✅ Voir les paniers disponibles
- ✅ Consulter les producteurs
- ✅ Créer un compte
- ✅ Réserver des paniers
- ✅ Payer en ligne (Stripe)
- ✅ Choisir un point de retrait
- ✅ Voir l'historique des commandes

### Pour les admins
- ✅ Dashboard d'administration
- ✅ Gérer les producteurs
- ✅ Gérer les paniers et les stocks
- ✅ Voir toutes les commandes
- ✅ Changer le thème saisonnier
- ✅ Écrire des articles de blog

## Base de données

Le projet utilise PostgreSQL avec Prisma.

Schéma principal :
- **Users** : Utilisateurs (clients, admins)
- **Producers** : Producteurs locaux
- **Products** : Produits des producteurs
- **BasketType** : Types de paniers
- **BasketAvailability** : Stock de paniers disponibles
- **Orders** : Commandes
- **Payments** : Paiements Stripe
- **ThemeConfig** : Thèmes saisonniers

Pour voir le schéma complet : `backend/prisma/schema.prisma`

## Thèmes saisonniers

Le site change de couleurs selon la saison :
- 🌸 **Printemps** : Vert clair, jaune
- ☀️ **Été** : Jaune, orange
- 🍂 **Automne** : Orange, rouge
- ❄️ **Hiver** : Bleu, bleu foncé

Seul un admin peut changer la saison active.

## Emails automatiques

Le site envoie des emails pour :
- Création de compte
- Validation d'email
- Mot de passe oublié
- Confirmation de commande
- Confirmation de paiement
- Commande prête pour retrait
- Rappel de retrait

## Sécurité

- Mots de passe hashés avec bcrypt
- Authentification JWT
- Protection CORS
- Rate limiting sur l'API
- Validation des données

## Déploiement

### Frontend (Vercel recommandé)
```bash
cd frontend
vercel
```

### Backend (Railway, Render ou autre)
1. Configure les variables d'environnement
2. Connecte la base PostgreSQL
3. Lance `npm run migrate`
4. Lance `npm start`

## Contribution

Si tu veux contribuer :
1. Fork le projet
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit tes changements (`git commit -m 'Ajout de ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvre une Pull Request

## Problèmes courants

**Le backend ne démarre pas**
- Vérifie que PostgreSQL est bien lancé
- Vérifie ton fichier `.env`
- Vérifie que la base de données existe

**Erreur Prisma**
- Lance `npx prisma generate`
- Vérifie ta `DATABASE_URL`

**Le frontend ne se connecte pas au backend**
- Vérifie que le backend tourne
- Vérifie `NEXT_PUBLIC_API_URL` dans `.env.local`

## Auteur

Ton nom - Aux P'tits Pois

## License

MIT