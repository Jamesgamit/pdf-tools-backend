// api/split.js
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');
const AdmZip = require('adm-zip'); // Zip banane ke liye

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.5 * 1024 * 1024 } // 4.5MB limit
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
  // CORS Testing ke liye Open rakha hai (*)
  res.setHeader('Access-Control-Allow-Origin', 'https://dailykit.netlify.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await runMiddleware(req, res, upload.single('file'));

    if (!req.file) return res.status(400).json({ error: 'No file found.' });
    if (!req.body.pages) return res.status(400).json({ error: 'No pages selected.' });

    // 1. Data ko samjho
    // Frontend hume "1,3,5" bhejeg, hum usse Array [0, 2, 4] banayenge (0-index ke liye)
    const selectedPages = JSON.parse(req.body.pages).map(p => parseInt(p) - 1);
    const mode = req.body.mode; // 'split_zip' ya 'merge_selected'

    const srcPdf = await PDFDocument.load(req.file.buffer);
    let downloadUrl = '';
    let fileName = '';

    // --- OPTION A: MERGE SELECTED PAGES ---
    if (mode === 'merge_selected') {
      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, selectedPages);
      copiedPages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      const base64 = Buffer.from(pdfBytes).toString('base64');
      downloadUrl = `data:application/pdf;base64,${base64}`;
      fileName = 'selected-pages-merged.pdf';
    } 
    
    // --- OPTION B: SPLIT TO ZIP ---
    else if (mode === 'split_zip') {
      const zip = new AdmZip();

      // Har selected page ke liye alag PDF banao aur ZIP me daalo
      for (const pageIndex of selectedPages) {
        const doc = await PDFDocument.create();
        const [page] = await doc.copyPages(srcPdf, [pageIndex]);
        doc.addPage(page);
        
        const pdfBuffer = await doc.save();
        // File ka naam: Page-1.pdf, Page-3.pdf...
        zip.addFile(`Page-${pageIndex + 1}.pdf`, Buffer.from(pdfBuffer));
      }

      const zipBuffer = zip.toBuffer();
      const base64 = zipBuffer.toString('base64');
      downloadUrl = `data:application/zip;base64,${base64}`;
      fileName = 'split-files.zip';
    }

    res.status(200).json({
      success: true,
      mode: mode,
      downloadUrl: downloadUrl,
      fileName: fileName
    });

  } catch (error) {
    console.error("Split Error:", error);
    res.status(500).json({ error: error.message });
  }
}