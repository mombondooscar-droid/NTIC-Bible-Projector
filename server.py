# server.py (extrait)
import os
import json
import asyncio
import websockets
from aiohttp import web
import logging

# Récupérer la clé API depuis les variables d'environnement
API_KEY = os.environ.get('NTIC_API_KEY', 'dev-key')  # À définir dans .env

# Pour les requêtes HTTP (middleware)
async def check_api_key(request):
    api_key = request.headers.get('X-API-Key')
    if api_key != API_KEY:
        return web.json_response({'error': 'Invalid API Key'}, status=401)
    return None  # Continuer le traitement

# Pour WebSocket
async def websocket_handler(websocket, path):
    # Récupérer la clé depuis les paramètres d'URL
    api_key = websocket.query_params.get('apiKey')
    if api_key != API_KEY:
        logging.warning("Connexion WebSocket refusée : clé API invalide")
        await websocket.close(code=1008, reason='Invalid API Key')
        return

    logging.info("Connexion WebSocket acceptée")
    try:
        async for message in websocket:
            # Traiter le message (broadcast)
            await broadcast_message(message)
    except websockets.exceptions.ConnectionClosed:
        logging.info("Connexion fermée")

# Appliquer le middleware pour les endpoints HTTP
async def api_middleware(app, handler):
    async def middleware(request):
        # Vérifier la clé API pour les endpoints /api/*
        if request.path.startswith('/api/'):
            check = await check_api_key(request)
            if check is not None:
                return check
        return await handler(request)
    return middleware