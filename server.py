#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
============================================================
 NAGAD Bible Server v2.0
 Serveur WebSocket + HTTP pour synchronisation multi-PC
 ==============================================================

 Fonctionnalités :
 - WebSocket avec broadcast à tous les clients
 - Gestion d'état partagé (Bible, Chants, LT, Timer)
 - Heartbeats pour détecter les connexions mortes
 - API REST pour découverte et configuration
 - Système de verrouillage par ressource
 - Authentification par clé API

 Usage:
   python server.py [--port 8080] [--api-key votre_cle]

 Exemple:
   python server.py --port 8080 --api-key ma-cle-secrete
"""

import os
import json
import asyncio
import argparse
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import websockets
from aiohttp import web

# ============================================================
# CONFIGURATION
# ============================================================

parser = argparse.ArgumentParser(description='NAGAD Bible Server')
parser.add_argument('--port', type=int, default=8080, help='Port du serveur (default: 8080)')
parser.add_argument('--api-key', type=str, default='nagad-dev-key-2024', help='Clé API pour authentification')
parser.add_argument('--host', type=str, default='0.0.0.0', help='Host (default: 0.0.0.0)')
parser.add_argument('--verbose', action='store_true', help='Mode verbeux')
args = parser.parse_args()

# Configuration
PORT = args.port
API_KEY = args.api_key
HOST = args.host
HEARTBEAT_INTERVAL = 30  # secondes
CONNECTION_TIMEOUT = 60  # secondes
BUFFER_SIZE = 100  # Nombre max de messages en buffer par client

# Configuration du logging
logging.basicConfig(
    level=logging.INFO if not args.verbose else logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger('NAGAD_Server')

# ============================================================
# ÉTAT PARTAGÉ
# ============================================================

class SharedState:
    """Gère l'état partagé entre tous les clients"""
    
    def __init__(self):
        # État courant
        self.state = {
            'lastBibleRef': '',
            'lastBibleText': '',
            'currentSegments': [],
            'currentSegmentIndex': 0,
            'currentSong': None,
            'currentStropheIdx': 0,
            'currentPersonActive': None,
            'activeDisplayMode': 'normal',
            'bilingualSecondVersion': None,
            'explanatoryRef': '',
            'activeTimers': [],
            'lockedResources': {},  # resource -> sessionId
        }
        
        # Historique des messages (buffer de replay)
        self.message_history: List[Dict] = []
        self.max_history = 50
        
        # Version de l'état
        self.version = 1
    
    def update(self, updates: Dict, session_id: str = None):
        """Mettre à jour l'état"""
        changed = False
        
        for key, value in updates.items():
            if key in self.state and self.state[key] != value:
                self.state[key] = value
                changed = True
        
        if changed:
            self.version += 1
            logger.info(f"État mis à jour (v{self.version}) par {session_id or 'server'}")
        
        return changed
    
    def get_state(self) -> Dict:
        """Récupérer l'état complet"""
        return {
            **self.state,
            '_version': self.version
        }
    
    def get_updates(self, known_version: int) -> Dict:
        """Récupérer les mises à jour depuis une version connue"""
        if known_version >= self.version:
            return {}
        return {
            'updates': self.state,
            'version': self.version
        }
    
    def add_message_to_history(self, message: Dict):
        """Ajouter un message à l'historique"""
        self.message_history.append(message)
        if len(self.message_history) > self.max_history:
            self.message_history = self.message_history[-self.max_history:]
    
    def get_message_history(self) -> List[Dict]:
        """Récupérer l'historique des messages"""
        return self.message_history.copy()


# Initialisation de l'état partagé
shared_state = SharedState()

# ============================================================
# GESTION DES CLIENTS WEBSOCKET
# ============================================================

class WebSocketClient:
    """Représente un client WebSocket connecté"""
    
    def __init__(self, websocket: websockets.WebSocketServerProtocol, path: str, query_params: Dict):
        self.websocket = websocket
        self.path = path
        self.query_params = query_params
        self.session_id = query_params.get('sessionId', str(uuid.uuid4()))
        self.connected_at = datetime.now()
        self.last_heartbeat = datetime.now()
        self.last_message_at = datetime.now()
        self.buffer: List[Dict] = []
        self.is_alive = True
        
        # Récupérer le nom du client
        self.client_name = query_params.get('clientName', f'Client-{self.session_id[:8]}')
        
        logger.info(f"Nouveau client connecté: {self.client_name} (session: {self.session_id})")
    
    async def send(self, message: Any):
        """Envoyer un message au client"""
        try:
            if self.websocket.open:
                await self.websocket.send(json.dumps(message))
                self.last_message_at = datetime.now()
        except Exception as e:
            logger.warning(f"Erreur envoi à {self.client_name}: {e}")
            self.is_alive = False
    
    async def send_full_state(self):
        """Envoyer l'état complet au client"""
        await self.send({
            'type': 'sync:full-state',
            'state': shared_state.get_state(),
            'serverTime': datetime.now().isoformat(),
            'version': BC_MESSAGE_VERSION
        })
    
    async def send_state_update(self, updates: Dict):
        """Envoyer une mise à jour d'état"""
        await self.send({
            'type': 'sync:state-update',
            'updates': updates,
            'version': BC_MESSAGE_VERSION
        })
    
    async def send_lock_response(self, resource: str, granted: bool, held_by: Optional[str]):
        """Envoyer une réponse de verrouillage"""
        if granted:
            await self.send({
                'type': 'sync:lock-granted',
                'resource': resource,
                'sessionId': self.session_id,
                'version': BC_MESSAGE_VERSION
            })
        else:
            await self.send({
                'type': 'sync:lock-denied',
                'resource': resource,
                'heldBy': held_by,
                'version': BC_MESSAGE_VERSION
            })
    
    async def send_lock_update(self, resource: str, held_by: Optional[str]):
        """Envoyer une mise à jour de verrou"""
        await self.send({
            'type': 'sync:lock-updated',
            'resource': resource,
            'heldBy': held_by,
            'version': BC_MESSAGE_VERSION
        })
    
    async def send_replay_buffer(self):
        """Envoyer le buffer de replay"""
        history = shared_state.get_message_history()
        if history:
            await self.send({
                'type': 'sync:replay',
                'messages': history,
                'version': BC_MESSAGE_VERSION
            })
    
    def is_timeout(self) -> bool:
        """Vérifier si le client a dépassé le timeout"""
        return (datetime.now() - self.last_heartbeat) > timedelta(seconds=CONNECTION_TIMEOUT)
    
    async def close(self):
        """Fermer la connexion"""
        self.is_alive = False
        try:
            if self.websocket.open:
                await self.websocket.close(code=1000, reason='Normal closure')
        except:
            pass


# Dictionnaire des clients connectés
clients: Dict[str, WebSocketClient] = {}

# ============================================================
# GESTION DES VERROUS
# ============================================================

class LockManager:
    """Gère les verrous par ressource"""
    
    def __init__(self):
        self.locks: Dict[str, str] = {}  # resource -> sessionId
    
    def acquire(self, resource: str, session_id: str) -> bool:
        """Acquérir un verrou sur une ressource"""
        if resource not in self.locks:
            self.locks[resource] = session_id
            return True
        return self.locks[resource] == session_id
    
    def release(self, resource: str, session_id: str) -> bool:
        """Libérer un verrou"""
        if self.locks.get(resource) == session_id:
            del self.locks[resource]
            return True
        return False
    
    def get_holder(self, resource: str) -> Optional[str]:
        """Récupérer le détenteur d'un verrou"""
        return self.locks.get(resource)
    
    def is_locked(self, resource: str) -> bool:
        """Vérifier si une ressource est verrouillée"""
        return resource in self.locks
    
    def release_all(self, session_id: str):
        """Libérer tous les verrous d'un client"""
        to_remove = [r for r, s in self.locks.items() if s == session_id]
        for resource in to_remove:
            del self.locks[resource]


lock_manager = LockManager()

# ============================================================
# CONSTANTES
# ============================================================

BC_MESSAGE_VERSION = 1

# ============================================================
# FONCTIONS DE BROADCAST
# ============================================================

async def broadcast_message(message: Any, exclude_session: Optional[str] = None):
    """Diffuser un message à tous les clients sauf un"""
    message_data = json.dumps(message)
    
    # Ajouter au historique
    if isinstance(message, dict):
        shared_state.add_message_to_history(message)
    
    disconnected = []
    for session_id, client in clients.items():
        if not client.is_alive:
            disconnected.append(session_id)
            continue
            
        if exclude_session and session_id == exclude_session:
            continue
            
        try:
            if client.websocket.open:
                await client.websocket.send(message_data)
        except Exception as e:
            logger.warning(f"Erreur broadcast à {client.client_name}: {e}")
            disconnected.append(session_id)
    
    # Nettoyer les clients déconnectés
    for session_id in disconnected:
        await remove_client(session_id)


async def broadcast_state_update(updates: Dict, exclude_session: Optional[str] = None):
    """Diffuser une mise à jour d'état"""
    # Mettre à jour l'état partagé
    shared_state.update(updates)
    
    # Envoyer à tous les clients
    message = {
        'type': 'sync:state-update',
        'updates': updates,
        'version': BC_MESSAGE_VERSION
    }
    await broadcast_message(message, exclude_session)


async def broadcast_lock_update(resource: str, held_by: Optional[str]):
    """Diffuser une mise à jour de verrou"""
    # Mettre à jour l'état
    if held_by:
        shared_state.state['lockedResources'][resource] = held_by
    else:
        shared_state.state['lockedResources'].pop(resource, None)
    
    message = {
        'type': 'sync:lock-updated',
        'resource': resource,
        'heldBy': held_by,
        'version': BC_MESSAGE_VERSION
    }
    await broadcast_message(message)


# ============================================================
# GESTION DES CLIENTS
# ============================================================

async def add_client(client: WebSocketClient):
    """Ajouter un client"""
    clients[client.session_id] = client
    logger.info(f"Client ajouté: {client.client_name} ({client.session_id})")
    
    # Envoyer l'état complet
    await client.send_full_state()
    
    # Envoyer le buffer de replay
    await client.send_replay_buffer()
    
    # Notifier les autres clients
    await broadcast_message({
        'type': 'client:connected',
        'sessionId': client.session_id,
        'clientName': client.client_name,
        'version': BC_MESSAGE_VERSION
    }, exclude_session=client.session_id)


async def remove_client(session_id: str):
    """Retirer un client"""
    if session_id in clients:
        client = clients[session_id]
        
        # Libérer les verrous
        lock_manager.release_all(session_id)
        
        # Notifier les autres clients
        await broadcast_message({
            'type': 'client:disconnected',
            'sessionId': session_id,
            'version': BC_MESSAGE_VERSION
        }, exclude_session=session_id)
        
        # Fermer la connexion
        await client.close()
        del clients[session_id]
        
        logger.info(f"Client retiré: {client.client_name} ({session_id})")


async def heartbeat_check():
    """Vérifier les heartbeats des clients"""
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        
        now = datetime.now()
        to_remove = []
        
        for session_id, client in clients.items():
            if client.is_timeout():
                logger.warning(f"Timeout pour {client.client_name} ({session_id})")
                to_remove.append(session_id)
        
        for session_id in to_remove:
            await remove_client(session_id)


# ============================================================
# HANDLER WEBSOCKET
# ============================================================

async def websocket_handler(websocket: websockets.WebSocketServerProtocol, path: str):
    """Handler principal pour les connexions WebSocket"""
    
    # Vérifier la clé API
    api_key = websocket.query_params.get('apiKey', '')
    if api_key != API_KEY:
        logger.warning(f"Connexion refusée: clé API invalide (reçue: {api_key[:10]}...)")
        await websocket.close(code=1008, reason='Invalid API Key')
        return
    
    # Créer le client
    client = WebSocketClient(websocket, path, dict(websocket.query_params))
    
    try:
        # Ajouter le client
        await add_client(client)
        
        # Boucle principale
        async for raw_message in websocket:
            try:
                # Mettre à jour le dernier heartbeat
                client.last_heartbeat = datetime.now()
                
                # Parser le message
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    logger.warning(f"Message JSON invalide de {client.client_name}")
                    continue
                
                logger.debug(f"Message reçu de {client.client_name}: {message.get('type', 'unknown')}")
                
                # Traiter le message
                await handle_message(client, message)
                
            except websockets.exceptions.ConnectionClosed:
                logger.info(f"Connexion fermée par {client.client_name}")
                break
            except Exception as e:
                logger.error(f"Erreur traitement message de {client.client_name}: {e}")
                break
        
    except Exception as e:
        logger.error(f"Erreur dans websocket_handler: {e}")
    finally:
        # Retirer le client
        await remove_client(client.session_id)


async def handle_message(client: WebSocketClient, message: Dict):
    """Traiter un message reçu"""
    
    msg_type = message.get('type', '')
    
    # Heartbeat
    if msg_type == 'heartbeat':
        await client.send({'type': 'heartbeat', 'serverTime': datetime.now().isoformat()})
        return
    
    # Demande d'état
    if msg_type == 'sync:request-state':
        await client.send_full_state()
        return
    
    # Demande de verrou
    if msg_type == 'sync:request-lock':
        resource = message.get('resource', 'default')
        session_id = message.get('sessionId', client.session_id)
        
        # Vérifier si la ressource est déjà verrouillée
        if lock_manager.is_locked(resource):
            holder = lock_manager.get_holder(resource)
            if holder == session_id:
                # Le client a déjà le verrou
                await client.send_lock_response(resource, True, None)
            else:
                # Ressource verrouillée par un autre
                await client.send_lock_response(resource, False, holder)
        else:
            # Acquérir le verrou
            lock_manager.acquire(resource, session_id)
            await client.send_lock_response(resource, True, None)
            await broadcast_lock_update(resource, session_id)
        return
    
    # Libération de verrou
    if msg_type == 'sync:release-lock':
        resource = message.get('resource', 'default')
        session_id = message.get('sessionId', client.session_id)
        
        if lock_manager.release(resource, session_id):
            await broadcast_lock_update(resource, None)
        return
    
    # Messages de projection (à diffuser)
    if msg_type in ['show-verse', 'show-slide', 'verse:segment', 'show-song', 
                     'song-next-strophe', 'song-prev-strophe', 'show-person',
                     'show-lt', 'hide-lower-third', 'show-dual-bilingual',
                     'show-dual-explanatory', 'hide-dual', 'show-timer-state',
                     'timer-tick', 'timer-hide-chrono']:
        
        # Extraire les données de verrouillage
        resource = message.get('resource', 'default')
        session_id = message.get('_sessionId', client.session_id)
        
        # Vérifier le verrou
        if lock_manager.is_locked(resource):
            holder = lock_manager.get_holder(resource)
            if holder != session_id:
                # Ce client n'a pas le verrou, ignorer
                logger.warning(f"Message ignoré de {client.client_name}: verrou sur {resource} détenu par {holder}")
                return
        
        # Diffuser à tous les autres clients
        await broadcast_message(message, exclude_session=client.session_id)
        
        # Mettre à jour l'état partagé
        updates = extract_state_updates(message)
        if updates:
            await broadcast_state_update(updates, exclude_session=client.session_id)
        
        return
    
    # Autres messages
    logger.debug(f"Message non traité: {msg_type}")


def extract_state_updates(message: Dict) -> Dict:
    """Extraire les mises à jour d'état d'un message"""
    updates = {}
    msg_type = message.get('type', '')
    
    if msg_type == 'show-verse':
        data = message.get('data', {})
        updates['lastBibleRef'] = data.get('reference', '')
        updates['lastBibleText'] = data.get('text', '')
        updates['activeDisplayMode'] = 'normal'
    
    elif msg_type == 'verse:segment':
        updates['lastBibleRef'] = message.get('reference', '')
        updates['currentSegments'] = message.get('segments', [])
        updates['currentSegmentIndex'] = message.get('segmentIndex', 0)
    
    elif msg_type == 'show-song':
        updates['currentSong'] = message.get('data', {})
        updates['currentStropheIdx'] = 0
    
    elif msg_type == 'song-next-strophe':
        updates['currentStropheIdx'] = message.get('stropheIndex', 0)
    
    elif msg_type == 'song-prev-strophe':
        updates['currentStropheIdx'] = message.get('stropheIndex', 0)
    
    elif msg_type == 'show-person':
        updates['currentPersonActive'] = message.get('data', {})
    
    elif msg_type == 'show-lt':
        data = message.get('data', {})
        if message.get('subtype') == 'person':
            updates['currentPersonActive'] = data
    
    elif msg_type == 'show-dual-bilingual':
        updates['activeDisplayMode'] = 'bilingual'
        updates['bilingualSecondVersion'] = message.get('secondVersion')
    
    elif msg_type == 'show-dual-explanatory':
        updates['activeDisplayMode'] = 'explanatory'
        updates['explanatoryRef'] = message.get('explanatoryRef', '')
    
    elif msg_type == 'hide-dual':
        updates['activeDisplayMode'] = 'normal'
    
    elif msg_type == 'show-timer-state':
        updates['activeTimers'] = message.get('timers', [])
    
    return updates


# ============================================================
# ENDPOINTS HTTP
# ============================================================

async def handle_status(request):
    """Endpoint /status"""
    # Vérifier la clé API
    api_key = request.headers.get('X-API-Key', '')
    if api_key != API_KEY:
        return web.json_response({'error': 'Invalid API Key'}, status=401)
    
    # Récupérer les IPs du serveur
    import socket
    hostname = socket.gethostname()
    ips = []
    try:
        ips = socket.gethostbyname_ex(hostname)[2]
    except:
        pass
    
    # Ajouter localhost
    if '127.0.0.1' not in ips:
        ips.insert(0, '127.0.0.1')
    
    return web.json_response({
        'status': 'ok',
        'server': 'NAGAD Bible Server v2.0',
        'uptime': datetime.now().isoformat(),
        'clients': len(clients),
        'apiKeyValid': True,
        'hostname': hostname,
        'ips': ips,
        'port': PORT
    })


async def handle_relay(request):
    """Endpoint /relay pour les messages HTTP"""
    # Vérifier la clé API
    api_key = request.headers.get('X-API-Key', '')
    if api_key != API_KEY:
        return web.json_response({'error': 'Invalid API Key'}, status=401)
    
    # Récupérer le message
    try:
        data = await request.json()
    except:
        return web.json_response({'error': 'Invalid JSON'}, status=400)
    
    # Diffuser le message
    await broadcast_message(data)
    
    return web.json_response({'status': 'ok', 'message': 'Message relayé'})


async def handle_api_bible_versions(request):
    """Lister les versions de Bible disponibles"""
    api_key = request.headers.get('X-API-Key', '')
    if api_key != API_KEY:
        return web.json_response({'error': 'Invalid API Key'}, status=401)
    
    # Pour l'instant, retourner une liste vide
    # À étendre avec le chargement des Bibles depuis le filesystem
    return web.json_response({
        'versions': []
    })


async def handle_api_bible_load(request):
    """Charger une version de Bible"""
    api_key = request.headers.get('X-API-Key', '')
    if api_key != API_KEY:
        return web.json_response({'error': 'Invalid API Key'}, status=401)
    
    name = request.query.get('name', '')
    if not name:
        return web.json_response({'error': 'Name parameter required'}, status=400)
    
    # À implémenter: chargement depuis le filesystem
    return web.json_response({'error': 'Not implemented'}, status=501)


# ============================================================
# CONFIGURATION DE L'APPLICATION
# ============================================================

app = web.Application()

# Middleware pour la clé API
async def api_middleware(app, handler):
    async def middleware(request):
        if request.path.startswith('/api/'):
            api_key = request.headers.get('X-API-Key', '')
            if api_key != API_KEY:
                return web.json_response({'error': 'Invalid API Key'}, status=401)
        return await handler(request)
    return middleware

app.middlewares.append(api_middleware)

# Routes
app.router.add_get('/status', handle_status)
app.router.add_post('/relay', handle_relay)
app.router.add_get('/api/bible/versions', handle_api_bible_versions)
app.router.add_get('/api/bible/load', handle_api_bible_load)

# Serveur WebSocket
async def websocket_server():
    """Démarrer le serveur WebSocket"""
    async with websockets.serve(
        websocket_handler,
        host=HOST,
        port=PORT,
        ping_interval=HEARTBEAT_INTERVAL,
        ping_timeout=CONNECTION_TIMEOUT,
        max_size=2**20,  # 1MB
        max_queue=100
    ):
        logger.info(f"Serveur WebSocket démarré sur {HOST}:{PORT}")
        await asyncio.Future()  # Run forever


# ============================================================
# POINT D'ENTRÉE
# ============================================================

async def main():
    """Point d'entrée principal"""
    
    # Démarrer le serveur HTTP
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host=HOST, port=PORT)
    
    logger.info(f"Serveur HTTP démarré sur {HOST}:{PORT}")
    logger.info(f"Clé API: {API_KEY}")
    logger.info(f"URL de test: http://localhost:{PORT}/status")
    logger.info(f"WebSocket: ws://localhost:{PORT}/?apiKey={API_KEY}")
    
    # Démarrer le serveur HTTP
    await site.start()
    
    # Démarrer le serveur WebSocket dans un thread séparé
    # (Pour l'instant, on utilise seulement le serveur HTTP avec WebSocket via aiohttp)
    # On va utiliser la bibliothèque websockets séparément
    
    # Démarrer la tâche de heartbeat
    asyncio.create_task(heartbeat_check())
    
    # Démarrer le serveur WebSocket
    asyncio.create_task(websocket_server())
    
    # Attendre indéfiniment
    while True:
        await asyncio.sleep(3600)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Serveur arrêté par l'utilisateur")
    except Exception as e:
        logger.error(f"Erreur fatale: {e}")
