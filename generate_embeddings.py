import json
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

ROOT = Path.home() / "Desktop/stone_archive_v2"
ITEMS = ROOT / "src/items.json"
OUT = ROOT / "src/embeddings.json"

print("Carico modello CLIP...")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
model.eval()

items = json.loads(ITEMS.read_text())

results = []

def resolve_path(p):
    if not p or p.startswith("data:image") or p.startswith("http"):
        return None
    p = p.lstrip("/")
    return ROOT / "public" / p

for i, item in enumerate(items, 1):
    img_path = resolve_path(item.get("image") or (item.get("photos") or [""])[0])

    if not img_path or not img_path.exists():
        print("SKIP", item.get("name"), img_path)
        continue

    try:
        image = Image.open(img_path).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")

        with torch.no_grad():
            out = model.get_image_features(**inputs)

        emb = out.pooler_output[0].detach().cpu().numpy().astype("float32")

        emb = emb / np.linalg.norm(emb)

        results.append({
            "id": item.get("id"),
            "name": item.get("name"),
            "value": item.get("value"),
            "image": item.get("image"),
            "embedding": emb.tolist()
        })

        print(f"{i}/{len(items)} OK - {item.get('name')}")

    except Exception as e:
        print("ERROR", item.get("name"), e)

OUT.write_text(json.dumps(results))
print("FINITO")
print("Embeddings salvati:", OUT)
print("Totale:", len(results))
