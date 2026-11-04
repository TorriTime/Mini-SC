# Suivi DLC

Outil de suivi des dates limites (DLC/DDM) et des démarques. Un seul fichier : ouvrir `index.html` dans un navigateur (PC ou téléphone).

- **Produits** : nom, rayon, sens (début/milieu/fin), niveau (haut/milieu/bas), précision libre, date limite, quantité, prix.
- **Règles de démarque** (⚙️ Réglages) : « à partir de X jours avant la date → -Y % ». Par défaut J-30 surveillance, J-15 → -30 %, J-7 → -50 %, J-2 → retrait. 100 % = retirer, 0 % = surveiller.
- **Parcours du rayon** : tri par rayon, puis début → fin, puis haut → bas (ordre des rayons réglable).
- Bouton « ✔ -30 % appliqué » pour pointer ce qui est fait ; « Retiré » supprime le produit (annulable).
- Export CSV (Excel), sauvegarde / restauration JSON, impression.

Les données sont stockées dans le navigateur de l'appareil (localStorage) : pensez à la sauvegarde JSON.
