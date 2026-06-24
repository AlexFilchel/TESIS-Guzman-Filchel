from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, alertas, metrics, simulator, reglas
from app.websocket import manager

app = FastAPI(title="SIEM API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(alertas.router)
app.include_router(metrics.router)
app.include_router(simulator.router)
app.include_router(reglas.router)


@app.get("/")
async def root():
    return {"status": "SIEM API running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.websocket("/ws/alertas")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/internal/broadcast-alerta")
async def broadcast_alerta(data: dict):
    await manager.send_alerta(data)
    return {"ok": True}
