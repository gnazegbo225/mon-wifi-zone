# Charte graphique monwifizone

Cette charte part du logo [logo-v2.svg](logo-v2.svg) (le ticket bleu avec les ondes WiFi orange).
Elle sert à garder la même apparence partout : site, portail captif, tickets, messages.

---

## 1. Les couleurs

| Rôle | Couleur | Code | À quoi elle sert |
|---|---|---|---|
| Principale | Bleu nuit | `#0F2A5C` | Le logo, les titres, l'en-tête, les boutons principaux. C'est la couleur de la marque. |
| Secondaire | Orange | `#FF8A00` | Ce qui doit attirer l'œil : le bouton « Acheter », un prix, une icône. **Jamais pour écrire un texte sur fond clair.** |
| Fond | Gris très clair | `#F7F8FA` | Le fond des pages. Les cartes et les blocs sont en blanc `#FFFFFF` par-dessus. |
| Texte | Gris très foncé | `#1A2233` | Tout le texte normal (paragraphes, champs, listes). |
| Succès | Vert | `#1E7B46` | Ce qui s'est bien passé : paiement accepté, ticket activé, connexion réussie. |
| Erreur | Rouge | `#C62828` | Ce qui a raté : code faux, paiement refusé, ticket expiré. |

Pour les messages de succès et d'erreur, tu peux mettre un fond pâle derrière le texte :

- fond pâle succès : `#E6F4EC`
- fond pâle erreur : `#FDECEC`

---

## 2. Le contraste : est-ce que le texte reste lisible ?

Le **contraste**, c'est la différence de clarté entre la couleur du texte et la couleur du fond.
On le mesure avec un chiffre (de 1 à 21). La règle internationale (WCAG) dit :

- **4,5 ou plus** : OK pour du texte normal.
- **3 ou plus** : OK seulement pour du gros texte (titres, boutons en gras assez grands).
- **moins de 3** : illisible pour beaucoup de gens, surtout au soleil sur un téléphone.

J'ai calculé chaque combinaison :

| Texte | Sur le fond | Contraste | Verdict |
|---|---|---|---|
| Texte `#1A2233` | Fond `#F7F8FA` | 14,97 | ✅ Très bon |
| Texte `#1A2233` | Blanc `#FFFFFF` | 15,90 | ✅ Très bon |
| Bleu `#0F2A5C` | Fond `#F7F8FA` | 13,12 | ✅ Très bon |
| Blanc `#FFFFFF` | Bleu `#0F2A5C` | 13,94 | ✅ Très bon (bouton principal) |
| Bleu `#0F2A5C` | Orange `#FF8A00` | 5,90 | ✅ Bon (bouton orange) |
| Orange `#FF8A00` | Bleu `#0F2A5C` | 5,90 | ✅ Bon |
| Vert `#1E7B46` | Fond `#F7F8FA` | 4,97 | ✅ Bon |
| Vert `#1E7B46` | Fond pâle `#E6F4EC` | 4,66 | ✅ Bon |
| Blanc `#FFFFFF` | Vert `#1E7B46` | 5,28 | ✅ Bon |
| Rouge `#C62828` | Fond `#F7F8FA` | 5,29 | ✅ Bon |
| Rouge `#C62828` | Fond pâle `#FDECEC` | 4,92 | ✅ Bon |
| Blanc `#FFFFFF` | Rouge `#C62828` | 5,62 | ✅ Bon |
| **Blanc `#FFFFFF`** | **Orange `#FF8A00`** | **2,36** | ❌ **Illisible** |
| **Orange `#FF8A00`** | **Fond `#F7F8FA`** | **2,22** | ❌ **Illisible** |

**À retenir :**

- Toutes les couleurs passent, **sauf l'orange avec du blanc ou du clair**.
- Sur un bouton orange, écris en **bleu nuit**, jamais en blanc.
- Sur un fond clair, utilise l'orange pour des **formes** (icône, trait, pastille), pas pour du texte.
- Ne compte pas que sur la couleur : ajoute toujours un mot ou une icône (✓ ou ✕). Certaines personnes ne voient pas bien le rouge et le vert.

---

## 3. La typographie (les polices)

### Pour la plateforme (site web, espace vendeur)

**Inter**, une police gratuite et très lisible sur téléphone.

- Télécharge-la et mets les fichiers **dans le projet** (au lieu de la charger depuis Google Fonts). Le site reste rapide et marche même si Google est lent.
- Prends seulement 2 graisses : **400** (normal) et **700** (gras).

```css
font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

Si Inter ne charge pas, le téléphone prend sa propre police à la place. Rien ne casse.

### Pour le portail captif (la page qui s'affiche quand on se connecte au WiFi)

À ce moment-là, le client **n'a pas encore Internet**. Il ne peut pas télécharger de police.
On utilise donc **la police déjà installée sur son téléphone** :

```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

- Android affichera Roboto, iPhone affichera San Francisco, Windows affichera Segoe UI.
- Résultat : zéro fichier à charger, la page s'ouvre tout de suite.

### Tailles conseillées (sur téléphone)

| Élément | Taille | Graisse |
|---|---|---|
| Grand titre | 24 px | 700 |
| Titre de bloc | 18 px | 700 |
| Texte normal | 16 px | 400 |
| Petit texte (aide, mentions) | 14 px | 400 |

Ne descends jamais sous **14 px**.

---

## 4. Le ton des messages

### Les règles

1. **On tutoie.** « Ton ticket », « tu es connecté ».
2. **Phrases courtes.** Une idée par phrase. 10 à 12 mots maximum si possible.
3. **Mots simples.** Pas de mots techniques (« authentification », « requête », « erreur 403 »).
4. **On dit quoi faire ensuite.** Surtout quand il y a un problème.
5. **On reste calme et poli.** Pas de majuscules partout, pas de « !!! ».
6. **On ne fait pas porter la faute au client.**

### Exemples

| Situation | ✅ Bon message | ❌ Mauvais message |
|---|---|---|
| Connexion réussie | Tu es connecté. Bonne navigation ! | Authentification réussie. Session établie. |
| Code faux | Ce code ne marche pas. Vérifie-le et réessaie. | ERREUR : code invalide !!! |
| Ticket expiré | Ton ticket est terminé. Achète un nouveau ticket pour continuer. | Votre session a expiré. Veuillez contacter l'administrateur. |
| Paiement accepté | Paiement reçu. Voici ton code : **4821-7730**. | Transaction n° 88213 validée avec succès par l'opérateur. |
| Paiement refusé | Le paiement n'a pas marché. Ton argent n'a pas été pris. Réessaie. | Échec de la transaction (code E-502). |
| Chargement | Un instant, on vérifie ton code… | Traitement de la requête en cours, veuillez patienter. |
| Temps restant | Il te reste 25 minutes. | Durée résiduelle de la session : 1 500 secondes. |

### Petit test avant de publier un message

- Est-ce que je tutoie ? 
- Est-ce qu'une personne pressée comprend en 3 secondes ?
- Est-ce qu'elle sait quoi faire ensuite ?

Si tu réponds « oui » trois fois, le message est bon.
