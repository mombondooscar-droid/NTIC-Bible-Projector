#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
============================================================
 server_gui.py — Interface Tkinter de contrôle du serveur
 NTIC Bible Projector · US-R08-03 + US-R11-02
 Version: 1.1

 Lance server.py en sous-processus, capture les logs,
 affiche le statut et permet de démarrer/arrêter/redémarrer.
 + US-R11-02 : Affichage des logs système dans un onglet dédié.
============================================================
"""

import os
import sys
import subprocess
import threading
import time
import signal
import json
import tkinter as tk
from tkinter import scrolledtext, ttk
from pathlib import Path

# ─── Configuration ─────────────────────────────────────────────
SERVER_SCRIPT = Path(__file__).parent / "server.py"


class ServerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("NTIC Bible Projector — Contrôle serveur")
        self.root.geometry("800x620")
        self.root.minsize(600, 450)

        # État du processus
        self.process = None
        self.process_lock = threading.Lock()
        self.log_thread = None
        self.running = False
        self.reader_stop = threading.Event()

        # Variable pour le statut
        self.status_var = tk.StringVar(value="⏹ Arrêté")
        self.clients_var = tk.StringVar(value="Clients : 0 WS · 0 SSE")
        self.version_var = tk.StringVar(value="Version : --")

        # ── Création des widgets ────────────────────────────────
        self._build_widgets()

        # ── Gestion de la fermeture ──────────────────────────────
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        # ── Vérifier si server.py existe ─────────────────────────
        if not SERVER_SCRIPT.exists():
            self.log_error(f"❌ server.py introuvable dans : {SERVER_SCRIPT.parent}")
            self.log_error("   Placez server_gui.py dans le même dossier que server.py.")
            self.start_btn.config(state=tk.DISABLED)
        else:
            self.log_info(f"✅ server.py trouvé : {SERVER_SCRIPT}")

        # ── Démarrer le rafraîchissement des logs ─────────────────
        self._start_log_refresher()

    def _build_widgets(self):
        """Construit tous les widgets de l'interface."""
        # ── Barre d'outils ──────────────────────────────────────
        toolbar = tk.Frame(self.root, pady=5)
        toolbar.pack(fill=tk.X, padx=8)

        self.start_btn = tk.Button(toolbar, text="▶ Démarrer", command=self.start_server,
                                   bg="#2e7d32", fg="white", padx=12, pady=4)
        self.start_btn.pack(side=tk.LEFT, padx=4)

        self.stop_btn = tk.Button(toolbar, text="⏹ Arrêter", command=self.stop_server,
                                  bg="#c62828", fg="white", padx=12, pady=4, state=tk.DISABLED)
        self.stop_btn.pack(side=tk.LEFT, padx=4)

        self.restart_btn = tk.Button(toolbar, text="⟳ Redémarrer", command=self.restart_server,
                                     padx=10, pady=4, state=tk.DISABLED)
        self.restart_btn.pack(side=tk.LEFT, padx=4)

        # ── Zone de statut ──────────────────────────────────────
        status_frame = tk.Frame(self.root)
        status_frame.pack(fill=tk.X, padx=8, pady=2)

        tk.Label(status_frame, text="Statut :", font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=2)
        tk.Label(status_frame, textvariable=self.status_var, font=("Arial", 10)).pack(side=tk.LEFT, padx=4)
        tk.Label(status_frame, textvariable=self.version_var, font=("Arial", 9)).pack(side=tk.LEFT, padx=10)
        tk.Label(status_frame, textvariable=self.clients_var, font=("Arial", 9)).pack(side=tk.RIGHT, padx=4)

        # ── Notebook pour les onglets ──────────────────────────
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)

        # Onglet Logs serveur
        self.log_frame = tk.Frame(self.notebook)
        self.notebook.add(self.log_frame, text="Logs serveur")
        self._build_log_tab()

        # ─── US-R11-02 : Onglet Logs système ────────────────────
        self.syslog_frame = tk.Frame(self.notebook)
        self.notebook.add(self.syslog_frame, text="Logs système")
        self._build_syslog_tab()

        # ── Barre d'état en bas ─────────────────────────────────
        self.status_bar = tk.Label(self.root, text="Prêt", relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(fill=tk.X, padx=8, pady=4)

    def _build_log_tab(self):
        """Construit l'onglet des logs serveur."""
        tk.Label(self.log_frame, text="Logs serveur :", anchor=tk.W, font=("Arial", 9, "bold")).pack(fill=tk.X)

        self.log_area = scrolledtext.ScrolledText(
            self.log_frame, wrap=tk.WORD, font=("Consolas", 9),
            bg="#1e1e1e", fg="#d4d4d4", insertbackground="white",
            height=20
        )
        self.log_area.pack(fill=tk.BOTH, expand=True, pady=2)

        btn_frame = tk.Frame(self.log_frame)
        btn_frame.pack(fill=tk.X, pady=4)
        tk.Button(btn_frame, text="Effacer les logs", command=self.clear_logs).pack(side=tk.RIGHT, padx=4)

    def _build_syslog_tab(self):
        """Construit l'onglet des logs système (US-R11-02)."""
        tk.Label(self.syslog_frame, text="Logs système (remontés par les clients) :", anchor=tk.W,
                 font=("Arial", 9, "bold")).pack(fill=tk.X)

        self.syslog_area = scrolledtext.ScrolledText(
            self.syslog_frame, wrap=tk.WORD, font=("Consolas", 9),
            bg="#1e1e1e", fg="#d4d4d4", insertbackground="white",
            height=20
        )
        self.syslog_area.pack(fill=tk.BOTH, expand=True, pady=2)

        btn_frame = tk.Frame(self.syslog_frame)
        btn_frame.pack(fill=tk.X, pady=4)

        tk.Button(btn_frame, text="Rafraîchir", command=self.refresh_syslogs).pack(side=tk.LEFT, padx=4)
        tk.Button(btn_frame, text="Exporter les logs", command=self.export_syslogs).pack(side=tk.LEFT, padx=4)
        tk.Button(btn_frame, text="Effacer", command=self.clear_syslogs).pack(side=tk.RIGHT, padx=4)

    def _start_log_refresher(self):
        """Lance un thread pour rafraîchir les logs système périodiquement."""
        def refresh_loop():
            while True:
                time.sleep(10)
                if self.running and self.process and self.process.poll() is None:
                    self.root.after(0, self.refresh_syslogs)
        t = threading.Thread(target=refresh_loop, daemon=True)
        t.start()

    # ─── Méthodes de log ──────────────────────────────────────

    def _log(self, message, tag=None, area=None):
        """Ajoute un message dans une zone de logs."""
        if area is None:
            area = self.log_area
        area.config(state=tk.NORMAL)
        area.insert(tk.END, message + "\n")
        area.see(tk.END)
        area.config(state=tk.DISABLED)

    def log_info(self, msg):
        self._log(f"[INFO] {msg}")

    def log_warning(self, msg):
        self._log(f"[WARNING] {msg}")

    def log_error(self, msg):
        self._log(f"[ERROR] {msg}")

    def log_success(self, msg):
        self._log(f"[SUCCESS] {msg}")

    def clear_logs(self):
        self.log_area.config(state=tk.NORMAL)
        self.log_area.delete(1.0, tk.END)
        self.log_area.config(state=tk.DISABLED)

    def clear_syslogs(self):
        self.syslog_area.config(state=tk.NORMAL)
        self.syslog_area.delete(1.0, tk.END)
        self.syslog_area.config(state=tk.DISABLED)

    def refresh_syslogs(self):
        """Récupère et affiche les logs système depuis l'API /api/logs."""
        try:
            import requests
            resp = requests.get("http://localhost:8080/api/logs", timeout=3)
            if resp.status_code == 200:
                logs = resp.json()
                self.syslog_area.config(state=tk.NORMAL)
                self.syslog_area.delete(1.0, tk.END)
                for log in logs[-100:]:  # Derniers 100 logs
                    ts = time.strftime("%H:%M:%S", time.localtime(log.get('ts', 0)/1000))
                    level = log.get('level', 'info').upper()
                    msg = log.get('message', '')
                    self.syslog_area.insert(tk.END, f"[{ts}] [{level}] {msg}\n")
                self.syslog_area.see(tk.END)
                self.syslog_area.config(state=tk.DISABLED)
        except Exception as e:
            self.syslog_area.config(state=tk.NORMAL)
            self.syslog_area.delete(1.0, tk.END)
            self.syslog_area.insert(tk.END, f"⚠️ Impossible de récupérer les logs : {e}\n")
            self.syslog_area.config(state=tk.DISABLED)

    def export_syslogs(self):
        """Exporte les logs système vers un fichier JSON."""
        try:
            import requests
            from tkinter import filedialog
            resp = requests.get("http://localhost:8080/api/logs", timeout=3)
            if resp.status_code == 200:
                logs = resp.json()
                filename = filedialog.asksaveasfilename(
                    defaultextension=".json",
                    filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
                )
                if filename:
                    with open(filename, "w", encoding="utf-8") as f:
                        json.dump(logs, f, indent=2, ensure_ascii=False)
                    self.log_info(f"📄 Logs exportés vers {filename}")
        except Exception as e:
            self.log_error(f"Erreur export logs : {e}")

    # ─── Gestion du processus serveur ──────────────────────────

    def start_server(self):
        with self.process_lock:
            if self.process is not None and self.process.poll() is None:
                self.log_warning("Le serveur tourne déjà.")
                return

            if not SERVER_SCRIPT.exists():
                self.log_error("server.py introuvable.")
                return

            self.log_info("Démarrage du serveur...")
            self.status_var.set("🔄 Démarrage...")

            try:
                self.process = subprocess.Popen(
                    [sys.executable, str(SERVER_SCRIPT)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                )
                self.running = True
                self.reader_stop.clear()

                self.log_thread = threading.Thread(target=self._read_output, daemon=True)
                self.log_thread.start()

                self.start_btn.config(state=tk.DISABLED)
                self.stop_btn.config(state=tk.NORMAL)
                self.restart_btn.config(state=tk.NORMAL)
                self.status_var.set("✅ En cours d'exécution")
                self.status_bar.config(text="Serveur actif")

                self._start_status_updater()
                self.log_success(f"Serveur démarré (PID: {self.process.pid})")

            except Exception as e:
                self.log_error(f"Erreur au démarrage : {e}")
                self.status_var.set("❌ Erreur")
                self.status_bar.config(text="Erreur de démarrage")
                self.start_btn.config(state=tk.NORMAL)
                self.stop_btn.config(state=tk.DISABLED)
                self.restart_btn.config(state=tk.DISABLED)

    def stop_server(self, force=False):
        with self.process_lock:
            if self.process is None:
                self.log_warning("Aucun serveur en cours.")
                return

            if self.process.poll() is not None:
                self.log_warning("Le serveur est déjà arrêté.")
                self._cleanup_process()
                return

            self.log_info("Arrêt du serveur...")
            self.status_var.set("⏹ Arrêt en cours...")

            try:
                if sys.platform == "win32":
                    self.process.send_signal(signal.SIGBREAK)
                else:
                    self.process.send_signal(signal.SIGINT)

                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.log_warning("Le serveur ne répond pas, force l'arrêt.")
                    self.process.kill()
                    self.process.wait()

            except Exception as e:
                self.log_error(f"Erreur lors de l'arrêt : {e}")
                try:
                    self.process.kill()
                except:
                    pass

            self._cleanup_process()
            self.log_success("Serveur arrêté.")
            self.status_var.set("⏹ Arrêté")
            self.status_bar.config(text="Serveur arrêté")

            self.start_btn.config(state=tk.NORMAL)
            self.stop_btn.config(state=tk.DISABLED)
            self.restart_btn.config(state=tk.DISABLED)
            self.reader_stop.set()

    def restart_server(self):
        self.log_info("Redémarrage du serveur...")
        self.stop_server()
        self.root.after(1000, self.start_server)

    def _cleanup_process(self):
        with self.process_lock:
            if self.process:
                try:
                    self.process.stdout.close()
                except:
                    pass
                self.process = None
            self.running = False
            self.reader_stop.set()
            self.status_var.set("⏹ Arrêté")

    def on_close(self):
        if self.process and self.process.poll() is None:
            self.log_info("Fermeture de l'interface, arrêt du serveur...")
            self.stop_server(force=True)
        self.root.destroy()

    # ─── Lecture des logs du serveur ────────────────────────────

    def _read_output(self):
        if not self.process:
            return
        try:
            while not self.reader_stop.is_set() and self.running:
                line = self.process.stdout.readline()
                if not line:
                    break
                self._process_log_line(line.strip())
        except (ValueError, OSError) as e:
            if self.running:
                self.log_error(f"Erreur de lecture des logs : {e}")
        finally:
            self.log_info("Fin de lecture des logs.")

    def _process_log_line(self, line):
        if not line:
            return
        if "[ERROR]" in line:
            self.log_error(line)
        elif "[WARNING]" in line or "WARNING" in line:
            self.log_warning(line)
        elif "[Bible]" in line:
            self.log_info(line)
        elif "[WS]" in line:
            self.log_info(line)
        elif "[SSE]" in line:
            self.log_info(line)
        elif "[HTTP]" in line:
            self.log_info(line)
        elif "[Persistence]" in line:
            self.log_info(line)
        elif "SUCCESS" in line or "✅" in line:
            self.log_success(line)
        else:
            self.log_info(line)

    # ─── Mise à jour du statut ──────────────────────────────────

    def _start_status_updater(self):
        def update_loop():
            while self.running and self.process and self.process.poll() is None:
                try:
                    import requests
                    resp = requests.get("http://localhost:8080/status", timeout=2)
                    if resp.status_code == 200:
                        data = resp.json()
                        version = data.get("version", "inconnue")
                        ws = data.get("wsClients", 0)
                        sse = data.get("sseClients", 0)
                        self.version_var.set(f"Version : {version}")
                        self.clients_var.set(f"Clients : {ws} WS · {sse} SSE")
                        self.status_var.set("✅ En cours d'exécution")
                    else:
                        self.clients_var.set("⚠️ Serveur en erreur")
                except Exception:
                    pass
                time.sleep(3)
        t = threading.Thread(target=update_loop, daemon=True)
        t.start()


def main():
    root = tk.Tk()
    app = ServerGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()