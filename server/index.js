import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import qrcode from "qrcode";
import CryptoJS from "crypto-js";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const JWT_SECRET = "secrondasjwtsecret2025";
const QR_SECRET = "secrondasqrsecret2025";

// Configuração HTTPS
const HTTPS_PORT = process.env.HTTPS_PORT || 3003;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "./ssl/server.key";
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "./ssl/server.crt";

console.log('=== INICIALIZANDO SERVIDOR ===');
console.log(`Porta HTTPS: ${HTTPS_PORT}`);
console.log(`Caminho da chave SSL: ${SSL_KEY_PATH}`);
console.log(`Caminho do certificado SSL: ${SSL_CERT_PATH}`);
console.log(`Diretório atual: ${__dirname}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

app.use(cors());
app.use(express.json());

// Middleware de logging melhorado
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware de tratamento de erros
const errorHandler = (error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ 
    message: "Erro interno do servidor",
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

// Servir arquivos estáticos - caminho ajustado para container
const distPath = path.join(__dirname, '../dist');
console.log(`Servindo arquivos estáticos de: ${distPath}`);
console.log(`Diretório dist existe: ${fs.existsSync(distPath)}`);
app.use(express.static(distPath));

// Configuração do banco de dados - caminho ajustado para container
const dbPath = path.join(__dirname, './database.db');
console.log(`Caminho do banco de dados: ${dbPath}`);
console.log(`Banco de dados existe: ${fs.existsSync(dbPath)}`);

const db = createClient({ url: `file:${dbPath}` });

async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT CHECK(role IN ('admin', 'guard')) NOT NULL DEFAULT 'guard', active BOOLEAN NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL, description TEXT, latitude REAL NOT NULL, longitude REAL NOT NULL, active BOOLEAN NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, guard_id INTEGER NOT NULL, checkpoint_id INTEGER NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, status TEXT CHECK(status IN ('success', 'failed', 'offline')) NOT NULL, latitude REAL, longitude REAL, distance REAL, accuracy REAL)`);
  
  const admin = await db.execute({ sql: "SELECT * FROM users WHERE role = 'admin' LIMIT 1", args: [] });
  if (admin.rows.length === 0) {
    const hash = await bcrypt.hash("3512", 6);
    await db.execute({ sql: `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, args: ["Admin", "admin@gmail.com", hash, "admin"] });
  }
}

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token necessário" });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token inválido" });
    req.user = user;
    next();
  });
};

const admin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Acesso negado" });
  next();
};

const genQR = async (id) => {
  const payload = { checkpointId: id, timestamp: Date.now() };
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), QR_SECRET).toString();
  const qr = await qrcode.toDataURL(encrypted, { errorCorrectionLevel: "L", scale: 4, margin: 1 });
  return { qrCodeUrl: qr, encrypted };
};

const validateQR = (data) => {
  try {
    const bytes = CryptoJS.AES.decrypt(data, QR_SECRET);
    const decrypted = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    const expired = Date.now() - decrypted.timestamp > 48 * 60 * 60 * 1000;
    return expired ? { valid: false, message: "QR expirado" } : { valid: true, checkpointId: decrypted.checkpointId };
  } catch (error) {
    return { valid: false, message: "QR inválido" };
  }
};

const calcDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

// Validation helper function
const validateCheckpointData = (data) => {
  const { name, location, latitude, longitude } = data;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, message: "Nome é obrigatório" };
  }
  
  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return { valid: false, message: "Localização é obrigatória" };
  }
  
  if (latitude === undefined || latitude === null || isNaN(Number(latitude))) {
    return { valid: false, message: "Latitude é obrigatória e deve ser um número válido" };
  }
  
  if (longitude === undefined || longitude === null || isNaN(Number(longitude))) {
    return { valid: false, message: "Longitude é obrigatória e deve ser um número válido" };
  }
  
  const lat = Number(latitude);
  const lng = Number(longitude);
  
  if (lat < -90 || lat > 90) {
    return { valid: false, message: "Latitude deve estar entre -90 e 90" };
  }
  
  if (lng < -180 || lng > 180) {
    return { valid: false, message: "Longitude deve estar entre -180 e 180" };
  }
  
  return { valid: true };
};

app.get("/api/health", (req, res) => {
  console.log('Health check chamado');
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    port: HTTPS_PORT
  });
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ? AND active = 1", args: [email] });
    if (result.rows.length === 0) return res.status(401).json({ message: "Email ou senha inválidos" });
    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ message: "Email ou senha inválidos" });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor" });
  }
});

app.put("/api/user/profile", auth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [req.user.id] });
    if (user.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });
    if (!await bcrypt.compare(currentPassword, user.rows[0].password)) return res.status(401).json({ message: "Senha atual incorreta" });
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 6);
      await db.execute({ sql: "UPDATE users SET name = ?, password = ? WHERE id = ?", args: [name, hash, req.user.id] });
    } else {
      await db.execute({ sql: "UPDATE users SET name = ? WHERE id = ?", args: [name, req.user.id] });
    }
    res.json({ message: "Perfil atualizado" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
});

app.get("/api/guard/checkpoints", auth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT c.id, c.name, c.location, CASE WHEN EXISTS (SELECT 1 FROM checkins WHERE checkpoint_id = c.id AND guard_id = ? AND DATE(timestamp) = DATE('now', 'localtime')) THEN 'completed' ELSE 'pending' END as status, c.latitude, c.longitude FROM checkpoints c WHERE c.active = 1 ORDER BY c.name`,
      args: [req.user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar pontos" });
  }
});

app.get("/api/guard/checkins/recent", auth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT c.id, c.timestamp, c.status, cp.name as checkpoint_name, cp.location FROM checkins c JOIN checkpoints cp ON c.checkpoint_id = cp.id WHERE c.guard_id = ? AND DATE(c.timestamp) = DATE('now', 'localtime') ORDER BY c.timestamp DESC LIMIT 10`,
      args: [req.user.id]
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar registros" });
  }
});

app.get("/api/guard/checkins", auth, async (req, res) => {
  try {
    const { date, status, search } = req.query;
    let sql = `SELECT c.id, c.timestamp, c.status, c.checkpoint_id, cp.name as checkpoint_name, cp.location FROM checkins c JOIN checkpoints cp ON c.checkpoint_id = cp.id WHERE c.guard_id = ?`;
    const args = [req.user.id];
    if (date) { sql += ` AND DATE(c.timestamp) = DATE(?)`; args.push(date); }
    if (status && status !== "all") { sql += ` AND c.status = ?`; args.push(status); }
    if (search) { sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`; args.push(`%${search}%`, `%${search}%`); }
    sql += ` ORDER BY c.timestamp DESC`;
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar histórico" });
  }
});

app.post("/api/checkin", auth, async (req, res) => {
  try {
    const { qrData, location, locationAccuracy } = req.body;
    const validation = validateQR(qrData);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });
    
    const checkpoint = await db.execute({ sql: "SELECT * FROM checkpoints WHERE id = ? AND active = 1", args: [validation.checkpointId] });
    if (checkpoint.rows.length === 0) return res.status(404).json({ success: false, message: "Ponto não encontrado" });
    
    const cp = checkpoint.rows[0];
    let status = "success", distance = null;
    
    if (location && cp.latitude && cp.longitude) {
      distance = calcDistance(location.lat, location.lng, cp.latitude, cp.longitude);
      const radius = 100 + (locationAccuracy ? Math.min(locationAccuracy, 500) : 0);
      if (distance > radius) status = "failed";
    }
    
    await db.execute({
      sql: `INSERT INTO checkins (guard_id, checkpoint_id, status, latitude, longitude, distance, accuracy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [req.user.id, validation.checkpointId, status, location?.lat, location?.lng, distance, locationAccuracy]
    });
    
    res.json({
      success: status !== "failed",
      message: status === "success" ? "Verificado com sucesso" : "Muito distante do ponto",
      checkpoint: { id: cp.id, name: cp.name, location: cp.location },
      distance,
      status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erro na verificação" });
  }
});

app.get("/api/checkpoints/info", auth, async (req, res) => {
  try {
    const validation = validateQR(req.query.qrData);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });
    
    const checkpoint = await db.execute({ sql: "SELECT * FROM checkpoints WHERE id = ? AND active = 1", args: [validation.checkpointId] });
    if (checkpoint.rows.length === 0) return res.status(404).json({ success: false, message: "Ponto não encontrado" });
    
    const cp = checkpoint.rows[0];
    res.json({
      success: true,
      checkpoint: { id: cp.id, name: cp.name, location: { lat: cp.latitude, lng: cp.longitude }, description: cp.description }
    });
  } catch (error) {
    console.error('Get checkpoint info error:', error);
    res.status(500).json({ success: false, message: "Erro ao obter informações", error: error.message });
  }
});

app.get("/api/admin/users", auth, admin, async (req, res) => {
  try {
    const result = await db.execute({ sql: "SELECT id, name, email, role, active, created_at FROM users ORDER BY name", args: [] });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar usuários" });
  }
});

app.post("/api/admin/users", auth, admin, async (req, res) => {
  try {
    const { name, email, password, role, active } = req.body;
    const check = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (check.rows.length > 0) return res.status(400).json({ message: "Email já existe" });
    
    const hash = await bcrypt.hash(password, 6);
    const result = await db.execute({ sql: "INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, ?)", args: [name, email, hash, role, active ? 1 : 0] });
    const user = await db.execute({ sql: "SELECT id, name, email, role, active, created_at FROM users WHERE id = ?", args: [result.lastInsertRowid] });
    res.status(201).json(user.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

app.put("/api/admin/users/:id", auth, admin, async (req, res) => {
  try {
    const { name, email, password, role, active } = req.body;
    const userId = req.params.id;
    
    const userCheck = await db.execute({ sql: "SELECT id FROM users WHERE id = ?", args: [userId] });
    if (userCheck.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });
    
    if (email) {
      const emailCheck = await db.execute({ sql: "SELECT id FROM users WHERE email = ? AND id != ?", args: [email, userId] });
      if (emailCheck.rows.length > 0) return res.status(400).json({ message: "Email já existe" });
    }
    
    if (password) {
      const hash = await bcrypt.hash(password, 6);
      await db.execute({ sql: "UPDATE users SET name = ?, email = ?, password = ?, role = ?, active = ? WHERE id = ?", args: [name, email, hash, role, active ? 1 : 0, userId] });
    } else {
      await db.execute({ sql: "UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?", args: [name, email, role, active ? 1 : 0, userId] });
    }
    
    const user = await db.execute({ sql: "SELECT id, name, email, role, active, created_at FROM users WHERE id = ?", args: [userId] });
    res.json(user.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

app.delete("/api/admin/users/:id", auth, admin, async (req, res) => {
  try {
    const userId = req.params.id;
    const check = await db.execute({ sql: "SELECT id FROM users WHERE id = ?", args: [userId] });
    if (check.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado" });
    if (parseInt(userId) === req.user.id) return res.status(400).json({ message: "Não pode excluir a si mesmo" });
    
    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
    res.json({ message: "Usuário removido" });
  } catch (error) {
    res.status(500).json({ message: "Erro ao remover usuário" });
  }
});

app.get("/api/admin/checkpoints", auth, async (req, res) => {
  try {
    const result = await db.execute({ sql: "SELECT * FROM checkpoints ORDER BY name", args: [] });
    res.json(result.rows);
  } catch (error) {
    console.error('Get admin checkpoints error:', error);
    res.status(500).json({ message: "Erro ao carregar pontos", error: error.message });
  }
});

// FIXED: Checkpoint creation with proper validation and error handling
app.post("/api/admin/checkpoints", auth, admin, async (req, res) => {
  try {
    console.log('Creating checkpoint with data:', req.body);
    
    const { name, location, description, latitude, longitude, active } = req.body;
    
    // Validate input data
    const validation = validateCheckpointData({ name, location, latitude, longitude });
    if (!validation.valid) {
      console.log('Validation failed:', validation.message);
      return res.status(400).json({ message: validation.message });
    }
    
    // Convert coordinates to numbers
    const lat = Number(latitude);
    const lng = Number(longitude);
    const isActive = active !== undefined ? (active ? 1 : 0) : 1;
    
    console.log('Inserting checkpoint:', { name, location, description, lat, lng, isActive });
    
    const result = await db.execute({
      sql: `INSERT INTO checkpoints (name, location, description, latitude, longitude, active) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name.trim(), location.trim(), description || '', lat, lng, isActive]
    });
    
    console.log('Checkpoint inserted, ID:', result.lastInsertRowid);
    
    const checkpoint = await db.execute({ 
      sql: "SELECT * FROM checkpoints WHERE id = ?", 
      args: [result.lastInsertRowid] 
    });
    
    if (checkpoint.rows.length === 0) {
      throw new Error('Failed to retrieve created checkpoint');
    }
    
    console.log('Checkpoint created successfully:', checkpoint.rows[0]);
    res.status(201).json(checkpoint.rows[0]);
    
  } catch (error) {
    console.error('Create checkpoint error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({ 
      message: "Erro ao criar ponto", 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.put("/api/admin/checkpoints/:id", auth, admin, async (req, res) => {
  try {
    const { name, location, description, latitude, longitude, active } = req.body;
    const id = req.params.id;
    
    // Validate input data
    const validation = validateCheckpointData({ name, location, latitude, longitude });
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }
    
    const check = await db.execute({ sql: "SELECT id FROM checkpoints WHERE id = ?", args: [id] });
    if (check.rows.length === 0) return res.status(404).json({ message: "Ponto não encontrado" });
    
    // Convert coordinates to numbers
    const lat = Number(latitude);
    const lng = Number(longitude);
    const isActive = active !== undefined ? (active ? 1 : 0) : 1;
    
    await db.execute({
      sql: `UPDATE checkpoints SET name = ?, location = ?, description = ?, latitude = ?, longitude = ?, active = ? WHERE id = ?`,
      args: [name.trim(), location.trim(), description || '', lat, lng, isActive, id]
    });
    
    const checkpoint = await db.execute({ sql: "SELECT * FROM checkpoints WHERE id = ?", args: [id] });
    res.json(checkpoint.rows[0]);
  } catch (error) {
    console.error('Update checkpoint error:', error);
    res.status(500).json({ message: "Erro ao atualizar ponto", error: error.message });
  }
});

app.delete("/api/admin/checkpoints/:id", auth, admin, async (req, res) => {
  try {
    const id = req.params.id;
    const check = await db.execute({ sql: "SELECT id FROM checkpoints WHERE id = ?", args: [id] });
    if (check.rows.length === 0) return res.status(404).json({ message: "Ponto não encontrado" });
    
    await db.execute({ sql: "DELETE FROM checkpoints WHERE id = ?", args: [id] });
    res.json({ message: "Ponto removido" });
  } catch (error) {
    console.error('Delete checkpoint error:', error);
    res.status(500).json({ message: "Erro ao remover ponto", error: error.message });
  }
});

app.get("/api/admin/checkpoints/:id/qrcode", auth, admin, async (req, res) => {
  try {
    const id = req.params.id;
    const check = await db.execute({ sql: "SELECT id FROM checkpoints WHERE id = ?", args: [id] });
    if (check.rows.length === 0) return res.status(404).json({ message: "Ponto não encontrado" });
    
    const { qrCodeUrl } = await genQR(id);
    res.json({ qrCodeUrl });
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ message: "Erro ao gerar QR", error: error.message });
  }
});

app.get("/api/admin/dashboard/stats", auth, admin, async (req, res) => {
  try {
    const users = await db.execute({ sql: "SELECT COUNT(*) as count FROM users WHERE role = 'guard' AND active = 1", args: [] });
    const checkpoints = await db.execute({ sql: "SELECT COUNT(*) as count FROM checkpoints WHERE active = 1", args: [] });
    const completed = await db.execute({ sql: "SELECT COUNT(*) as count FROM checkins WHERE DATE(timestamp) = DATE('now', 'localtime') AND status = 'success'", args: [] });
    const pending = await db.execute({ sql: `SELECT COUNT(*) as count FROM checkpoints WHERE active = 1 AND id NOT IN (SELECT DISTINCT checkpoint_id FROM checkins WHERE DATE(timestamp) = DATE('now', 'localtime'))`, args: [] });
    
    res.json({
      totalUsers: users.rows[0].count,
      totalCheckpoints: checkpoints.rows[0].count,
      completedToday: completed.rows[0].count,
      pendingToday: pending.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar stats" });
  }
});

app.get("/api/admin/dashboard/recent-checkins", auth, admin, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT c.id, c.guard_id, u.name as guard_name, c.checkpoint_id, cp.name as checkpoint_name, cp.location, c.timestamp, c.status FROM checkins c JOIN users u ON c.guard_id = u.id JOIN checkpoints cp ON c.checkpoint_id = cp.id ORDER BY c.timestamp DESC LIMIT 10`,
      args: []
    });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar checkins" });
  }
});

app.get("/api/admin/dashboard/chart-data", auth, admin, async (req, res) => {
  try {
    const hourly = await db.execute({
      sql: `SELECT strftime('%H', timestamp) as hour, COUNT(*) as count FROM checkins WHERE DATE(timestamp) = DATE('now', 'localtime') GROUP BY hour ORDER BY hour`,
      args: []
    });
    
    const data = Array.from({ length: 24 }, (_, i) => {
      const hour = i.toString().padStart(2, "0");
      const found = hourly.rows.find(row => row.hour === hour);
      return { hour, count: found ? found.count : 0 };
    });
    
    res.json({ hourlyCheckins: data });
  } catch (error) {
    res.status(500).json({ message: "Erro ao carregar dados" });
  }
});

app.get("/api/admin/reports/checkins", auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, guardId, status, search } = req.query;
    let sql = `SELECT c.id, c.guard_id, u.name as guard_name, c.checkpoint_id, cp.name as checkpoint_name, cp.location, c.timestamp, c.status, c.latitude, c.longitude FROM checkins c JOIN users u ON c.guard_id = u.id JOIN checkpoints cp ON c.checkpoint_id = cp.id WHERE 1=1`;
    const args = [];
    
    if (startDate) { sql += ` AND DATE(c.timestamp) >= DATE(?)`; args.push(startDate); }
    if (endDate) { sql += ` AND DATE(c.timestamp) <= DATE(?)`; args.push(endDate); }
    if (guardId && guardId !== "all") { sql += ` AND c.guard_id = ?`; args.push(guardId); }
    if (status && status !== "all") { sql += ` AND c.status = ?`; args.push(status); }
    if (search) { sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`; args.push(`%${search}%`, `%${search}%`); }
    sql += ` ORDER BY c.timestamp DESC`;
    
    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Erro no relatório" });
  }
});

app.get("/api/admin/reports/export", auth, admin, async (req, res) => {
  try {
    const { startDate, endDate, guardId, status, search, format } = req.query;
    let sql = `SELECT c.id, u.name as guard_name, cp.name as checkpoint_name, cp.location, c.timestamp, c.status, c.latitude, c.longitude FROM checkins c JOIN users u ON c.guard_id = u.id JOIN checkpoints cp ON c.checkpoint_id = cp.id WHERE 1=1`;
    const args = [];
    
    if (startDate) { sql += ` AND DATE(c.timestamp) >= DATE(?)`; args.push(startDate); }
    if (endDate) { sql += ` AND DATE(c.timestamp) <= DATE(?)`; args.push(endDate); }
    if (guardId && guardId !== "all") { sql += ` AND c.guard_id = ?`; args.push(guardId); }
    if (status && status !== "all") { sql += ` AND c.status = ?`; args.push(status); }
    if (search) { sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`; args.push(`%${search}%`, `%${search}%`); }
    sql += ` ORDER BY c.timestamp DESC`;
    
    const result = await db.execute({ sql, args });
    
    if (format === "csv") {
      let csv = "ID,Guarda,Ponto,Localização,Data/Hora,Status,Latitude,Longitude\n";
      result.rows.forEach(row => {
        csv += `${row.id},"${row.guard_name}","${row.checkpoint_name}","${row.location}","${row.timestamp}","${row.status}",${row.latitude || ""},${row.longitude || ""}\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=relatorio-${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } else {
      res.status(400).json({ message: "Formato não suportado" });
    }
  } catch (error) {
    res.status(500).json({ message: "Erro na exportação" });
  }
});

// Catch-all para SPAs - deve vir DEPOIS das rotas de API
app.use((req, res) => {
  // Para rotas que não são de API, serve o index.html
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: "Rota de API não encontrada" });
  }
  
  res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
});

// Middleware de erro para outros métodos HTTP
app.use((req, res) => {
  if (req.method !== 'GET') {
    res.status(404).json({ message: "Rota não encontrada" });
  }
});

(async () => {
  try {
    await initDB();
    
    let httpsServer = null;
    try {
      // Usar diretamente as variáveis de certificado configuradas
      const sslOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH)
      };
      
      console.log('Using SSL certificates from configured paths');
      
      httpsServer = https.createServer(sslOptions, app);
      httpsServer.keepAliveTimeout = 10000;
      httpsServer.headersTimeout = 11000;
      
    } catch (err) {
      console.warn('HTTPS setup failed:', err);
    }
    
    if (httpsServer) {
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS server running on port ${HTTPS_PORT}`);
      });
    }
  } catch (err) {
    console.error('Erro na inicialização do servidor:', err);
    process.exit(1);
  }
})();