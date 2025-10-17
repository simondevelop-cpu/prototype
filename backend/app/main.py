from fastapi import FastAPI

app = FastAPI(title="Canadian Insights API (prototype)")

@app.get("/health")
async def health():
    return {"status": "ok"}
