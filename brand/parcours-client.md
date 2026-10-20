# Parcours client monwifizone

Ce document décrit **tout ce que le client voit**, écran par écran, du moment où il se connecte au WiFi jusqu'à la fin de son forfait.

- Les couleurs, les polices et le ton viennent de [charte.md](charte.md).
- Le logo est [logo-v2.svg](logo-v2.svg) (le ticket bleu avec les ondes orange).
- Les textes entre guillemets « … » sont **les textes exacts** à afficher.
- Les prix et durées des forfaits sont des **exemples** : remplace-les par tes vrais tarifs.

---

## 0. Le parcours en un coup d'œil

```
Le client se connecte au WiFi "monwifizone"
                │
                ▼
        [E1] Accueil du portail
           │                  │
   "J'ai déjà un code"   "Acheter un ticket"
           │                  │
           │                  ▼
           │          [E2] Choix du forfait
           │                  │
           │                  ▼
           │          [E3] Paiement
           │                  │
           │                  ▼
           │          [E4] Attente de confirmation ──► [P1] Paiement échoué
           │                  │                     └► [P2] Délai dépassé
           │                  ▼
           │          [E5] Ton ticket  ◄────────────── [P5] Retrouver mon ticket
           │                  │                        (si la page a été fermée)
           ▼                  ▼
        [E6] Entrer mon code ───────────────────────► [P3] Code faux
                │                                   └► [P4] Code déjà utilisé
                ▼
        [E7] Tu es connecté
                │
                ▼
        [E8] Forfait terminé ──► retour à [E2]
```

**Écrans normaux** : E1 à E8.
**Écrans de problème** : P1 à P5.

---

## 1. Règles communes à tous les écrans

Ces règles valent pour **chaque** écran du portail.

| Élément | Règle |
|---|---|
| En haut | Le logo v2, centré, 40 px de haut. |
| Fond de page | `#F7F8FA` |
| Bloc central | Carte blanche `#FFFFFF`, coins arrondis, une seule action principale. |
| Titre | 24 px, gras, bleu nuit `#0F2A5C`. |
| Texte | 16 px, couleur `#1A2233`. |
| Bouton principal | Fond orange `#FF8A00`, **texte bleu nuit** `#0F2A5C`, gras, toute la largeur, au moins 48 px de haut. |
| Bouton secondaire | Fond blanc, bordure et texte bleu nuit `#0F2A5C`. |
| Police | Police du téléphone (`system-ui`), car **pas d'Internet** sur le portail. |
| Poids de la page | Le plus léger possible : pas d'image lourde, pas de police à télécharger. |
| En bas | « Besoin d'aide ? Appelle le 07 00 00 00 00 » (mets ton vrai numéro). |

> ⚠️ **Note technique importante** : sur le portail, le client n'a pas Internet.
> Pour qu'il puisse payer, il faut autoriser l'accès aux sites de paiement (Mobile Money)
> **avant** la connexion. C'est ce qu'on appelle la « liste blanche » (ou *walled garden*)
> du routeur WiFi.

---

## 2. Les écrans normaux

### E1 — Accueil du portail

**Quand ?** Le client vient de choisir le WiFi « monwifizone » sur son téléphone. La page s'ouvre toute seule.

**Ce qu'il voit :**

> **Titre :** « Bienvenue sur monwifizone »
>
> **Texte :** « Internet rapide, payé en Mobile Money. »
>
> **Bouton principal (orange) :** « Acheter un ticket »
>
> **Bouton secondaire :** « J'ai déjà un code »
>
> **Petit lien :** « J'ai payé mais je n'ai pas vu mon code »

**Ce qu'il fait :**

- « Acheter un ticket » → **E2**
- « J'ai déjà un code » → **E6**
- « J'ai payé mais je n'ai pas vu mon code » → **P5**

---

### E2 — Choix du forfait

**Ce qu'il voit :**

> **Titre :** « Choisis ton forfait »
>
> Une liste de cartes. Une carte = un forfait :
>
> | Durée | Prix |
> |---|---|
> | « 1 heure » | « 100 F » |
> | « 1 jour » | « 300 F » |
> | « 1 semaine » | « 1 500 F » |
> | « 1 mois » | « 5 000 F » |
>
> Le prix est écrit en gras, bleu nuit. Une petite pastille orange « Le plus choisi » sur un forfait.
>
> **Bouton principal :** « Continuer » (gris tant qu'aucun forfait n'est choisi)
>
> **Lien retour :** « Retour »

**Ce qu'il fait :** il touche une carte (elle se met en bordure orange), puis « Continuer » → **E3**.

---

### E3 — Paiement

**Ce qu'il voit :**

> **Titre :** « Paye ton ticket »
>
> **Rappel :** « Forfait 1 jour — 300 F »
>
> **Question :** « Avec quoi tu payes ? »
> Une liste de boutons avec le nom de chaque moyen de paiement Mobile Money que tu acceptes
> (écrit en texte simple, sans logo d'opérateur).
>
> **Champ :** « Ton numéro de téléphone »
> Exemple gris dans le champ : « 07 00 00 00 00 »
>
> **Petit texte :** « On t'enverra aussi ton code par SMS sur ce numéro. »
>
> **Bouton principal :** « Payer 300 F »

**Ce qu'il fait :** il choisit son moyen de paiement, tape son numéro, touche « Payer ».

**Si le numéro est mal tapé** (trop court, lettres…), le champ devient rouge `#C62828` et on affiche dessous :

> « Ce numéro n'est pas complet. Il faut 10 chiffres. »

Sinon → **E4**.

> 💡 Le numéro de téléphone est très important : il sert à **envoyer le code par SMS**
> et à **retrouver le ticket** si le client ferme la page (voir P5).

---

### E4 — Attente de confirmation

**Ce qu'il voit :**

> **Une petite roue qui tourne** (orange).
>
> **Titre :** « Confirme sur ton téléphone »
>
> **Texte :** « Tu vas recevoir une demande de paiement. Tape ton code secret Mobile Money pour valider. »
>
> **Texte petit :** « Ne ferme pas cette page. »
>
> **Compteur :** « Il te reste 2:00 pour valider. »

**Ce qui se passe :**

- Paiement validé → **E5**
- Paiement refusé ou annulé → **P1**
- Rien après 2 minutes → **P2**

---

### E5 — Ton ticket

**Quand ?** Le paiement est accepté.

**Ce qu'il voit :**

> **Icône ✓ verte** `#1E7B46`
>
> **Titre :** « Paiement reçu »
>
> **Texte :** « Voici ton code : »
>
> **Le code**, très gros (32 px), gras, bleu nuit, dans un cadre en forme de ticket (comme le logo) :
> « **4821-7730** »
>
> **Bouton secondaire :** « Copier le code »
> (après le clic, le bouton affiche « Code copié ✓ » pendant 2 secondes)
>
> **Texte :** « On t'a aussi envoyé ce code par SMS. »
>
> **Rappel :** « Forfait 1 jour. Valable jusqu'au 21/10 à 14 h 30. »
>
> **Bouton principal :** « Me connecter maintenant »

**Ce qu'il fait :** il touche « Me connecter maintenant » → connexion directe → **E7**
(pas besoin de retaper le code : on le remplit pour lui).

**SMS envoyé en même temps** (court, sans accent pour éviter les soucis d'affichage) :

```
monwifizone : ton code est 4821-7730. Forfait 1 jour, valable jusqu'au 21/10 14h30. Garde ce SMS.
```

---

### E6 — Entrer mon code

**Ce qu'il voit :**

> **Titre :** « Entre ton code »
>
> **Champ :** « Ton code » — exemple gris : « 0000-0000 »
> (le tiret se met tout seul, seuls les chiffres sont acceptés)
>
> **Bouton principal :** « Me connecter »
>
> **Petit lien :** « Je n'ai pas de code ? Acheter un ticket »

**Ce qui se passe :**

- Code bon → **E7**
- Code qui n'existe pas → **P3**
- Code déjà utilisé sur un autre téléphone → **P4**
- Code dont le forfait est fini → **E8**

---

### E7 — Tu es connecté

**Ce qu'il voit :**

> **Icône ✓ verte**
>
> **Titre :** « Tu es connecté »
>
> **Texte :** « Bonne navigation ! »
>
> **Bloc info :**
> « Il te reste **23 h 58 min**. »
> « Ton code : 4821-7730 »
>
> **Bouton secondaire :** « Voir mon temps restant »

**Ce qui se passe :**

- La page peut être fermée, la connexion continue.
- **15 minutes avant la fin**, si la page est ouverte, une bannière orange en haut :
  « Il te reste 15 minutes. » + bouton « Prolonger »
  (texte de la bannière en bleu nuit, jamais en blanc sur orange).
- À la fin du temps → **E8**.

---

### E8 — Forfait terminé

**Quand ?** Le temps est fini. La prochaine page que le client ouvre affiche cet écran.

**Ce qu'il voit :**

> **Titre :** « Ton forfait est terminé »
>
> **Texte :** « Merci d'avoir utilisé monwifizone. Prends un nouveau ticket pour continuer. »
>
> **Bouton principal :** « Acheter un ticket »
>
> **Bouton secondaire :** « J'ai un autre code »

**Ce qu'il fait :**

- « Acheter un ticket » → **E2** (son numéro de téléphone est déjà rempli à l'étape E3).
- « J'ai un autre code » → **E6**.

---

## 3. Les écrans de problème

Règle pour tous ces écrans : **dire ce qui s'est passé, rassurer, dire quoi faire.**
Jamais de code d'erreur technique, jamais de faute sur le client.

### P1 — Paiement échoué

**Quand ?** L'opérateur refuse le paiement (solde insuffisant, code secret faux, annulation…).

> **Icône ✕ rouge** `#C62828`
>
> **Titre :** « Le paiement n'a pas marché »
>
> **Texte :** « Ton argent n'a pas été pris. »
>
> **Texte (si on connaît la raison) :**
> - Solde trop bas : « Ton solde est peut-être insuffisant. Recharge ton compte et réessaie. »
> - Annulé : « Tu as annulé le paiement. Tu peux réessayer quand tu veux. »
> - Autre : « Vérifie ton compte Mobile Money et réessaie. »
>
> **Bouton principal :** « Réessayer »  → **E3** (tout est déjà rempli)
>
> **Bouton secondaire :** « Choisir un autre moyen de paiement » → **E3**

---

### P2 — Délai dépassé

**Quand ?** Le client n'a pas validé sur son téléphone dans les 2 minutes.

> **Titre :** « Tu n'as pas validé à temps »
>
> **Texte :** « Ton argent n'a pas été pris. Relance le paiement et valide sur ton téléphone. »
>
> **Bouton principal :** « Relancer le paiement » → **E4**
>
> **Bouton secondaire :** « Retour » → **E3**

> ⚠️ Avant d'afficher cet écran, le système **revérifie une dernière fois** auprès de l'opérateur.
> Si le paiement est finalement passé, on affiche **E5** à la place. Le client ne doit jamais payer deux fois.

---

### P3 — Code faux (mauvais identifiant)

**Quand ?** Le code tapé n'existe pas.

On reste sur **E6**. Le champ devient rouge et on affiche dessous :

> « Ce code ne marche pas. Vérifie-le et réessaie. »

**Après 5 essais ratés** (pour bloquer ceux qui essaient des codes au hasard) :

> **Titre :** « Trop d'essais »
>
> **Texte :** « Attends 2 minutes avant de réessayer. Ton code est dans le SMS qu'on t'a envoyé. »
>
> **Bouton secondaire :** « J'ai payé mais je n'ai pas mon code » → **P5**

---

### P4 — Code déjà utilisé sur un autre téléphone

**Quand ?** Un ticket = un seul appareil à la fois. Le code est déjà actif ailleurs.

> **Titre :** « Ce code est déjà utilisé »
>
> **Texte :** « Il est actif sur un autre téléphone. Un code marche sur un seul appareil à la fois. »
>
> **Bouton principal :** « Acheter un ticket » → **E2**
>
> **Petit texte :** « C'est bien ton code ? Appelle le 07 00 00 00 00. »

---

### P5 — Le client a fermé la page avant de voir son ticket

**Le problème :** il a payé, mais il a fermé la page (ou perdu le réseau) pendant **E4**. Il n'a pas vu son code.

**Ce qu'on fait pour qu'il ne perde jamais son argent — 3 filets de sécurité :**

1. **Le SMS** : le code part par SMS dès que le paiement est validé, même si la page est fermée.
2. **La reconnexion automatique** : le système garde en mémoire le téléphone qui a payé
   (son adresse MAC). S'il revient sur le portail, on lui affiche directement :

   > **Titre :** « Bon retour ! »
   >
   > **Texte :** « Ton paiement de 300 F est bien passé. Voici ton code : »
   >
   > « **4821-7730** »
   >
   > **Bouton principal :** « Me connecter maintenant » → **E7**

3. **L'écran « Retrouver mon ticket »** (lien sur E1 et P3) :

   > **Titre :** « Retrouve ton ticket »
   >
   > **Texte :** « Entre le numéro avec lequel tu as payé. »
   >
   > **Champ :** « Ton numéro de téléphone »
   >
   > **Bouton principal :** « Retrouver mon ticket »

   **Ce qui se passe :**

   - Un ticket trouvé (payé dans les dernières 24 h) → on **renvoie le code par SMS** et on affiche :
     « C'est bon ! On a renvoyé ton code par SMS au 07 •• •• •• 12. »
     (on ne montre pas le code à l'écran : sinon n'importe qui pourrait taper le numéro d'un autre)
   - Aucun ticket trouvé :
     « On ne trouve pas de ticket pour ce numéro. Vérifie le numéro, ou appelle le 07 00 00 00 00. »

---

## 4. Récapitulatif des textes clés

| Écran | Titre affiché | Bouton principal |
|---|---|---|
| E1 Accueil | « Bienvenue sur monwifizone » | « Acheter un ticket » |
| E2 Forfait | « Choisis ton forfait » | « Continuer » |
| E3 Paiement | « Paye ton ticket » | « Payer 300 F » |
| E4 Attente | « Confirme sur ton téléphone » | — |
| E5 Ticket | « Paiement reçu » | « Me connecter maintenant » |
| E6 Code | « Entre ton code » | « Me connecter » |
| E7 Connecté | « Tu es connecté » | — |
| E8 Fin | « Ton forfait est terminé » | « Acheter un ticket » |
| P1 Échec | « Le paiement n'a pas marché » | « Réessayer » |
| P2 Délai | « Tu n'as pas validé à temps » | « Relancer le paiement » |
| P3 Code faux | « Ce code ne marche pas… » | « Me connecter » |
| P4 Déjà utilisé | « Ce code est déjà utilisé » | « Acheter un ticket » |
| P5 Retrouver | « Retrouve ton ticket » | « Retrouver mon ticket » |

---

## 5. Vérification avec la charte

- ✅ Tutoiement partout.
- ✅ Phrases courtes, une idée par phrase.
- ✅ Aucun mot technique ni code d'erreur montré au client.
- ✅ Chaque problème dit **quoi faire ensuite**.
- ✅ Après un échec de paiement, on dit toujours **« Ton argent n'a pas été pris »** (c'est la première peur du client).
- ✅ Boutons orange avec texte bleu nuit (contraste 5,90), jamais de texte blanc sur orange.
- ✅ Succès = vert + ✓, erreur = rouge + ✕ (jamais la couleur seule).
- ✅ Police du téléphone sur tout le portail (pas d'Internet).
