import os
import faiss
import torch
import pickle
import numpy as np
from PIL import Image
import open_clip

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model, _, preprocess = open_clip.create_model_and_transforms(
    'ViT-B-32',
    pretrained='laion2b_s34b_b79k'
)

tokenizer = open_clip.get_tokenizer('ViT-B-32')

model = model.to(DEVICE)

IMAGE_FOLDER = "images"
INDEX_FILE = "embeddings/index.faiss"
PATHS_FILE = "embeddings/paths.pkl"

def get_embedding(image_path):

    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        features = model.encode_image(image)

    features /= features.norm(dim=-1, keepdim=True)

    return features.cpu().numpy().astype("float32")

def build_index():

    image_paths = []

    embeddings = []

    for file in os.listdir(IMAGE_FOLDER):

        if file.lower().endswith((".jpg",".jpeg",".png",".webp")):

            path = os.path.join(IMAGE_FOLDER, file)

            try:
                emb = get_embedding(path)

                embeddings.append(emb)

                image_paths.append(path)

                print("Indicizzata:", file)

            except Exception as e:
                print("Errore:", file, e)

    if not embeddings:
        print("Nessuna immagine trovata")
        return

    vectors = np.vstack(embeddings)

    index = faiss.IndexFlatIP(vectors.shape[1])

    index.add(vectors)

    faiss.write_index(index, INDEX_FILE)

    with open(PATHS_FILE, "wb") as f:
        pickle.dump(image_paths, f)

    print("\nINDEX CREATO")
    print("Immagini:", len(image_paths))

def search_similar(query_path, top_k=5):

    index = faiss.read_index(INDEX_FILE)

    with open(PATHS_FILE, "rb") as f:
        image_paths = pickle.load(f)

    query_emb = get_embedding(query_path)

    distances, indices = index.search(query_emb, top_k)

    results = []

    for score, idx in zip(distances[0], indices[0]):

        results.append({
            "path": image_paths[idx],
            "score": float(score)
        })

    return results

if __name__ == "__main__":
    build_index()

