# 🌱 Aux P'tits Pois - AMAP Website

Site web pour AMAP avec réservation de paniers et paiement en ligne.

## 📝 Description

Aux P'tits Pois c'est une plateforme pour une AMAP (Association pour le Maintien d'une Agriculture Paysanne). 

Les utilisateurs peuvent :
- Consulter les producteurs et leurs produits
- Réserver des paniers de produits locaux
- Payer en ligne avec Stripe
- Choisir un point de retrait

Les admins peuvent :
- Gérer les paniers et les stocks
- Personnaliser le thème selon les saisons
- Suivre les commandes et les paiements

## 🛠 Stack technique

**Frontend :**
- Next.js 15.5.7 (App Router)
- React 19
- CSS vanilla avec variables CSS
- JavaScript (pas de TypeScript pour l'instant)

**Backend :**
- Node.js + Express 4.21.1
- PostgreSQL
- Prisma ORM 5.22.0

**Autres :**
- Stripe pour les paiements
- Nodemailer pour les emails
- JWT pour l'authentification
- bcryptjs pour le hashing des mots de passe

## 📂 Structure du projet
```
amap-website/
├── frontend/               # Application Next.js
│   ├── src/
│   │   ├── app/           # Pages (App Router)
│   │   │   ├── layout.js
│   │   │   ├── page.js    # Page d'accueil
│   │   │   └── paniers/   # Route /paniers
│   │   ├── components/
│   │   │   ├── home/      # Composants page d'accueil
│   │   │   ├── layout/    # Header, Footer
│   │   │   └── baskets/   # Composants paniers
│   │   └── styles/
│   │       ├── variables.css    # Variables CSS + thèmes
│   │       ├── globals.css      # Styles globaux
│   │       ├── components/      # Styles des composants
│   │       └── pages/           # Styles des pages
│   ├── public/
│   │   └── icons/         # 100+ icônes PNG
│   └── package.json
│
├── backend/               # API Express
│   ├── src/
│   │   ├── routes/        # Routes API
│   │   ├── controllers/   # Logique métier
│   │   ├── middlewares/   # Auth, validation, etc.
│   │   ├── services/      # Services (email, stripe, stock)
│   │   └── utils/         # Utilitaires
│   ├── prisma/
│   │   ├── schema.prisma  # Schéma de la base
│   │   └── seed.js        # Données de test
│   └── package.json
│
└── README.md
```

## 🚀 Installation

### Prérequis

- Node.js v18 ou supérieur
- PostgreSQL 14+
- npm ou yarn
- Un compte Stripe (mode test pour le développement)

### Installation du backend

1. Clone le repo
```bash
git clone https://github.com/ton-username/aux-ptits-pois.git
cd aux-ptits-pois
```

2. Installe les dépendances backend
```bash
cd backend
npm install
```

3. Configure les variables d'environnement

Crée un fichier `.env` dans `backend/` :
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aux_ptits_pois"
PORT=4000
NODE_ENV=development

# JWT
JWT_SECRET="votre-secret-jwt-super-securise"
JWT_EXPIRE="7d"

# Stripe
STRIPE_SECRET_KEY="sk_test_votre_cle_stripe"
STRIPE_WEBHOOK_SECRET="whsec_votre_webhook_secret"

# Email (exemple avec Gmail)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="votre.email@gmail.com"
EMAIL_PASSWORD="votre-mot-de-passe-app"
EMAIL_FROM="noreply@auxptitspois.com"

# Frontend URL
FRONTEND_URL="http://localhost:3000"
```

4. Crée la base de données PostgreSQL
```bash
createdb amap_db
```

5. Applique les migrations Prisma
```bash
npx prisma migrate dev
```

6. (Optionnel) Remplis la base avec des données de test
```bash
npm run seed
```

7. Lance le serveur backend
```bash
npm run dev
```

Le backend sera accessible sur **http://localhost:4000**

### Installation du frontend

1. Dans un nouveau terminal, installe les dépendances frontend
```bash
cd frontend
npm install
```

2. Configure les variables d'environnement

Crée un fichier `.env.local` dans `frontend/` :
```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
NEXT_PUBLIC_STRIPE_PUBLIC_KEY="pk_test_votre_cle_publique_stripe"
```

3. Lance le serveur de développement
```bash
npm run dev
```

Le site sera accessible sur **http://localhost:3000**

## 📋 Commandes disponibles

### Backend
```bash
npm run dev          # Lance le serveur en mode dev (nodemon)
npm start            # Lance le serveur en production
npm run migrate      # Applique les migrations Prisma
npm run seed         # Remplit la base avec des données de test
npx prisma studio    # Ouvre l'interface Prisma Studio
```

### Frontend
```bash
npm run dev          # Lance Next.js en mode développement
npm run build        # Build pour la production
npm start            # Lance le serveur de production
npm run lint         # Vérifie le code avec ESLint
```

## ✨ Fonctionnalités

### Implémenté ✅
- Page d'accueil avec Hero, Featured Baskets, Why Us, How It Works
- Page /paniers avec filtres et liste des paniers
- Header responsive avec menu mobile
- Footer avec liens et réseaux sociaux
- Système de thèmes saisonniers (4 saisons)
- Services backend : email, stripe, stock management
- Gestion des réservations avec expiration (15min)
- Base de données complète avec Prisma

### En cours de développement 🚧
- Authentification utilisateur (JWT prêt, UI à faire)
- Intégration API frontend ↔ backend
- Page détail d'un panier
- Panier utilisateur et checkout
- Dashboard admin
- Gestion des producteurs

### À venir 📅
- Pages producteurs
- Blog
- Notifications en temps réel
- Export des commandes (CSV)
- Tests unitaires et d'intégration

## 🗄️ Base de données

### Modèles principaux

- **User** : Utilisateurs (CLIENT, ADMIN, SUPER_ADMIN)
- **Producer** : Producteurs locaux
- **Product** : Produits individuels
- **BasketType** : Types de paniers (Découverte, Famille, etc.)
- **BasketAvailability** : Stocks disponibles par semaine
- **Order** : Commandes (statuts: PENDING, PAID, READY, COMPLETED, CANCELLED)
- **OrderItem** : Lignes de commande
- **Payment** : Paiements Stripe
- **CartReservation** : Réservations temporaires (15min)
- **ThemeConfig** : Configuration des thèmes saisonniers

Voir le schéma complet : `backend/prisma/schema.prisma`

## 🎨 Thèmes et design

Le site utilise un système de thèmes saisonniers définis dans `frontend/src/styles/variables.css` :

- **Printemps** 🌸 (actif par défaut) : Vert pastel (#a7f3d0), Jaune (#fcd34d)
- **Été** ☀️ : Jaune vif, Orange
- **Automne** 🍂 : Orange, Rouge
- **Hiver** ❄️ : Bleu clair, Bleu indigo

Les couleurs s'appliquent automatiquement via `[data-theme="spring"]` sur le body.

## 📧 Emails automatiques

Le système envoie des emails HTML stylisés pour :
- Bienvenue nouvel utilisateur
- Confirmation d'email
- Réinitialisation de mot de passe
- Confirmation de commande
- Confirmation de paiement
- Commande prête pour retrait
- Rappel de retrait J-1
- Annulation de commande

Templates dans `backend/src/services/email.service.js`

## 🔒 Sécurité

- Mots de passe hashés avec bcryptjs (10 rounds)
- Authentification JWT avec expiration
- Middleware auth pour routes protégées
- Protection CORS configurée
- Validation des données d'entrée
- Sanitization des inputs
- Gestion sécurisée des webhooks Stripe

## 🌐 API Endpoints (backend)

### Auth
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `GET /api/auth/me` - Profil utilisateur (protégé)

### Baskets
- `GET /api/baskets` - Liste des paniers disponibles
- `GET /api/baskets/:id` - Détail d'un panier

### Orders
- `POST /api/orders` - Créer une commande
- `GET /api/orders/my-orders` - Mes commandes (protégé)
- `GET /api/orders/:id` - Détail d'une commande (protégé)

### Payments
- `POST /api/payments/create-intent` - Créer un PaymentIntent Stripe
- `POST /api/payments/confirm` - Confirmer un paiement
- `POST /api/payments/webhook` - Webhook Stripe

### Admin (routes protégées)
- `GET /api/admin/orders` - Toutes les commandes
- `PUT /api/admin/orders/:id/status` - Changer le statut
- Gestion producteurs, produits, thèmes...

## 🐛 Problèmes courants

**Le backend ne démarre pas**
- Vérifie que PostgreSQL tourne : `pg_isready`
- Vérifie les credentials dans `.env`
- Vérifie que la base `amap_db` existe

**Erreur Prisma "Client not generated"**
```bash
npx prisma generate
```

**Le frontend ne charge pas les icônes**
- Vérifie que `/frontend/public/icons/` contient les fichiers PNG
- Redémarre le serveur Next.js

**CORS error entre frontend et backend**
- Vérifie que `FRONTEND_URL` est correct dans le backend `.env`
- Le backend doit tourner sur port 4000

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Crée une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit tes changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvre une Pull Request

## 📜 License

MIT License - voir le fichier LICENSE pour plus de détails

## 👨‍💻 Auteur

**Ludovic B.** - [B-ludovic](https://github.com/B-ludovic)

---

Fait avec ❤️ pour les AMAP et l'agriculture locale
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