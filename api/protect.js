// 1. Formidable ko IMPORT se layenge (Ye parsing ke liye best hai)
import formidable from 'formidable';
import fs from 'fs';

// 2. PDF-Lib ko REQUIRE se layenge (Taaki encrypt function delete na ho)
// Ye "Tree-shaking" issue ko 100% rok dega
const { PDFDocument } = require('pdf-lib');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // --- FILE PARSING ---
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true
    });

    // Promise Wrapper taaki code saaf rahe
    const parseForm = (req) => new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { fields, files } = await parseForm(req);

    // Data Safely Nikalna
    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    // --- PDF PROTECTION ---
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // Yaha 'require' wala PDFDocument use hoga
    const pdfDoc = await PDFDocument.load(fileBuffer);

    pdfDoc.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        printing: 'highResolution',
        modifying: false,
        copying: false,
        annotating: false,
      },
    });

    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // --- DOWNLOAD ---
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('SERVER ERROR:', error);
    return res.status(500).json({ 
      error: 'Failed to protect PDF', 
      details: error.message 
    });
  }
}