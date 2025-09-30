const express = require('express');
const multer = require('multer');
const { ocrImageToText, kvFromOcrText } = require('./ocr');
const { profileFromInput } = require('./pipeline');

const app = express();
const upload = multer();

function respondWithError(res, statusCode, message, extra = {}) {
  return res.status(statusCode).json({ status: 'error', message, ...extra });
}


app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/profile', upload.single('form_image'), async (req, res) => {
  try {
    const isJsonInput = Object.keys(req.body || {}).length > 0;
    const hasImage = req.file != null;

  if (!hasImage && !isJsonInput) {
    return respondWithError(res, 400, 'no_input_provided');
  }


    let textJson = isJsonInput ? req.body : null;
    let ocrKv = null;

    if (hasImage) {
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return respondWithError(res, 415, 'Unsupported image format. Use JPEG, PNG, or WebP.')
      }

      try {
        const ocrText = await ocrImageToText(req.file.buffer);
        ocrKv = kvFromOcrText(ocrText);
        if (Object.keys(ocrKv).length === 0) {
          return respondWithError(res, 422, 'OCR failed or form is unreadable.', 'No recognizable key-value pairs found in the image.')
        }
      } catch (ocrErr) {
          return respondWithError(res, 500, 'ocr_processing_failed')
      }
    }

    const result = profileFromInput({ textJson, ocrKv });

    if (result.status === 'incomplete_profile') {
      return respondWithError(res, 422, 'incomplete_profile', result.missing_fields || [])
    }

    console.log('Response payload:', JSON.stringify(result, null, 2));
    return res.json(result);

  } catch (err) {
    console.error('Unexpected error in /profile:', err);
    return respondWithError(res, 500, 'internal_server_error')
  }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Health Risk Profiler API listening on :${PORT}`));
