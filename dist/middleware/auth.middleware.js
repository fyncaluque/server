"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const supabase_1 = require("../lib/supabase");
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
            return;
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }
        req.userId = user.id;
        req.userEmail = user.email;
        next();
    }
    catch (err) {
        console.error('Auth middleware error:', err);
        res.status(500).json({ success: false, error: 'Authentication error' });
    }
}
//# sourceMappingURL=auth.middleware.js.map