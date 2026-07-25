# Paiement MTN Mobile Money — Intégration API Collections

Ce document décrit l'intégration de l'**API officielle MTN MoMo Collections**
(« Request to Pay ») qui permet la **confirmation automatique** des paiements,
en remplacement de la validation manuelle par l'admin.

## 1. Principe du nouveau flux

```
Patient                    Backend T-Cardio              MTN MoMo API
  │ choisit pack + saisit     │                              │
  │ son numéro MoMo ────────► │ POST /payments/momo/         │
  │                           │      request-to-pay          │
  │                           │ crée Payment PENDING         │
  │                           │ ── requestToPay ───────────► │ (202 Accepted)
  │                           │                              │
  │ ◄──── popup PIN MoMo sur son téléphone ───────────────── │
  │ saisit son PIN (chez MTN, jamais chez nous)              │
  │                           │ ◄── callback (non signé) ─── │
  │                           │  RE-VÉRIFIE via GET status ─►│ SUCCESSFUL
  │  abonnement/crédits ◄──── │  octroi (exactement 1 fois)  │
  │  (polling /status aussi)  │                              │
```

Avantages vs USSD manuel :
- **Aucune action admin** : MTN confirme, le système octroie automatiquement.
- **Le PIN ne transite jamais par nous** : le payeur le saisit dans l'invite sécurisée MTN.
- **Réconciliation native** : `financialTransactionId` fourni par MTN.

Le flux USSD manuel reste disponible en **fallback** : si les variables MTN ne
sont pas configurées (`isMtnApiEnabled() === false`), le front utilise l'ancien flux.

## 2. Variables d'environnement

| Variable | Sandbox | Production (Côte d'Ivoire) |
|---|---|---|
| `MOMO_BASE_URL` | `https://sandbox.momodeveloper.mtn.com` | `https://proxy.momoapi.mtn.com` |
| `MOMO_TARGET_ENVIRONMENT` | `sandbox` | `mtnci` *(à confirmer avec MTN)* |
| `MOMO_CURRENCY` | `EUR` *(obligatoire en sandbox)* | `XOF` |
| `MOMO_COUNTRY_CODE` | `225` | `225` |
| `MOMO_SUBSCRIPTION_KEY` | Primary Key du produit Collections | idem (clé prod) |
| `MOMO_API_USER` | généré par le script | fourni par le Partner Portal |
| `MOMO_API_KEY` | généré par le script | fourni par le Partner Portal |
| `MOMO_CALLBACK_URL` | `https://t-cardio.org/api/v1/payments/momo/callback` | idem |

> Si `MOMO_SUBSCRIPTION_KEY` / `MOMO_API_USER` / `MOMO_API_KEY` sont vides,
> l'intégration est **désactivée** et l'app retombe sur l'USSD + validation admin.

## 3. Mise en route — SANDBOX (automatique)

1. Créer un compte sur https://momodeveloper.mtn.com
2. **Souscrire au produit « Collections »** → copier la **Primary Key**.
3. Lancer le script de provisioning (crée l'API User + API Key automatiquement) :

   ```bash
   MOMO_SUBSCRIPTION_KEY=<primary key> node backend/scripts/momo-sandbox-setup.js
   ```

   Il affiche `MOMO_API_USER` et `MOMO_API_KEY` à coller dans le `.env`.
4. Renseigner le `.env` :

   ```
   MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
   MOMO_TARGET_ENVIRONMENT=sandbox
   MOMO_CURRENCY=EUR
   MOMO_SUBSCRIPTION_KEY=...
   MOMO_API_USER=...
   MOMO_API_KEY=...
   ```
5. Redémarrer le backend. Au démarrage, le log affiche `MTN MoMo enabled: env=sandbox`.

## 4. Mise en production (action propriétaire — non automatisable)

Ces étapes nécessitent une démarche **commerciale/légale avec MTN** et ne peuvent
pas être réalisées par le code :

1. Créer le compte de production sur **https://momoapi.mtn.com** (distinct du sandbox).
2. **Souscrire au produit « Collections »** (production).
3. **Compléter le KYC + signer le contrat marchand** MTN pour la Côte d'Ivoire
   (documents d'entreprise, validation par MTN — délai variable).
4. Récupérer la **subscription key de production** (profil → Collections).
5. Obtenir l'**API User + API Key de production** via le **Partner Portal** MTN
   (URL communiquée par votre account manager — ce ne sont PAS ceux du sandbox).
6. Confirmer la valeur exacte de `MOMO_TARGET_ENVIRONMENT` pour la CI (`mtnci`).
7. Configurer les variables prod (host `proxy.momoapi.mtn.com`, devise `XOF`) et déployer.

> Tant que ces étapes ne sont pas faites, le code est **prêt mais inactif en prod** ;
> le fallback USSD + validation admin reste opérationnel.

## 5. Endpoints

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/payments/momo/config` | public | `{ apiEnabled: boolean }` — le front choisit le flux |
| POST | `/payments/momo/request-to-pay` | PATIENT | Initie le paiement (body: `type`, `packageId`, `msisdn`) |
| POST | `/payments/momo/:id/status` | PATIENT | Poll + finalise (à appeler pendant l'attente) |
| POST | `/payments/momo/callback` | public | Callback MTN (re-vérifié, réponse générique) |

## 6. Sécurité — défenses implémentées

- **Callback non signé → jamais cru sur parole.** Le body ne sert qu'à retrouver
  le paiement (par `externalId`/`referenceId`, validés en UUID) ; le statut est
  **re-vérifié** via un appel GET authentifié avant tout octroi.
- **Octroi exactement-une-fois.** `updateMany(status != COMPLETED → COMPLETED)`
  « réclame » la complétion de façon atomique avant d'octroyer ; callback + polling
  concurrents ne peuvent pas créditer deux fois.
- **Montant serveur-autoritaire.** La valeur octroyée vient du `packageId` enregistré
  côté serveur, jamais du montant renvoyé par MTN.
- **Pas de fuite de secret.** Clé d'abonnement / API key / token jamais loggés.
  Le PIN du flux USSD n'est plus persisté.
- **IDOR fermé.** `GET /payments/:id` est scopé par patient (admin exempté).
- **Callback durci.** Réponse générique `{received:true}` (pas d'oracle d'existence),
  rate-limit, identifiants validés en UUID.

## 7. Recommandation — backstop d'idempotence en base (M2)

La garantie exactement-une-fois est assurée au niveau applicatif. Pour un filet de
sécurité au niveau base (defense in depth), ajouter — **après avoir vérifié l'absence
de doublons historiques** :

```sql
-- 1) Vérifier les doublons existants AVANT d'appliquer :
SELECT payment_id, COUNT(*) FROM subscriptions
  WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING COUNT(*) > 1;
SELECT payment_id, COUNT(*) FROM credit_transactions
  WHERE payment_id IS NOT NULL AND type = 'PURCHASE'
  GROUP BY payment_id HAVING COUNT(*) > 1;

-- 2) Si aucun doublon, poser les contraintes (NULL multiples autorisés) :
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscription_payment
  ON subscriptions (payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_purchase_payment
  ON credit_transactions (payment_id) WHERE type = 'PURCHASE' AND payment_id IS NOT NULL;
```

> Non appliqué automatiquement : le schéma de prod a divergé des migrations versionnées,
> une migration à l'aveugle serait risquée. À exécuter manuellement après contrôle des données.

## 8. Note d'implémentation

`X-Reference-Id` (l'identifiant de transaction MTN) est stocké dans la colonne
unique `fedapayTransactionId` (nom historique réutilisé comme « identifiant de
transaction externe » — pas de migration nécessaire). De même `fedapayPaymentMethod`
sert de discriminateur de canal (`MTN_MOMO_API` ou `MOMO_LOCAL`).
