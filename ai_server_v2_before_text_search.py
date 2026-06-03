from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
from pathlib import Path
import numpy as np
import torch
import json

ROOT = Path.home() / "Desktop/stone_archive_v2"

ITEMS_FILE = ROOT / "src/items.json"
EMB_FILE = ROOT / "src/embeddings.json"

print("Loading items...")
items = json.loads(ITEMS_FILE.read_text())

print("Loading embeddings...")
embeddings = json.loads(EMB_FILE.read_text())

lookup = {}

for item in items:
    lookup[item["id"]] = item

print("Loading CLIP...")
model = CLIPModel.from_pretrained(
    "openai/clip-vit-base-patch32"
)

processor = CLIPProcessor.from_pretrained(
    "openai/clip-vit-base-patch32"
)

model.eval()

app = Flask(__name__)
CORS(app)

@app.route("/search-image", methods=["POST"])
def search_image():

    if "file" not in request.files:
        return jsonify({
            "error": "missing file"
        }), 400

    image = Image.open(
        request.files["file"]
    ).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    with torch.no_grad():
        out = model.get_image_features(**inputs)

    query = (
        out.pooler_output[0]
        .detach()
        .cpu()
        .numpy()
        .astype("float32")
    )

    query /= np.linalg.norm(query)

    results = []

    for row in embeddings:

        vec = np.array(
            row["embedding"],
            dtype=np.float32
        )

        score = float(
            np.dot(query, vec)
        )

        item = lookup.get(
            row["id"],
            {}
        )

        kw = str(
            item.get("keywords","")
        ).lower()

        bonus = 0.0

        if "tela stella" in kw:
            bonus += 0.04

        if "ghost piece" in kw:
            bonus += 0.02

        if "ice jacket" in kw:
            bonus += 0.02

        if "reflective" in kw:
            bonus += 0.01

        final_score = score + bonus

        results.append({
            "score": round(final_score * 100, 2),
            "id": row["id"],
            "name": item.get("name"),
            "value": item.get("value"),
            "image": item.get("image")
        })

    results.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    return jsonify(
        results[:20]
    )

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )
