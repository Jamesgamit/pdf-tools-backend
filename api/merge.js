// api/merge.js
// Ye API multiple PDFs ko legi aur ek banakar wapas bhejegi

const { PDFDocument } = require('pdf-lib');
const multer = require('multer');

// Multer setup: Multiple files receive karne ke liye
// Vercel Free Plan limit: Total Payload size approx 4.5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 } 
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
  // 1. Security Lock (Open for AI testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle browser pre-check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. Receive Multiple Files
    // 'files' wo naam hai jo hum frontend se bhejenge
    await runMiddleware(req, res, upload.array('files'));

    // Check agar files aayi hain ya nahi
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Kam se kam 2 PDF select karein merge karne ke liye.' });
    }

    // 3. Nayi Khali PDF banao
    const mergedPdf = await PDFDocument.create();

    // 4. Loop chalao aur pages copy karo (Jo order frontend se aayega, wahi rahega)
    for (const file of req.files) {
      // Uploaded file ko load karo
      const pdf = await PDFDocument.load(file.buffer);
      // Uske saare pages copy karo
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      // Nayi PDF me pages chipka do
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    // 5. Save karo
    const pdfBytes = await mergedPdf.save();
    
    // 6. Wapas bhejo (Base64 format me)
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    res.status(200).json({
      success: true,
      count: req.files.length,
      downloadUrl: dataUrl
    });

  } catch (error) {
    console.error("Merge Error:", error);
    res.status(500).json({ error: error.message });
  }
}
