// 1. Sab kuch 'require' se layenge (Stability ke liye)
const { IncomingForm } = require('formidable'); // <--- Ye hai Asli Fix (Class Import)
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

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
    // --- FILE PARSING (Correct Way for Formidable v3) ---
    // Ab hum 'formidable()' function nahi, balki 'new IncomingForm' class use kar rahe hain
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true
    });

    // Promise wrapper taaki async/await use kar sakein
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

    // Load PDF
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

    // Encrypt (Password Lagana)
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