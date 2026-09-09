@echo off
chcp 65001 >nul
title NTIC Bible Projector — Serveur Python

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║   NTIC Bible Projector — Démarrage serveur      ║
echo ║   Port : 8080   (HTTP + WebSocket + SSE)        ║
echo ║   Moteur : Python (stdlib, 0 dépendance)        ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: ── Détecter Python ──────────────────────────────────────
set PYTHON_CMD=
where python3 >nul 2>&1 && set PYTHON_CMD=python3
if "%PYTHON_CMD%"=="" (
  where python >nul 2>&1 && set PYTHON_CMD=python
)
if "%PYTHON_CMD%"=="" (
  where py >nul 2>&1 && set PYTHON_CMD=py
)

if "%PYTHON_CMD%"=="" (
  echo [ERREUR] Python n'est pas installe ou introuvable.
  echo.
  echo   Telechargez Python 3.8+ sur : https://python.org
  echo   Cochez "Add Python to PATH" lors de l'installation.
  echo.
  pause
  exit /b 1
)

:: Vérifier la version (>= 3.8)
for /f "tokens=*" %%v in ('%PYTHON_CMD% --version 2^>^&1') do set PY_VER=%%v
echo [OK] %PY_VER% detecte.

:: ── Vérifier server.py ───────────────────────────────────
if not exist "%~dp0server.py" (
  echo [ERREUR] Fichier server.py introuvable dans : %~dp0
  pause
  exit /b 1
)
echo [OK] server.py trouve.
echo.

:: ── Ouvrir le navigateur après 2 secondes ───────────────
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"

echo [+] Lancement du serveur...
echo     Appuyez sur CTRL+C pour arreter.
echo.

:: ── Lancer le serveur ────────────────────────────────────
%PYTHON_CMD% "%~dp0server.py"

echo.
echo [Serveur arrete]
pause
