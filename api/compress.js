const sharp = require('sharp');
const multer = require('multer');

// File receive karne ka setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB Limit
});

// Helper function
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // Lock Open Rakha hai (*) testing ke liye
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'No file found.' });
    }

    // --- QUALITY LOGIC START ---
    // Frontend se jo number aayega (30, 60, 90) use yaha padhenge
    let qualityLevel = parseInt(req.body.quality);

    // Agar koi number na aaye, to default 60 maano
    if (!qualityLevel || isNaN(qualityLevel)) {
      qualityLevel = 60;
    }
    // --- QUALITY LOGIC END ---

    const compressedBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: qualityLevel, mozjpeg: true }) 
      .toBuffer();

    const base64Image = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    res.status(200).json({
      success: true,
      originalSize: (req.file.size / 1024).toFixed(2) + ' KB',
      compressedSize: (compressedBuffer.length / 1024).toFixed(2) + ' KB',
      usedQuality: qualityLevel,
      downloadUrl: dataUrl
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
