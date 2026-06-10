import re
import time
import os
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score

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

def clean_text(text):
    if not isinstance(text, str):
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

def train_model():
    dataset_path = "c:/Users/gouri/OneDrive/Documents/something/IMDB Dataset.csv"
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        return
    
    print("Loading dataset...")
    df = pd.read_csv(dataset_path)
    print(f"Dataset loaded. Shape: {df.shape}")
    
    print("Cleaning text...")
    start_time = time.time()
    df['cleaned_review'] = df['review'].apply(clean_text)
    print(f"Cleaning finished in {time.time() - start_time:.2f} seconds.")
    
    df['label'] = df['sentiment'].map({'positive': 1, 'negative': 0})
    
    X = df['cleaned_review']
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # TF-IDF Vectorizer + LogisticRegression
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
        ('clf', LogisticRegression(C=1.0, max_iter=1000, random_state=42))
    ])
    
    print("Training model...")
    start_time = time.time()
    pipeline.fit(X_train, y_train)
    print(f"Training completed in {time.time() - start_time:.2f} seconds.")
    
    y_pred = pipeline.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Validation Accuracy: {acc:.4%}")
    
    # Save the pipeline
    os.makedirs("c:/Users/gouri/OneDrive/Documents/something/backend/model", exist_ok=True)
    model_path = "c:/Users/gouri/OneDrive/Documents/something/backend/model/sentiment_model.joblib"
    joblib.dump(pipeline, model_path)
    print(f"Model saved successfully to {model_path}")

if __name__ == '__main__':
    train_model()
