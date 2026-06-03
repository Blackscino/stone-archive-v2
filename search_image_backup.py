import json
import sys
import numpy as np
import torch
from pathlib import Path
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

if len(sys.argv) != 2:
    print("Uso: python3 search_image.py FOTO.jpg")
    sys.exit(1)

ROOT = Path.home() / "Desktop/stone_archive_v2"
EMB = ROOT / "src/embeddings.json"

print("Carico embeddings...")
data = json.loads(EMB.read_text())

print("Carico CLIP...")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
model.eval()

img_path = Path(sys.argv[1])

image = Image.open(img_path).convert("RGB")

inputs = processor(images=image, return_tensors="pt")

with torch.no_grad():
    out = model.get_image_features(**inputs)

query = (
    out.pooler_output[0]
    .detach()
    .cpu()
    .numpy()
    .astype("float32")
)

query = query / np.linalg.norm(query)

results = []

for row in data:
    v = np.array(row["embedding"], dtype=np.float32)

    score = float(np.dot(query, v))

    results.append(
        (
            score,
            row["name"],
            row["value"],
            row["image"]
        )
    )

results.sort(reverse=True)

print("\nTOP 10 RISULTATI\n")

for i, (score, name, value, image) in enumerate(results[:10], start=1):
    print(
        f"{i}. {name} | {round(score*100,2)}% | {value}"
    )
