# Déployer BEYND sur un VPS avec Coolify (HTTPS)

Une seule image Docker ([`Dockerfile`](../Dockerfile)) : le serveur Hono sert l'API et la PWA sur la même origine, sur le port **8787**. La base SQLite est dans le volume **`/data`**. Coolify fournit le reverse proxy et le certificat HTTPS (Let's Encrypt).

## Avant de commencer

- Un nom de domaine (ou sous-domaine), par exemple `beynd.mondomaine.fr`.
- Coolify v4 installé sur le VPS, ports 80 et 443 ouverts.
- Le dépôt GitHub accessible depuis Coolify : public, ou privé via l'app GitHub de Coolify.

## Étapes

1. **DNS**. Chez ton registrar, crée un enregistrement `A` qui pointe `beynd.mondomaine.fr` vers l'IP du VPS (et un `AAAA` si le VPS a de l'IPv6). Attends que `ping beynd.mondomaine.fr` réponde avec cette IP.
   - Si le domaine est chez Cloudflare, laisse le nuage **gris** (« DNS only »). Le proxy Cloudflare coupe les requêtes au-delà de 100 s, et une analyse du coach Gemini peut durer plus longtemps.

2. **Nouvelle ressource**. Dans Coolify : *Projects* → ton projet → *+ New* → *Public Repository* (ou *Private Repository (with GitHub App)*).
   - Repository : l'URL du dépôt BEYND.
   - Branch : `feat/elo-mvp` (ou `main` une fois la branche fusionnée).
   - Build Pack : **Dockerfile**. Base Directory : `/`. Dockerfile location : `/Dockerfile`.

3. **Réseau** (onglet *General*).
   - *Ports Exposes* : `8787`.
   - *Domains* : `https://beynd.mondomaine.fr`. Le préfixe `https://` déclenche le certificat Let's Encrypt et la redirection HTTP → HTTPS.

4. **Variables d'environnement** (onglet *Environment Variables*). Laisse **décochée** la case « Build Variable » : ces secrets ne servent qu'à l'exécution et ne doivent pas finir dans l'image.

   | Variable | Valeur |
   |---|---|
   | `APP_PASSWORD` | Un mot de passe long. **Indispensable** : sans lui, l'app est ouverte à tous. |
   | `SESSION_SECRET` | Une chaîne aléatoire, par exemple la sortie de `openssl rand -hex 32`. |
   | `GEMINI_API_KEY` | Ta clé Gemini (sans clé, le coach tourne en mode simulé). |
   | `TZ` | Facultatif, `Europe/Paris` par défaut. La journée de jeu suit ce fuseau. |
   | `DAY_START_HOUR` | Facultatif, `4` par défaut. |

5. **Stockage persistant** (onglet *Persistent Storage* → *+ Add* → *Volume Mount*).
   - Name : `beynd-data`. Destination Path : **`/data`**.
   - Sans ce volume, la base est perdue à chaque redéploiement.

6. **Healthcheck** (onglet *Healthcheck*, facultatif : l'image en déclare déjà un). Path `/api/health`, port `8787`.

7. **Deploy**. Les logs doivent finir par :
   ```
   BEYND server on :8787  (LLM key: yes, password: on, client: ../client/dist)
   ```
   Si tu vois `password: off`, la variable `APP_PASSWORD` n'est pas prise en compte : corrige-la et redéploie.

8. **Sur le téléphone**. Ouvre `https://beynd.mondomaine.fr` et entre le mot de passe. La session dure 30 jours. Pour l'installer comme une appli :
   - iPhone (Safari) : *Partager* → *Sur l'écran d'accueil*.
   - Android (Chrome) : menu ⋮ → *Installer l'application*.

9. **Déploiement automatique**. Avec l'app GitHub de Coolify, chaque `git push` sur la branche relance le build. Sinon, active le webhook dans l'onglet *Webhooks*.

## Reprendre ta base locale (facultatif)

Par défaut, l'app en ligne démarre vide. Pour y copier ta progression locale :

1. Arrête le serveur local (`Ctrl+C`). L'arrêt intègre le fichier `-wal` dans `server/elo.db`.
2. Envoie le fichier : `scp server/elo.db root@IP_DU_VPS:/tmp/elo.db`.
3. Sur le VPS, trouve le conteneur avec `docker ps | grep beynd` (Coolify le nomme d'après l'uuid de la ressource), puis :
   ```bash
   docker stop <conteneur>
   docker cp /tmp/elo.db <conteneur>:/data/elo.db
   docker start <conteneur>
   ```
   L'entrypoint redonne le fichier à l'utilisateur `node` au démarrage.

## Sauvegardes

`node backup.js` fait une copie à chaud de la base dans `/data/backups/` et garde les 14 plus récentes. Dans Coolify : onglet *Scheduled Tasks* → *+ Add*.
- Command : `node backup.js`.
- Frequency : `0 3 * * *` (tous les jours à 3 h).

Pour récupérer une copie hors du VPS : `docker cp <conteneur>:/data/backups ./beynd-backups`.

## Tester l'image en local

```bash
docker build -t beynd .
docker run --rm -p 8787:8787 -v beynd-data:/data -e APP_PASSWORD=test beynd
# puis http://localhost:8787
```

## Sécurité, en bref

- Mot de passe unique, cookie de session `HttpOnly`, `Secure` en HTTPS, `SameSite=Lax`. Après 10 essais ratés, un client est bloqué 15 minutes.
- Le serveur tourne en utilisateur `node`, pas en root.
- La clé Gemini reste côté serveur.
- Changer `APP_PASSWORD` (sans `SESSION_SECRET`), ou changer `SESSION_SECRET`, déconnecte tous les appareils.
