<p align="center">
  <img src="T-Cardio.png" alt="T-Cardio Logo" width="200"/>
</p>

<h1 align="center">T-Cardio Pro</h1>

<p align="center">
  <strong>Plateforme de suivi cardiovasculaire intelligente pour l'Afrique</strong>
</p>

<p align="center">
  <a href="https://t-cardio.org">Site Web</a> &bull;
  <a href="#fonctionnalites">Fonctionnalites</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#installation">Installation</a>
</p>

---

## A propos

T-Cardio Pro est une plateforme medicale complete de suivi de l'hypertension arterielle, concue pour les professionnels de sante et les patients en Afrique. Elle permet le suivi en temps reel de la tension arterielle, les teleconsultations video, la messagerie securisee medecin-patient, et l'analyse IA des mesures.

**Site en production :** [https://t-cardio.org](https://t-cardio.org)

---

## Fonctionnalites

### Pour les patients
- **Mesure de tension** : Saisie manuelle ou scan OCR du tensiometre via camera
- **Tableau de bord** : Historique des mesures avec graphiques et tendances
- **Analyse IA** : Interpretation automatique des mesures avec alertes
- **Teleconsultation video** : Appels video en temps reel avec le medecin
- **Messagerie securisee** : Communication chiffree avec le medecin traitant
- **Rappels medicaments** : Suivi des traitements avec notifications
- **Score de risque** : Evaluation cardiovasculaire personnalisee
- **Gamification** : Badges, objectifs et classement pour encourager le suivi

### Pour les medecins
- **Dashboard medecin** : Vue d'ensemble des patients avec distribution des risques
- **Gestion des patients** : Liste, recherche, historique medical complet
- **Teleconsultations** : Planification et appels video integres
- **Ordonnances** : Creation et envoi d'ordonnances numeriques
- **Rapports** : Generation de rapports medicaux detailles
- **Portefeuille** : Gestion des revenus de consultation
- **Agenda** : Rendez-vous et disponibilites

### Pour les administrateurs
- **Dashboard admin** : Statistiques globales, croissance utilisateurs, revenus
- **Gestion des medecins** : Validation des profils medecins
- **Gestion des paiements** : Suivi des transactions et retraits
- **Communication** : Envoi de notifications push globales
- **Publicites** : Gestion des annonces in-app
- **Audit** : Journal d'audit complet

### Fonctionnalites techniques
- **OCR Tensiometre** : Reconnaissance optique des valeurs sur photo du tensiometre (via OpenAI Vision)
- **Paiement Mobile Money** : Integration MTN MoMo via USSD silencieux
- **Detection SIM** : Selection automatique de la SIM MTN sur dual-SIM
- **Push Notifications** : Alertes en temps reel (appels, messages, urgences)
- **WebRTC** : Teleconsultation video peer-to-peer
- **Alertes d'urgence** : Detection automatique des valeurs critiques

---

## Captures d'ecran

### Dashboard Medecin
Vue d'ensemble avec statistiques patients, distribution des risques et liste des patients avec leurs dernieres mesures.

### Gestion des Patients
Liste complete des patients avec statut medical, dernieres mesures de tension et niveau de risque.

### Messagerie
Conversations securisees entre medecins et patients avec historique complet.

### Teleconsultations
Planification et gestion des teleconsultations video en temps reel.

### Application Mobile (Android)
Application native Android wrappant le site web avec support camera, paiement USSD et notifications push.

---

## Architecture

```
T-Cardio/
├── backend/              # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── routes/       # Routes API REST
│   │   ├── services/     # Logique metier
│   │   ├── middleware/   # Auth, validation, rate-limiting
│   │   └── utils/        # Helpers (OCR, email, push, etc.)
│   └── prisma/           # Schema & migrations PostgreSQL
│
├── frontend-web/         # Next.js 14 + React 18 + Tailwind CSS
│   ├── app/              # App Router (pages & layouts)
│   ├── components/       # Composants reutilisables
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # API client, sockets, utils
│   └── stores/           # Zustand state management
│
├── android-wrapper/      # Application Android native (WebView)
│   └── app/src/main/
│       └── java/.../     # MainActivity avec camera, USSD, SIM
│
├── frontend-mobile/      # App Capacitor (patient)
├── nginx/                # Configuration reverse proxy
└── docker-compose.yml    # Orchestration des services
```

### Stack technique

| Composant | Technologie |
|-----------|------------|
| **Backend** | Node.js, Express, TypeScript |
| **Base de donnees** | PostgreSQL + Prisma ORM |
| **Frontend** | Next.js 14, React 18, Tailwind CSS |
| **State Management** | Zustand, TanStack React Query |
| **Temps reel** | Socket.io (WebSocket) |
| **Video** | WebRTC peer-to-peer |
| **Auth** | JWT (access + refresh tokens) |
| **IA / OCR** | OpenAI Vision API |
| **Paiement** | MTN Mobile Money (USSD) |
| **Push** | Web Push API + VAPID |
| **Android** | WebView + Capacitor |
| **Deploiement** | Docker, Nginx, Let's Encrypt |

---

## Installation

### Prerequis
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optionnel)

### Developpement local

```bash
# Cloner le repo
git clone https://github.com/Terranoweb2/T-Cardio-App.git
cd T-Cardio-App

# Configurer les variables d'environnement
cp .env.example .env

# Installer les dependances
cd backend && npm install
cd ../frontend-web && npm install

# Configurer la base de donnees
cd ../backend
npx prisma migrate dev
npx prisma db seed

# Lancer le backend
npm run dev

# Lancer le frontend (autre terminal)
cd ../frontend-web
npm run dev
```

### Deploiement Docker

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Build APK Android

```bash
cd android-wrapper
./gradlew assembleRelease
# APK genere dans app/build/outputs/apk/release/
```

---

## API

L'API REST est disponible sur `/api/v1/` avec les endpoints principaux :

| Endpoint | Description |
|----------|------------|
| `POST /auth/login` | Authentification |
| `POST /auth/register` | Inscription |
| `GET /measurements` | Liste des mesures |
| `POST /measurements` | Nouvelle mesure |
| `POST /measurements/ocr` | Scan OCR tensiometre |
| `GET /doctor/patients` | Patients du medecin |
| `POST /teleconsultations` | Creer une teleconsultation |
| `GET /messaging/conversations` | Conversations |
| `POST /ai/analyze` | Analyse IA des mesures |
| `GET /credits/balance` | Solde credits patient |

---

## Securite

- Authentification JWT avec refresh token (365 jours)
- Refresh proactif toutes les 7 jours
- Rate limiting sur les endpoints sensibles
- Validation Zod sur toutes les entrees
- HTTPS obligatoire (Let's Encrypt)
- Cookies HttpOnly + SameSite
- Protection CSRF
- Audit log complet (admin)

---

## Licence

Projet proprietaire - Terrano Web Solutions

---

<p align="center">
  <sub>Developpe avec ❤️ pour l'Afrique par <strong>Terrano Web</strong></sub>
</p>
