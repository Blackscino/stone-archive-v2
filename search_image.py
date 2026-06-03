import json
import sys
import numpy as np
import torch
from pathlib import Path
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

if len(sys.argv) < 2:
    print('Uso: python3 search_image.py FOTO.jpg [parole guida opzionali]')
    sys.exit(1)

ROOT = Path.home() / 'Desktop/stone_archive_v2'
EMB = ROOT / 'src/embeddings.json'

img_path = Path(sys.argv[1])
guide_words = ' '.join(sys.argv[2:]).lower().strip().split()

print('Carico embeddings...')
data = json.loads(EMB.read_text())

print('Carico CLIP...')
model = CLIPModel.from_pretrained('openai/clip-vit-base-patch32')
processor = CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
model.eval()

image = Image.open(img_path).convert('RGB')
inputs = processor(images=image, return_tensors='pt')

with torch.no_grad():
    out = model.get_image_features(**inputs)

query = (
    out.pooler_output[0]
    .detach()
    .cpu()
    .numpy()
    .astype('float32')
)

query = query / np.linalg.norm(query)

results = []

for row in data:
    v = np.array(row['embedding'], dtype=np.float32)

    visual_score = float(np.dot(query, v))

    text = ' '.join([
        str(row.get('name', '')),
        str(row.get('value', '')),
        str(row.get('image', '')),
    ]).lower()

    text_bonus = 0

    for word in guide_words:
        if word in text:
            text_bonus += 0.035

    final_score = visual_score + text_bonus

    results.append((
        final_score,
        visual_score,
        text_bonus,
        row.get('name', ''),
        row.get('value', ''),
        row.get('image', '')
    ))

results.sort(reverse=True)

print('\nTOP 10 RISULTATI\n')

if guide_words:
    print('Parole guida:', ' '.join(guide_words), '\n')

for i, (final_score, visual_score, text_bonus, name, value, image) in enumerate(results[:10], start=1):
    print(
        f'{i}. {name} | finale {round(final_score*100,2)}% | visual {round(visual_score*100,2)}% | bonus {round(text_bonus*100,2)}% | {value}'
    )
