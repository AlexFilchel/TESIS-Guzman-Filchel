from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from app.routers import alertas, auth, metrics, simulator
from app.websocket import broadcast_alerta

app = FastAPI(title="SIEM API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(alertas.router)
app.include_router(metrics.router)
app.include_router(simulator.router)

# WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_alerta(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/alertas")
async def ws_alertas(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"status": "SIEM API running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Endpoint para broadcast de alertas (usado internamente)
@app.post("/internal/broadcast-alerta")
async def internal_broadcast(alerta: dict):
    await manager.send_alerta(alerta)
    return {"status": "broadcasted"}