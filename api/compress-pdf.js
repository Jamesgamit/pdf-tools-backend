// api/compress-pdf.js
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');

// Setup multer (Limit 4.5MB for Vercel Free Tier)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 } 
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // CORS Testing (*)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file found.' });
    }

    // Frontend se Compression Level lo (low, recommended, extreme)
    const level = req.body.level || 'recommended';

    // 1. Load the original PDF
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    
    // 2. Create a new PDF (This process removes unused objects/metadata)
    const newPdf = await PDFDocument.create();
    
    // 3. Copy all pages to the new PDF
    const copiedPages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => newPdf.addPage(page));

    // Note: Vercel (Node.js) me bina Ghostscript ke "Deep Image Compression" mushkil hai.
    // Isliye hum PDF ko 'Re-save' kar rahe hain jo metadata clean karke size kam karta hai.
    // Future me hum isme external library jod sakte hain.

    const pdfBytes = await newPdf.save();
    
    // 4. Send back the Optimized PDF
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    res.status(200).json({
      success: true,
      originalSize: (req.file.size / 1024).toFixed(2) + ' KB',
      compressedSize: (pdfBytes.length / 1024).toFixed(2) + ' KB',
      downloadUrl: dataUrl
    });

  } catch (error) {
    console.error("PDF Compression Error:", error);
    res.status(500).json({ error: error.message });
  }
}