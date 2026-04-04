const fs = require('fs');

// 1. Patch vision-ocr.service.js — fix hardcoded baseURL
const svcPath = '/app/dist/src/modules/ai-engine/vision-ocr.service.js';
let svc = fs.readFileSync(svcPath, 'utf8');
svc = svc.replace(
  "baseURL: 'https://api.openai.com/v1'",
  "baseURL: this.configService.get('OPENAI_VISION_BASE_URL') || 'https://api.openai.com/v1'"
);
fs.writeFileSync(svcPath, svc);
console.log('Service patched:', svc.includes('OPENAI_VISION_BASE_URL'));

// 2. Patch vision-ocr-prompt.js — more tolerant prompt
const promptPath = '/app/dist/src/modules/ai-engine/prompts/vision-ocr-prompt.js';
const newContent = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISION_OCR_PROMPT_VERSION = exports.VISION_OCR_SYSTEM_PROMPT = void 0;
exports.VISION_OCR_SYSTEM_PROMPT = \`Tu es un systeme OCR medical specialise dans la lecture de tensiometres.

MISSION: Extraire les valeurs d'un tensiometre depuis une photo.

IMPORTANT — DETECTION DU TENSIOMETRE:
- Un tensiometre est tout appareil medical avec un brassard qui affiche des chiffres (tension + pouls)
- Accepte TOUTES les marques: Omron, Beurer, Withings, Microlife, iHealth, et marques generiques
- Accepte les photos floues, de biais, sombres, avec reflets — tant que des chiffres sont visibles
- Accepte les ecrans LCD, LED, OLED, e-ink, numeriques de toute forme
- Si tu vois un appareil avec un brassard OU un ecran affichant 2-3 nombres (type tension), c'est un tensiometre → is_valid_device: true
- En cas de doute, mets is_valid_device: true et confidence: "low"
- Ne rejette QUE les images qui ne montrent AUCUN appareil medical (ex: selfie, paysage, nourriture)

VALEURS A EXTRAIRE:
- SYS (systolique) mmHg — le plus grand nombre (souvent en haut)
- DIA (diastolique) mmHg — le nombre moyen (souvent au milieu)
- PUL/PULSE bpm — le plus petit nombre (souvent en bas, icone coeur)

REPONSE (JSON uniquement, rien d'autre):
{"is_valid_device": true, "systolic": 120, "diastolic": 80, "pulse": 72, "confidence": "high", "raw_text": "ecran LCD affichant SYS 120 DIA 80 PUL 72"}

REGLES: systolic 50-300, diastolic 30-200, pulse 30-250, systolic > diastolic. Si illisible, retourne null.\`;
exports.VISION_OCR_PROMPT_VERSION = '2.0.0';
`;
fs.writeFileSync(promptPath, newContent);
console.log('Prompt patched to v2.0.0');
