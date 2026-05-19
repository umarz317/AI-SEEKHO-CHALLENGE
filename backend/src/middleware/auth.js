const admin = require('firebase-admin');

let initialized = false;

function getFirebaseAuth() {
  if (initialized) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    console.warn('[auth] FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY not set — auth disabled');
    admin.initializeApp({ projectId: 'demo' });
  }

  initialized = true;
  return admin;
}

function authMiddleware(req, res, next) {
  try {
    const auth = getFirebaseAuth();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing auth token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    auth.auth().verifyIdToken(token)
      .then((decoded) => {
        req.userId = decoded.uid;
        req.userPhone = decoded.phone_number || null;
        next();
      })
      .catch((err) => {
        console.warn('[auth] Token verification failed:', err.code || err.message);
        res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token.' });
      });
  } catch (err) {
    console.error('[auth] Middleware error:', err);
    res.status(500).json({ error: 'auth_error', message: 'Authentication error.' });
  }
}

function requireAuth(req, res, next) {
  if (!process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_CLIENT_EMAIL) {
    req.userId = req.body.userId || 'demo-user-001';
    req.userPhone = req.body.customerPhone || req.body.phoneNumber || null;
    return next();
  }
  return authMiddleware(req, res, next);
}

module.exports = { authMiddleware, requireAuth };
