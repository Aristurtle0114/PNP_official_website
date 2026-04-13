import { Request, Response } from 'express';
import { db } from '../config/database.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });
export const uploadMiddleware = upload.single('pdfReport');

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const manualPins = [
  { name: 'Alipit', lat: 14.223931, lng: 121.405213 },
  { name: 'Bagumbayan', lat: 14.268334, lng: 121.398454 },
  { name: 'Duhat', lat: 14.2525, lng: 121.3825 },
  { name: 'Bubukal', lat: 14.256460, lng: 121.399183 },
  { name: 'Calios', lat: 14.2750, lng: 121.4050 },
  { name: 'Gatid', lat: 14.2600, lng: 121.3830 },
  { name: 'Jasaan', lat: 14.223577, lng: 121.394827 },
  { name: 'Labuin', lat: 14.250158, lng: 121.400664 },
  { name: 'Malinao', lat: 14.232833, lng: 121.396823 },
  { name: 'Oogong', lat: 14.226323, lng: 121.400621 },
  { name: 'Pagsawitan', lat: 14.265754, lng: 121.426545 },
  { name: 'Palasan', lat: 14.257498, lng: 121.418992 },
  { name: 'Patimbao', lat: 14.270081, lng: 121.418366 },
  { name: 'Poblacion I (Barangay I)', lat: 14.277068, lng: 121.418881 },
  { name: 'Poblacion II (Barangay II)', lat: 14.279647, lng: 121.416006 },
  { name: 'Poblacion III (Barangay III)', lat: 14.282028, lng: 121.415159 },
  { name: 'Poblacion IV (Barangay IV)', lat: 14.283790, lng: 121.414016 },
  { name: 'Poblacion V (Barangay V)', lat: 14.285282, lng: 121.412476 },
  { name: 'San Jose', lat: 14.237118, lng: 121.403754 },
  { name: 'San Juan', lat: 14.243815, lng: 121.406972 },
  { name: 'San Pablo Norte', lat: 14.290210, lng: 121.413023 },
  { name: 'San Pablo Sur', lat: 14.282211, lng: 121.422261 },
  { name: 'Santisima Cruz', lat: 14.290647, lng: 121.409140 },
  { name: 'Santo Angel Central', lat: 14.285137, lng: 121.408947 },
  { name: 'Santo Angel Norte', lat: 14.288547, lng: 121.406307 },
  { name: 'Santo Angel Sur', lat: 14.282329, lng: 121.410985 }
];

export const getLogin = (req: Request, res: Response) => {
  if (req.session.user) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: 'Admin Login', layout: false });
};

export const postLogin = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!req.session) {
    return res.status(500).send('Session error: No session object found');
  }

  try {
    const snap = await db.collection('users').where('username', '==', username).limit(1).get();
    
    if (snap.empty) {
      return res.render('admin/login', { title: 'Admin Login', layout: false, error_msg: 'Invalid username or password' });
    }

    const user = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

    // Fallback for plain text 'admin123' if bcrypt fails or for easier testing
    const isPasswordCorrect = bcrypt.compareSync(password, user.password_hash) || (password === 'admin123' && user.username === 'superadmin');

    if (isPasswordCorrect) {
      req.session.user = { id: user.id, username: user.username, full_name: user.full_name, role: user.role };
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).send('Error saving session');
        }
        res.redirect('/admin/dashboard');
      });
    } else {
      res.render('admin/login', { title: 'Admin Login', layout: false, error_msg: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).send('Error during login');
  }
};

export const getLogout = (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const [
      activeBulletinsSnap,
      tipsReceivedSnap,
      totalUsersSnap,
      recentTipsSnap,
      recentLogsSnap
    ] = await Promise.all([
      db.collection('bulletins').where('is_archived', '==', false).count().get(),
      db.collection('anonymous_tips').count().get(),
      db.collection('users').count().get(),
      db.collection('anonymous_tips').orderBy('created_at', 'desc').limit(5).get(),
      db.collection('audit_logs').orderBy('timestamp', 'desc').limit(5).get()
    ]);

    const stats = {
      activeBulletins: activeBulletinsSnap.data().count,
      tipsReceived: tipsReceivedSnap.data().count,
      totalUsers: totalUsersSnap.data().count
    };

    const recentTips = recentTipsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const recentLogs = await Promise.all(recentLogsSnap.docs.map(async doc => {
      const log = doc.data();
      const userDoc = await db.collection('users').doc(log.admin_id).get();
      return { id: doc.id, ...log, username: userDoc.exists ? (userDoc.data() as any).username : 'Unknown' };
    }));

    res.render('admin/dashboard', { 
      title: 'Dashboard', 
      stats, 
      recentTips, 
      recentLogs,
      layout: 'layouts/admin' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading dashboard');
  }
};

export const getBulletins = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('bulletins').orderBy('created_at', 'desc').get();
    const bulletins = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/bulletins', { title: 'Manage Bulletins', bulletins, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading bulletins');
  }
};

export const getCreateBulletin = (req: Request, res: Response) => {
  res.render('admin/bulletin_form', { title: 'New Bulletin', bulletin: null, layout: 'layouts/admin' });
};

export const postCreateBulletin = async (req: Request, res: Response) => {
  const { title, category, body } = req.body;
  try {
    await db.collection('bulletins').add({
      title,
      category,
      body,
      posted_by: req.session.user.id,
      is_archived: false,
      created_at: new Date().toISOString()
    });
    res.redirect('/admin/bulletins');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating bulletin');
  }
};

export const getEditBulletin = async (req: Request, res: Response) => {
  try {
    const doc = await db.collection('bulletins').doc(req.params.id).get();
    const bulletin = { id: doc.id, ...doc.data() };
    res.render('admin/bulletin_form', { title: 'Edit Bulletin', bulletin, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading bulletin');
  }
};

export const postEditBulletin = async (req: Request, res: Response) => {
  const { title, category, body, is_archived } = req.body;
  try {
    await db.collection('bulletins').doc(req.params.id).update({
      title,
      category,
      body,
      is_archived: is_archived === 'on' || is_archived === true,
      updated_at: new Date().toISOString()
    });
    res.redirect('/admin/bulletins');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating bulletin');
  }
};

export const deleteBulletin = async (req: Request, res: Response) => {
  try {
    await db.collection('bulletins').doc(req.params.id).delete();
    res.redirect('/admin/bulletins');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting bulletin');
  }
};

export const getTips = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('anonymous_tips').orderBy('created_at', 'desc').get();
    const tips = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/tips', { title: 'Anonymous Tips', tips, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading tips');
  }
};

export const updateTip = async (req: Request, res: Response) => {
  const { is_flagged, admin_notes } = req.body;
  try {
    await db.collection('anonymous_tips').doc(req.params.id).update({
      is_flagged: is_flagged === 'on' || is_flagged === true,
      admin_notes,
      updated_at: new Date().toISOString()
    });
    res.redirect('/admin/tips');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating tip');
  }
};

export const getMap = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('map_points').get();
    const points = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/map', { title: 'Map Management', points, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading map points');
  }
};

export const postMapPoint = async (req: Request, res: Response) => {
  const { incident_type, incident_date, barangay, description } = req.body;
  
  // Find coordinates for the selected barangay
  const pin = manualPins.find(p => p.name === barangay);
  if (!pin) {
    return res.status(400).send('Invalid Barangay selected');
  }

  try {
    await db.collection('map_points').add({
      lat: pin.lat,
      lng: pin.lng,
      incident_type,
      incident_date,
      barangay,
      description: description || '',
      created_at: new Date().toISOString()
    });
    res.redirect('/admin/map');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding map point');
  }
};

export const uploadPdf = async (req: MulterRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).send('No PDF file uploaded');
  }

  try {
    const dataBuffer = req.file.buffer;
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;

    // Store the PDF data in the database
    await db.collection('uploaded_reports').add({
      filename: req.file.originalname,
      content: text,
      uploaded_at: new Date().toISOString(),
      admin_id: (req.session as any).user.id
    });

    // Simple parser logic (Mock for now, can be improved with regex)
    // For demonstration, we'll just log that we processed it
    console.log(`Processed PDF: ${req.file.originalname}. Extracted ${text.length} characters.`);

    res.redirect('/admin/map?success=PDF processed and stored successfully');
  } catch (err) {
    console.error('PDF Processing Error:', err);
    res.status(500).send('Error processing PDF');
  }
};

export const getHotlines = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('hotlines').orderBy('category').get();
    const hotlines = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/hotlines', { title: 'Manage Hotlines', hotlines, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading hotlines');
  }
};

export const postHotline = async (req: Request, res: Response) => {
  const { name, number, category } = req.body;
  try {
    await db.collection('hotlines').add({
      name,
      number,
      category,
      updated_at: new Date().toISOString()
    });
    res.redirect('/admin/hotlines');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding hotline');
  }
};

export const deleteHotline = async (req: Request, res: Response) => {
  try {
    await db.collection('hotlines').doc(req.params.id).delete();
    res.redirect('/admin/hotlines');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting hotline');
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('users').get();
    const users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/users', { title: 'User Management', users, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading users');
  }
};

export const postUser = async (req: Request, res: Response) => {
  const { username, full_name, password, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    await db.collection('users').add({
      username,
      full_name,
      password_hash: hash,
      role,
      created_at: new Date().toISOString()
    });
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating user');
  }
};

export const getAuditLog = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection('audit_logs').orderBy('timestamp', 'desc').get();
    const logs = await Promise.all(snap.docs.map(async doc => {
      const log = doc.data();
      const userDoc = await db.collection('users').doc(log.admin_id).get();
      return { id: doc.id, ...log, admin_name: userDoc.exists ? (userDoc.data() as any).full_name : 'Unknown' };
    }));
    res.render('admin/audit_log', { title: 'Audit Log', logs, layout: 'layouts/admin' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading audit logs');
  }
};
