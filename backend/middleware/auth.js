const { supabase } = require('../config/supabase');
const jwt = require('jsonwebtoken');

const isDemoMode = () => {
  return !process.env.SUPABASE_URL ||
    process.env.SUPABASE_URL.includes('your-project-id') ||
    process.env.SUPABASE_URL.includes('placeholder');
};

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // --- DEMO MODE: verify JWT locally ---
    if (isDemoMode()) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cliniccare-demo-secret');
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          full_name: decoded.full_name,
          phone: decoded.phone || null,
          avatar_url: null,
          is_active: true,
          demo: true
        };
        req.token = token;
        return next();
      } catch (jwtErr) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    // --- PRODUCTION MODE: verify with Supabase ---
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get profile
    const { supabaseAdmin } = require('../config/supabase');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = { ...user, ...profile };
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
