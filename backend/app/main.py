from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import alertas, auth, metrics, simulator
from websocket import websocket_endpoint, broadcast_alerta

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
@app.websocket("/ws/alertas")
async def ws_alertas(websocket: websocket_endpoint):
    pass

@app.get("/")
async def root():
    return {"status": "SIEM API running", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Endpoint para broadcast de alertas (usado internamente)
@app.post("/internal/broadcast-alerta")
async def internal_broadcast(alerta: dict):
    await broadcast_alerta(alerta)
    return {"status": "broadcasted"}