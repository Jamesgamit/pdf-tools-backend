// api/compress.js
// Updated with your Netlify Domain

const sharp = require('sharp');
const multer = require('multer');

// Multer setup (File receive karne ke liye)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // 4MB Limit
});

// Helper function to handle Multer in Vercel
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
  // 1. SECURITY LOCK (Sirf aapki website ke liye)
  // ----------------------------------------------------
  // Note: Maine last ka '/' hata diya hai, wo origin me nahi lagta.
  res.setHeader('Access-Control-Allow-Origin', 'https://dailykit.netlify.app');
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request (Browser ki checking)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. File Receive karo
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'Koi file nahi mili. Please upload an image.' });
    }

    // 3. Image Compress karo (Sharp library)
    const compressedBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 60, mozjpeg: true }) // Quality 60%
      .toBuffer();

    // 4. File wapas bhejo (Base64 string bankar)
    const base64Image = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    res.status(200).json({
      success: true,
      originalSize: (req.file.size / 1024).toFixed(2) + ' KB',
      compressedSize: (compressedBuffer.length / 1024).toFixed(2) + ' KB',
      downloadUrl: dataUrl
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}
