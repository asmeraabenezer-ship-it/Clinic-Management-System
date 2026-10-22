const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const mockDb = require('../mockDb');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed: JPEG, PNG, GIF, PDF, TXT'));
    }
  }
});

// POST /api/files/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { patient_id, medical_record_id, description } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'Patient ID required' });

    if (mockDb.isDemoMode()) {
      return res.status(201).json({
        id: `file-${Date.now()}`,
        patient_id,
        medical_record_id: medical_record_id || null,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        file_url: '#',
        storage_path: `demo/patients/${patient_id}/${req.file.originalname}`,
        description: description || null,
        created_at: new Date().toISOString()
      });
    }

    const bucket = process.env.STORAGE_BUCKET || 'clinic-files';
    const ext = req.file.originalname.split('.').pop();
    const storagePath = `patients/${patient_id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from(bucket)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) return res.status(400).json({ error: uploadError.message });

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

    // Save file record
    const { data: fileRecord, error: recordError } = await supabaseAdmin
      .from('medical_files')
      .insert({
        patient_id,
        medical_record_id: medical_record_id || null,
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        file_url: urlData?.signedUrl || '',
        storage_path: storagePath,
        description: description || null
      })
      .select()
      .single();

    if (recordError) return res.status(400).json({ error: recordError.message });

    res.status(201).json(fileRecord);
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// GET /api/files/patient/:patient_id
router.get('/patient/:patient_id', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json([]);
    }

    const { data, error } = await supabaseAdmin
      .from('medical_files')
      .select('*, profiles(full_name)')
      .eq('patient_id', req.params.patient_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET /api/files/:id/url
router.get('/:id/url', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json({ url: '#' });
    }

    const { data: file } = await supabaseAdmin
      .from('medical_files')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!file) return res.status(404).json({ error: 'File not found' });

    const bucket = process.env.STORAGE_BUCKET || 'clinic-files';
    const { data } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 60 * 60); // 1 hour

    res.json({ url: data?.signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate file URL' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (mockDb.isDemoMode()) {
      return res.json({ message: 'File deleted successfully' });
    }

    const { data: file } = await supabaseAdmin
      .from('medical_files')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!file) return res.status(404).json({ error: 'File not found' });

    const bucket = process.env.STORAGE_BUCKET || 'clinic-files';
    await supabaseAdmin.storage.from(bucket).remove([file.storage_path]);

    await supabaseAdmin.from('medical_files').delete().eq('id', req.params.id);

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
