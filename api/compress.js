const sharp = require('sharp');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

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
  // ----------------------------------------------------
  // FIXED: LOCK OPEN KAR DIYA HAI (Change back to '*')
  // ----------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'No file found. Please upload an image.' });
    }

    const compressedBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 60, mozjpeg: true })
      .toBuffer();

    const base64Image = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    res.status(200).json({
      success: true,
      originalSize: (req.file.size / 1024).toFixed(2) + ' KB',
      compressedSize: (compressedBuffer.length / 1024).toFixed(2) + ' KB',
      downloadUrl: dataUrl
    });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
