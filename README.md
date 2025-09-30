## AI Health Profiler – Backend
An API that ingests either JSON or an image (OCR via tesseract.js), normalizes noisy health survey fields, scores simple (non-diagnostic) risk, and returns recommendations.

✨ Features

Accepts JSON or multipart image (form_image) with OCR.

Robust normalization of noisy inputs (e.g., rarly → rarely, hghsugr → high sugar).

Confidence scoring with penalties for missing fields.

Clear JSON responses and guardrails.

## Project Structure

ai-health-profiler/
├─ src/
│  ├─ server.js          # Express app, routes
│  ├─ ocr.js             # Tesseract OCR + Field: Value parser
│  ├─ pipeline.js        # Normalization, scoring, recommendations
│  └─ utils.js           # Constants & helpers
├─ package.json
└─ README.md

## Setup
Requirements
Node.js ≥ 18
ngrok for public demo

## Install & Run (local)

npm ci
npm start

#Expose locally with ngrok

ngrok http 3000

### Architecture

## Flow

# Input

JSON body: { age, smoker, exercise, diet } OR image (multipart field form_image) with lines like Age: 40.
OCR & parse (ocr.js)
tesseract.js extracts text.
kvFromOcrText parses Field: Value lines to key/values.
Normalize (pipeline.js)
normalizeKv validates/normalizes required fields (age, smoker, exercise, diet).
Fuzzy matching for misspellings (e.g., rarly → rarely, hghsugr → high sugar).
Confidence = avg(field confidences) − 0.1 × (missing fields).
Analyze & Recommend
extractFactors → scoreAndClassify → recommend.
Respond with a structured JSON payload.

### Key files

src/server.js — Express endpoints: GET /health, POST /profile (JSON or multipart).
src/ocr.js — OCR to text, then parse to key/values.
src/pipeline.js — Normalization, factor extraction, risk scoring, recommendations.
src/utils.js — Constants: required fields, YES/NO sets, mapping tables, clamp.

### API
GET http://localhost:3000/health
POST http://localhost:3000/profile (JSON) - Headers: Content-Type: application/json
https://annelle-forceless-christiane.ngrok-free.dev/profile - Headers: Content-Type: application/json

### Sample Inputs 
(noisy input)
{
  "age": "4 years",
  "exercise": "rarely",
  "diet": "hghsugr",
  "smoker": "unknown"
}

(400- no input provided)
{ "status": "incomplete_profile", "reason": "no input provided" }

# POST /profile (Image OCR)
Content-Type: multipart/form-data
Form-data field: form_image (File)

# input
Age: 55
Smoker: Yes
Exercise: Often
Diet: Processed

## Using Postman / Thunder Client

Create a POST request to /profile.
For JSON: Body → raw → JSON → paste the sample payload.
For OCR: Body → form-data → key form_image → pick a file → Send.

## Guardrails & Error Handling

Missing fields are reported in missing_fields and reduce overall confidence.
Age validated to 0–120; invalid/missing → counted as missing.
Smoker parsed via YES/NO sets; unrecognized → missing.
OCR path only runs with form_image provided.
Internal errors → 500 { "status": "error", "message": "internal_error" }

## Notes on AI/Heuristics

Fuzzy mapping (Levenshtein + similarity threshold) to canonical labels for exercise and diet.
Examples:
rarly → rarely
hghsugr → high sugar
Confidence is averaged from field-level confidences minus a penalty for missing fields.

## Screenshots
<img width="2065" height="1208" alt="image" src="https://github.com/user-attachments/assets/62b6f11c-c3f5-48ad-b839-c5a001ff5317" />

<img width="2041" height="1177" alt="image" src="https://github.com/user-attachments/assets/08d5678b-d2ba-41e7-96e5-ccb45ead8391" />

<img width="2076" height="650" alt="image" src="https://github.com/user-attachments/assets/6fe25bc1-c822-478b-9a4c-0a2495c56442" /> 


<img width="500" height="400" alt="image" src="https://github.com/user-attachments/assets/41463139-8134-4b98-93b6-790144d34d90" /> | <img width="auto" height="300" alt="image" src="https://github.com/user-attachments/assets/7dd2bb16-0b56-4e8d-9b86-0ea2a6ec2b45" />



<img width="500" height="400" alt="image" src="https://github.com/user-attachments/assets/c7f91744-14c9-4fcc-9031-5922017eee2d" /> | <img width="auto" height="400" alt="image" src="https://github.com/user-attachments/assets/cb406089-e413-4851-ac9c-9ba84801a22b" />


## Flowchart
flowchart TD
    A[Client\n(Thunder/ Postman/ curl)] -->|POST /profile| B{Content-Type?}

    B -->|application/json| C[JSON Path]
    B -->|multipart/form-data\nwith form_image| D[OCR Path]
    B -->|other/none| E[400\nincomplete_profile: no input]

    %% JSON path
    C --> C1[server.js\nreq.body = {age, smoker, exercise, diet}]
    C1 --> G[profileFromInput({ textJson, ocrKv })]

    %% OCR path
    D --> D1[server.js\nmulter.memoryStorage()]
    D1 --> D2[ocrImageToText(buffer)\n(tesseract.js)]
    D2 -->|raw text| D3[kvFromOcrText(text)\n• normalize separators (=，— → :)\n• fuzzy key map (exercize→exercise)\n• keep values raw]
    D3 --> G

    %% Pipeline
    G --> H[normalizeKv(raw)\n• age parse & range\n• normBool(YES/NO/1/0)\n• normExercise (maps+fuzzy)\n• normDiet (maps+fuzzy)\n• confidence = avg(field confs) - 0.1*missing]
    H -->|>50% missing| I[Return\n{status: incomplete_profile,\nreason: '>50% fields missing'}]
    H -->|OK| J[extractFactors(answers)\n• smoking, low exercise, poor diet]

    J --> K[scoreAndClassify(answers)\n• weighted sum → risk_level]
    K --> L[recommend(risk_level, factors)]
    L --> M[server.js returns 200\n{ parsed, factors, risk, recommendations }]

    %% Errors
    D2 -->|throw| X[500\n{status: error,\nmessage: ocr_processing_failed}]
    E -->|response| Z[Done]
    I -->|response| Z
    M -->|response| Z
    X -->|response| Z






