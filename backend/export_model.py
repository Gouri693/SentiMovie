import os
import json
import joblib

def export_model():
    model_path = "c:/Users/gouri/OneDrive/Documents/something/backend/model/sentiment_model.joblib"
    output_path = "c:/Users/gouri/OneDrive/Documents/something/frontend/public/model_data.json"
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return
        
    print("Loading pipeline...")
    pipeline = joblib.load(model_path)
    
    tfidf = pipeline.named_steps['tfidf']
    clf = pipeline.named_steps['clf']
    
    # Extract parameters and convert numpy types to standard python types
    vocabulary = {str(k): int(v) for k, v in tfidf.vocabulary_.items()}
    idf = tfidf.idf_.tolist()
    coef = clf.coef_[0].tolist()
    intercept = float(clf.intercept_[0])
    
    model_data = {
        "vocabulary": vocabulary,
        "idf": idf,
        "coef": coef,
        "intercept": intercept
    }
    
    print("Writing model parameters to JSON...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(model_data, f, ensure_ascii=False)
        
    print(f"Model exported successfully to {output_path}")
    print(f"Vocabulary size: {len(vocabulary)}")
    print(f"JSON File size: {os.path.getsize(output_path) / 1024:.2f} KB")

if __name__ == '__main__':
    export_model()
