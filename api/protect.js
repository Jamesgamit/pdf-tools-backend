import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

// Vercel को बता रहे हैं कि फाइल हम खुद हैंडल करेंगे (Body Parser OFF)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // ---------------------------------------------------------
  // 1. CORS & SECURITY (Browser se connection allow karna)
  // ---------------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight Request handling
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Sirf POST request allow karein
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ---------------------------------------------------------
    // 2. FILE PARSING (Formidable Library)
    // ---------------------------------------------------------
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB Limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    // Formidable naye version me kabhi array deta hai, kabhi object
    // Isliye hum safe tarike se data nikalenge:
    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    // ---------------------------------------------------------
    // 3. PDF PROCESSING (Encryption)
    // ---------------------------------------------------------
    
    // File read karein
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // PDF Load karein
    const pdfDoc = await PDFDocument.load(fileBuffer);

    // Password lagayein
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

    // Wapas Buffer me convert karein
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // ---------------------------------------------------------
    // 4. SEND RESPONSE (Download File)
    // ---------------------------------------------------------
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to protect PDF.', 
      details: error.message 
    });
  }
}