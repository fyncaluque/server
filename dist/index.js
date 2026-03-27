"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const profile_routes_1 = __importDefault(require("./routes/profile.routes"));
const schedule_routes_1 = __importDefault(require("./routes/schedule.routes"));
const openai_service_1 = require("./services/openai.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: ['http://localhost:4200', 'http://localhost:4300'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Available AI providers
app.get('/api/providers', (_req, res) => {
    const providers = (0, openai_service_1.getAvailableProviders)();
    res.json({ success: true, data: providers });
});
// Routes
app.use('/api/profile', profile_routes_1.default);
app.use('/api/schedule', schedule_routes_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// Global error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});
exports.default = app;
//# sourceMappingURL=index.js.map