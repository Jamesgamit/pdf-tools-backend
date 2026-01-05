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
  // 1. CORS SETTINGS (Security Guard)
  // ---------------------------------------------------------
  
  // '*' का मतलब है कोई भी वेबसाइट इसे यूज़ कर सकती है (Development के लिए Best)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // अगर ब्राउज़र पूछ रहा है "क्या मैं आ सकता हूँ?" (Preflight Request)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // सिर्फ POST रिक्वेस्ट ही अलाउ करेंगे
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---------------------------------------------------------
  // 2. MAIN LOGIC (File Processing)
  // ---------------------------------------------------------
  try {
    const form = formidable({});

    // फाइल और पासवर्ड को पार्स (Read) करना
    const [fields, files] = await form.parse(req);

    // डेटा निकालना (Safe way)
    const password = fields.password?.[0];
    const uploadedFile = files.file?.[0];

    // चेक करना कि डेटा आया है या नहीं
    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    // अपलोड हुई फाइल को पढ़ना
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // PDF लोड करना
    const pdfDoc = await PDFDocument.load(fileBuffer);

    // 🔒 पासवर्ड लगाना (ENCRYPTION)
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

    // फाइल को वापस सेव करना
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // ---------------------------------------------------------
    // 3. SEND RESPONSE (Download)
    // ---------------------------------------------------------
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to protect PDF. Make sure file is under 4.5MB.', 
      details: error.message 
    });
  }
}