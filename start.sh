#!/usr/bin/env bash
# ============================================================
#  NTIC Bible Projector — Lanceur serveur Python (Linux / macOS)
#  Usage : chmod +x start.sh && ./start.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8080

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   NTIC Bible Projector — Démarrage serveur      ║"
echo "║   Port : ${PORT}   (HTTP + WebSocket + SSE)        ║"
echo "║   Moteur : Python (stdlib, 0 dépendance)        ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Détecter Python ───────────────────────────────────────
PYTHON_CMD=""
for cmd in python3 python python3.12 python3.11 python3.10 python3.9 python3.8; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON_CMD="$cmd"
    break
  fi
done

if [ -z "$PYTHON_CMD" ]; then
  echo "[ERREUR] Python 3.8+ introuvable."
  echo ""
  echo "  Installation :"
  echo "  • Linux  : sudo apt install python3  (ou dnf/pacman)"
  echo "  • macOS  : brew install python3"
  echo "  • Tout   : https://python.org"
  echo ""
  exit 1
fi

PY_VER=$("$PYTHON_CMD" --version 2>&1)
echo "[OK] $PY_VER détecté."

# ── Vérifier la version ≥ 3.8 ─────────────────────────────
PY_MINOR=$("$PYTHON_CMD" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
PY_MAJOR=$("$PYTHON_CMD" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 8 ]; }; then
  echo "[ERREUR] Python 3.8+ requis (détecté : ${PY_MAJOR}.${PY_MINOR})"
  exit 1
fi

# ── Vérifier server.py ────────────────────────────────────
if [ ! -f "${SCRIPT_DIR}/server.py" ]; then
  echo "[ERREUR] Fichier server.py introuvable dans : ${SCRIPT_DIR}"
  exit 1
fi
echo "[OK] server.py trouvé."
echo ""

# ── Ouvrir le navigateur après 2 secondes ────────────────
(sleep 2 && \
  (xdg-open "http://localhost:${PORT}" 2>/dev/null || \
   open     "http://localhost:${PORT}" 2>/dev/null || \
   echo "[INFO] Ouvrez manuellement : http://localhost:${PORT}")) &

echo "[+] Lancement du serveur…"
echo "    Appuyez sur CTRL+C pour arrêter."
echo ""

# ── Lancer le serveur ─────────────────────────────────────
cd "${SCRIPT_DIR}"
"${PYTHON_CMD}" server.py
