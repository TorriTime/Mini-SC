@echo off
REM Lance le serveur Stars Cards Mini.
REM Double-clique sur ce fichier (ou relance-le) a chaque fois que tu modifies
REM un fichier dans data/, game/ ou server/ -- Node ne relit ces fichiers
REM qu'au demarrage du processus.

cd /d "%~dp0"

echo Demarrage de Stars Cards Mini...
echo (Ferme cette fenetre ou appuie sur Ctrl+C pour arreter le serveur)
echo.

call npm start

echo.
echo Le serveur s'est arrete.
pause
