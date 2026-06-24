from fastapi import APIRouter, Query
import urllib.request
import json
import os

router = APIRouter(prefix="/api/logs", tags=["logs"])

ES_URL = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")


def es_search(body: dict, size: int = 50):
    url = f"{ES_URL}/siem-*/_search"
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


@router.get("/")
async def get_logs(size: int = Query(default=50, le=200), q: str = Query(default=None)):
    query = {"match_all": {}} if not q else {"match": {"message": q}}

    result = es_search(
        {
            "query": query,
            "sort": [{"@timestamp": {"order": "desc"}}],
            "size": size,
            "_source": ["@timestamp", "message", "log", "environment"],
        }
    )

    hits = result["hits"]["hits"]
    return [
        {
            "id": h["_id"],
            "timestamp": h["_source"].get("@timestamp"),
            "message": h["_source"].get("message", ""),
            "source": h["_source"].get("log", {}).get("file", {}).get("path", ""),
        }
        for h in hits
    ]
