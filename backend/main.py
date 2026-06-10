import re
import time
import os
from contextlib import asynccontextmanager
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List

# Setup path to model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "sentiment_model.joblib")

# Global model variable
model_pipeline = None

# Life cycle event handler (Modern FastAPI Lifecycle standard)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model_pipeline
    print("Preloading model weights during startup phase...")
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Serialized model file not found at {MODEL_PATH}. Run training first.")
    try:
        model_pipeline = joblib.load(MODEL_PATH)
        print("Model preloaded successfully into system RAM.")
    except Exception as e:
        print(f"Error preloading model: {str(e)}")
        raise e
    yield
    print("Shutting down application...")

# Initialize FastAPI App
app = FastAPI(
    title="Movie Review Sentiment Analysis API",
    description="Stateless REST API for analyzing sentiment of movie reviews",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Preprocessing helpers
CONTRACTION_MAP = {
    "don't": "do not",
    "can't": "cannot",
    "won't": "will not",
    "i'm": "i am",
    "it's": "it is",
    "he's": "he is",
    "she's": "she is",
    "you're": "you are",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "doesn't": "does not",
    "didn't": "did not",
    "couldn't": "could not",
    "shouldn't": "should not",
    "wouldn't": "would not",
    "mustn't": "must not"
}

def clean_text(text: str) -> str:
    if not text:
        return ""
    # 1. HTML Tag Strip
    text = re.sub(r'<[^>]*>', ' ', text)
    # 2. Lowercasing
    text = text.lower()
    # 3. Contraction Mapping
    for contraction, expansion in CONTRACTION_MAP.items():
        text = text.replace(contraction, expansion)
    # 4. Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Pydantic schemas
class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="The raw movie review text to analyze", max_length=50000)

class BatchAnalyzeRequest(BaseModel):
    texts: List[str] = Field(..., description="List of raw movie reviews to analyze")

@app.post("/api/v1/analyze")
async def analyze_sentiment(payload: AnalyzeRequest):
    if model_pipeline is None:
        raise HTTPException(status_code=503, detail="Sentiment analysis model is not loaded.")
    
    start_time = time.perf_counter()
    
    # Preprocess
    cleaned = clean_text(payload.text)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Provided text is empty or invalid after cleaning.")
    
    try:
        # Run inference
        # predict_proba returns [ [prob_neg, prob_pos] ]
        probs = model_pipeline.predict_proba([cleaned])[0]
        pos_prob = float(probs[1])
        
        # Calculate label and confidence
        label = "positive" if pos_prob >= 0.5 else "negative"
        probability = pos_prob if pos_prob >= 0.5 else 1.0 - pos_prob
        
        execution_time_ms = (time.perf_counter() - start_time) * 1000
        
        # Create processed snippet
        words = cleaned.split()
        processed_snippet = " ".join(words[:15]) # first 15 words
        if len(words) > 15:
            processed_snippet += "..."
            
        return {
            "status": "success",
            "data": {
                "label": label,
                "probability": round(probability, 4),
                "processed_text_snippet": processed_snippet,
                "sentiment": label,
                "confidence_score": round(probability, 4),
                "execution_time_ms": round(execution_time_ms, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/api/v1/analyze/batch")
async def analyze_sentiment_batch(payload: BatchAnalyzeRequest):
    if model_pipeline is None:
        raise HTTPException(status_code=503, detail="Sentiment analysis model is not loaded.")
    
    if not payload.texts:
        raise HTTPException(status_code=400, detail="Empty list of texts.")
        
    start_time = time.perf_counter()
    
    # Preprocess all reviews
    cleaned_texts = [clean_text(t) for t in payload.texts]
    
    # Validate that at least some texts are valid
    valid_indices = [i for i, t in enumerate(cleaned_texts) if t]
    if not valid_indices:
        raise HTTPException(status_code=400, detail="All provided reviews are empty or invalid after cleaning.")
    
    try:
        results = []
        # Run prediction for all texts
        for text in cleaned_texts:
            if not text:
                results.append({
                    "label": "unknown",
                    "probability": 0.0,
                    "processed_text_snippet": ""
                })
                continue
                
            probs = model_pipeline.predict_proba([text])[0]
            pos_prob = float(probs[1])
            label = "positive" if pos_prob >= 0.5 else "negative"
            probability = pos_prob if pos_prob >= 0.5 else 1.0 - pos_prob
            
            words = text.split()
            processed_snippet = " ".join(words[:10])
            if len(words) > 10:
                processed_snippet += "..."
                
            results.append({
                "label": label,
                "probability": round(probability, 4),
                "processed_text_snippet": processed_snippet
            })
            
        return {
            "status": "success",
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch inference error: {str(e)}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model_pipeline is not None
    }

# Serve compiled React frontend static files
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist"))

if os.path.exists(FRONTEND_DIST):
    print(f"Mounting frontend static files from: {FRONTEND_DIST}")
    # Mount the assets folder
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    # Serve index.html at root
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    # Fallback route for all other paths to support client-side routing
    @app.get("/{fallback_path:path}")
    async def serve_fallback(fallback_path: str):
        # Prevent catching API endpoints
        if fallback_path.startswith("api/") or fallback_path == "health":
            raise HTTPException(status_code=404, detail="API endpoint not found")
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    print(f"Warning: Compiled frontend directory not found at {FRONTEND_DIST}. Serve frontend separately.")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

