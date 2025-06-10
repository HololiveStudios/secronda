import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import qrcode from "qrcode";
import CryptoJS from "crypto-js";
import { fileURLToPath } from "url";
import path from "path";
import https from 'https'
import fs from 'fs'

dotenv.config();

// Constants and configuration
const app = express();
const JWT_SECRET = "secrondasjwtsecret2025";
const QR_SECRET = "secrondasqrsecret2025";
const DB_PATH = "./database.db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//app.use(express.static(path.join(__dirname, "../dist")));

const currentDir = process.cwd();
const keyPath = path.join(currentDir, 'server/key.pem');
const certPath = path.join(currentDir, 'server/cert.pem');

// Lê os arquivos do certificado e chave privada
const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

// Cache em memória simples
const cache = {
  data: {},
  set: function (key, value, ttl = 300) {
    // ttl em segundos (padrão 5 minutos)
    this.data[key] = {
      value,
      expiry: Date.now() + ttl * 1000,
    };
  },
  get: function (key) {
    const item = this.data[key];
    if (!item) return null;
    if (Date.now() > item.expiry) {
      delete this.data[key];
      return null;
    }
    return item.value;
  },
  clear: function (keyPattern) {
    if (keyPattern) {
      Object.keys(this.data).forEach((key) => {
        if (key.includes(keyPattern)) {
          delete this.data[key];
        }
      });
    } else {
      this.data = {};
    }
  },
};

// Função para limpeza periódica do cache (a cada 10 minutos)
setInterval(
  () => {
    const now = Date.now();
    Object.keys(cache.data).forEach((key) => {
      if (now > cache.data[key].expiry) {
        delete cache.data[key];
      }
    });
  },
  10 * 60 * 1000,
);

app.use(cors());
app.use(express.json());

// Conexão de banco de dados - otimizada com pool mínimo
const db = createClient({url: `file:${DB_PATH}`});

// Add this migration function to your code
async function addMissingColumns() {
  try {
    // Check current table structure
    const tableInfo = await db.execute("PRAGMA table_info(checkins)");
    const existingColumns = tableInfo.rows.map(row => row.name);
    
    // Add distance column if missing
    if (!existingColumns.includes('distance')) {
      await db.execute(`
        ALTER TABLE checkins 
        ADD COLUMN distance REAL
      `);
      console.log("Distance column added successfully");
    }
    
    // Add accuracy column if missing
    if (!existingColumns.includes('accuracy')) {
      await db.execute(`
        ALTER TABLE checkins 
        ADD COLUMN accuracy REAL
      `);
      console.log("Accuracy column added successfully");
    }
    
    console.log("All required columns are present");
  } catch (error) {
    console.error("Error adding missing columns:", error);
  }
}

// Updated initializeDatabase function
async function initializeDatabase() {
  try {
    // Your existing table creation code...
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'guard')) NOT NULL DEFAULT 'guard',
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        active BOOLEAN NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Updated checkins table with distance and accuracy columns
    await db.execute(`
      CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guard_id INTEGER NOT NULL,
        checkpoint_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT CHECK(status IN ('success', 'failed', 'offline')) NOT NULL,
        latitude REAL,
        longitude REAL,
        distance REAL,
        accuracy REAL
      )
    `);

    // Add missing columns if table already exists without them
    await addMissingColumns();

    // Your existing code for  admin/guard/checkpoint existence...
    const adminExists = await db.execute({
      sql: "SELECT * FROM users WHERE role = 'admin' LIMIT 1",
      args: [],
    });

    const guardExists = await db.execute({
      sql: "SELECT * FROM users WHERE role = 'guard' LIMIT 1",
      args: [],
    });

    const checkpointExists = await db.execute({
      sql: "SELECT * FROM checkpoints LIMIT 1",
      args: [],
    });

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}

// Authentication middleware - otimizado para tokens com maior duração
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Token inválido ou expirado" });
      }

      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ message: "Autenticação necessária" });
  }
};

// Middleware de autorização simplificado
const authorize = (roles = []) => {
  if (typeof roles === "string") {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user || (roles.length && !roles.includes(req.user.role))) {
      return res.status(403).json({ message: "Acesso proibido" });
    }
    next();
  };
};

// QR Code geração e validação otimizadas
const generateQRCode = async (checkpointId) => {
  try {
    // Criar chave de cache
    const cacheKey = `qr_${checkpointId}`;
    const cachedQr = cache.get(cacheKey);

    // Se estiver em cache, retorne imediatamente
    if (cachedQr) {
      return cachedQr;
    }

    // Criar payload - simplificado
    const payload = {
      checkpointId,
      timestamp: Date.now(),
    };

    // Criptografia mais leve (menos rounds)
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(payload),
      QR_SECRET,
    ).toString();

    // Gerar QR code com menor qualidade para economizar processamento
    const qrCodeDataUrl = await qrcode.toDataURL(encrypted, {
      errorCorrectionLevel: "L", // menor nível de correção de erros (L, M, Q, H)
      scale: 4, // tamanho reduzido (padrão é 4)
      margin: 1, // margem reduzida (padrão é 4)
    });

    const result = { qrCodeUrl: qrCodeDataUrl, encrypted };

    // Guardar em cache por 1 hora (3600 segundos)
    cache.set(cacheKey, result, 3600);

    return result;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
};

const validateQRCode = (encryptedData) => {
  try {
    // Descriptografar
    const bytes = CryptoJS.AES.decrypt(encryptedData, QR_SECRET);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

    // Verificar expiração - aumentado para 48 horas para reduzir renovações
    const now = Date.now();
    const qrTimestamp = decryptedData.timestamp;
    const isExpired = now - qrTimestamp > 48 * 60 * 60 * 1000;

    if (isExpired) {
      return { valid: false, message: "QR code expirado" };
    }

    return { valid: true, checkpointId: decryptedData.checkpointId };
  } catch (error) {
    console.error("Error validating QR code:", error);
    return { valid: false, message: "QR code inválido" };
  }
};

// Auth routes - aumentado tempo de expiração do token
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE email = ? AND active = 1",
      args: [email],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Email ou senha inválidos" });
    }

    const user = result.rows[0];

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Email ou senha inválidos" });
    }

    // Generate JWT token - aumentada expiração para 7 dias
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }, // Aumentado de 24h para 7d para reduzir reautenticações
    );

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// User profile routes - otimizada hash do bcrypt
app.put("/api/user/profile", authenticateJWT, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user data
    const userResult = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userId],
    });

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Senha atual incorreta" });
    }

    // Update user data
    if (newPassword) {
      // Hash com fator reduzido para economizar CPU
      const hashedPassword = await bcrypt.hash(newPassword, 6);
      await db.execute({
        sql: "UPDATE users SET name = ?, password = ? WHERE id = ?",
        args: [name, hashedPassword, userId],
      });
    } else {
      // Update only name
      await db.execute({
        sql: "UPDATE users SET name = ? WHERE id = ?",
        args: [name, userId],
      });
    }

    res.json({ message: "Perfil atualizado com sucesso" });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
});

// Cache simples para armazenar último update
let lastUpdateTime = new Date();

// Função para atualizar o timestamp quando há mudanças
function updateLastModified() {
  lastUpdateTime = new Date();
}

app.get('/api/guard/checkpoints/status', authenticateJWT, async (req, res) => {
  try {
    res.set('Last-Modified', lastUpdateTime.toUTCString());
    res.json({
      lastUpdate: lastUpdateTime.toISOString(),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Guard routes - com cache
app.get("/api/guard/checkpoints", authenticateJWT, async (req, res) => {
  try {
    const cacheKey = `checkpoints_${req.user.id}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Consulta simplificada - menos JOIN
    const result = await db.execute({
      sql: `
        SELECT 
          c.id, 
          c.name, 
          c.location,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM checkins 
              WHERE checkpoint_id = c.id 
              AND guard_id = ? 
              AND DATE(timestamp) = DATE('now', 'localtime')
            ) THEN 'completed'
            ELSE 'pending'
          END as status,
          c.latitude,
          c.longitude
        FROM checkpoints c
        WHERE c.active = 1
        ORDER BY c.name
      `,
      args: [req.user.id],
    });

    // Armazenar em cache por 5 minutos
    cache.set(cacheKey, result.rows, 300);

    res.json(result.rows);
  } catch (error) {
    console.error("Error getting guard checkpoints:", error);
    res.status(500).json({ message: "Erro ao carregar pontos de verificação" });
  }
});

app.get("/api/guard/checkins/recent", authenticateJWT, async (req, res) => {
  try {
    const cacheKey = `recent_checkins_${req.user.id}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const result = await db.execute({
      sql: `
        SELECT 
          c.id,
          c.timestamp,
          c.status,
          cp.name as checkpoint_name,
          cp.location
        FROM checkins c
        JOIN checkpoints cp ON c.checkpoint_id = cp.id
        WHERE c.guard_id = ? AND DATE(c.timestamp) = DATE('now', 'localtime')
        ORDER BY c.timestamp DESC
        LIMIT 10
      `,
      args: [req.user.id],
    });

    // Cache por 1 minuto
    cache.set(cacheKey, result.rows, 60);

    res.json(result.rows);
  } catch (error) {
    console.error("Error getting recent checkins:", error);
    res.status(500).json({ message: "Erro ao carregar registros recentes" });
  }
});

app.get("/api/guard/checkins", authenticateJWT, async (req, res) => {
  try {
    const { date, status, search } = req.query;

    // Construir chave de cache baseada nos parâmetros
    const cacheKey = `checkins_${req.user.id}_${date || "all"}_${status || "all"}_${search || "none"}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    let sql = `
      SELECT 
        c.id,
        c.timestamp,
        c.status,
        c.checkpoint_id,
        cp.name as checkpoint_name,
        cp.location
      FROM checkins c
      JOIN checkpoints cp ON c.checkpoint_id = cp.id
      WHERE c.guard_id = ?
    `;

    const args = [req.user.id];

    // Add filters
    if (date) {
      sql += ` AND DATE(c.timestamp) = DATE(?)`;
      args.push(date);
    }

    if (status && status !== "all") {
      sql += ` AND c.status = ?`;
      args.push(status);
    }

    if (search) {
      sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`;
      args.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY c.timestamp DESC`;

    const result = await db.execute({
      sql,
      args,
    });

    // Cache por 5 minutos
    cache.set(cacheKey, result.rows, 300);

    res.json(result.rows);
  } catch (error) {
    console.error("Error getting checkins history:", error);
    res
      .status(500)
      .json({ message: "Erro ao carregar histórico de verificações" });
  }
});

// Função para calcular distância precisa (Haversine) - adicionar ao backend
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Distância em metros
  return distance;
};

app.post("/api/checkin", authenticateJWT, async (req, res) => {
  try {
    const { qrData, location, locationAccuracy, distance } = req.body;
    const guardId = req.user.id;

    // Validate QR code
    const validationResult = validateQRCode(qrData);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
      });
    }

    const checkpointId = validationResult.checkpointId;

    // Verify if checkpoint exists and is active - usando cache
    const cacheKey = `checkpoint_${checkpointId}`;
    let checkpoint = cache.get(cacheKey);

    if (!checkpoint) {
      const checkpointResult = await db.execute({
        sql: "SELECT * FROM checkpoints WHERE id = ? AND active = 1",
        args: [checkpointId],
      });

      if (checkpointResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ponto de verificação não encontrado ou inativo",
        });
      }

      checkpoint = checkpointResult.rows[0];
      // Cache por 1 hora
      cache.set(cacheKey, checkpoint, 3600);
    }

    // Raio permitido base (em metros)
    const ALLOWED_RADIUS = 100;
    let status = "success";
    let calculatedDistance = null;
    let effectiveRadius = ALLOWED_RADIUS;

    // Verificação de localização usando a mesma lógica do frontend
    if (location && checkpoint.latitude && checkpoint.longitude) {
      const { lat, lng } = location;

      // Calcular distância precisa usando Haversine
      calculatedDistance = calculateDistance(
        lat, 
        lng, 
        checkpoint.latitude, 
        checkpoint.longitude
      );

      // Considerar a precisão do GPS (com limite máximo razoável)
      const maxAccuracyOffset = 500; // Máximo 500m de offset por imprecisão
      const accuracyOffset = locationAccuracy ? Math.min(locationAccuracy, maxAccuracyOffset) : 0;
      effectiveRadius = ALLOWED_RADIUS + accuracyOffset;

      // Verificar se está dentro do raio permitido
      if (calculatedDistance > effectiveRadius) {
        status = "failed";
      }
    } else if (location) {
      // Se temos localização do usuário mas não do checkpoint
      status = "warning";
    }

    // Record the checkin
    const checkinResult = await db.execute({
      sql: `
        INSERT INTO checkins (
          guard_id, checkpoint_id, status, latitude, longitude, distance, accuracy
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        guardId,
        checkpointId,
        status,
        location ? location.lat : null,
        location ? location.lng : null,
        calculatedDistance,
        locationAccuracy || null,
      ],
    });

    // ===== NOVA PARTE: Atualizar timestamp após checkin bem-sucedido =====
    if (status === "success") {
      updateLastModified();
      
      // Limpar cache relacionado a este usuário
      if (cache && cache.delete) {
        delete cache.data[`checkpoints_${guardId}`];
        delete cache.data[`recent_checkins_${guardId}`];
      }
    }

    // Preparar resposta baseada no status
    let message;
    switch (status) {
      case "success":
        message = calculatedDistance !== null 
          ? `Ponto verificado com sucesso! Distância: ${calculatedDistance.toFixed(0)}m`
          : "Ponto verificado com sucesso!";
        break;
      case "failed":
        message = `Você está muito distante do ponto de controle. Distância: ${calculatedDistance.toFixed(0)}m (máximo permitido: ${effectiveRadius.toFixed(0)}m)`;
        break;
      case "warning":
        message = "Verificação registrada, mas não foi possível validar a localização completamente.";
        break;
      default:
        message = "Verificação registrada.";
    }

    res.json({
      success: status !== "failed",
      message,
      checkpoint: {
        id: checkpoint.id,
        name: checkpoint.name,
        location: checkpoint.location || checkpoint.description,
        description: checkpoint.description
      },
      distance: calculatedDistance,
      effectiveRadius,
      status,
      timestamp: lastUpdateTime.toISOString() // Adicionar timestamp na resposta
    });

  } catch (error) {
    console.error("Error during checkin:", error);
    res.status(500).json({ 
      success: false, 
      message: "Erro ao processar verificação" 
    });
  }
});

// Add this endpoint to your backend server
app.get("/api/checkpoints/info", authenticateJWT, async (req, res) => {
  try {
    const { qrData } = req.query;
    
    if (!qrData) {
      return res.status(400).json({
        success: false,
        message: "QR data is required"
      });
    }

    // Validate QR code
    const validationResult = validateQRCode(qrData);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message,
      });
    }

    const checkpointId = validationResult.checkpointId;

    // Get checkpoint info - using cache
    const cacheKey = `checkpoint_${checkpointId}`;
    let checkpoint = cache.get(cacheKey);

    if (!checkpoint) {
      const checkpointResult = await db.execute({
        sql: "SELECT * FROM checkpoints WHERE id = ? AND active = 1",
        args: [checkpointId],
      });

      if (checkpointResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ponto de verificação não encontrado ou inativo",
        });
      }

      checkpoint = checkpointResult.rows[0];
      // Cache por 1 hora
      cache.set(cacheKey, checkpoint, 3600);
    }

    // Return checkpoint info with location
    res.json({
      success: true,
      checkpoint: {
        id: checkpoint.id,
        name: checkpoint.name,
        location: {
          lat: checkpoint.latitude,
          lng: checkpoint.longitude
        },
        description: checkpoint.description || checkpoint.location
      }
    });

  } catch (error) {
    console.error("Error getting checkpoint info:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao obter informações do ponto de verificação"
    });
  }
});

// Rotas de admin com cache
app.get(
  "/api/admin/users",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const cacheKey = "admin_users";
      const cachedData = cache.get(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      const result = await db.execute({
        sql: "SELECT id, name, email, role, active, created_at FROM users ORDER BY name",
        args: [],
      });

      // Cache por 5 minutos
      cache.set(cacheKey, result.rows, 300);

      res.json(result.rows);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Erro ao carregar usuários" });
    }
  },
);

// Criação de usuário com hash otimizado
app.post(
  "/api/admin/users",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const { name, email, password, role, active } = req.body;

      // Check if email already exists
      const emailCheck = await db.execute({
        sql: "SELECT id FROM users WHERE email = ?",
        args: [email],
      });

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Hash password com fator de custo reduzido
      const hashedPassword = await bcrypt.hash(password, 6);

      // Create user
      const result = await db.execute({
        sql: "INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, ?, ?)",
        args: [name, email, hashedPassword, role, active ? 1 : 0],
      });

      // Get created user
      const userId = result.lastInsertRowid;
      const userResult = await db.execute({
        sql: "SELECT id, name, email, role, active, created_at FROM users WHERE id = ?",
        args: [userId],
      });

      // Limpar cache de usuários
      cache.clear("admin_users");

      res.status(201).json(userResult.rows[0]);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  },
);

app.put(
  "/api/admin/users/:id",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { name, email, password, role, active } = req.body;

      // Check if user exists
      const userCheck = await db.execute({
        sql: "SELECT id FROM users WHERE id = ?",
        args: [userId],
      });

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Check if email is already in use by another user
      if (email) {
        const emailCheck = await db.execute({
          sql: "SELECT id FROM users WHERE email = ? AND id != ?",
          args: [email, userId],
        });

        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      // Update user com hash de custo reduzido
      let sql, args;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 6);
        sql =
          "UPDATE users SET name = ?, email = ?, password = ?, role = ?, active = ? WHERE id = ?";
        args = [name, email, hashedPassword, role, active ? 1 : 0, userId];
      } else {
        sql =
          "UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?";
        args = [name, email, role, active ? 1 : 0, userId];
      }

      await db.execute({ sql, args });

      // Get updated user
      const userResult = await db.execute({
        sql: "SELECT id, name, email, role, active, created_at FROM users WHERE id = ?",
        args: [userId],
      });

      // Limpar cache de usuários
      cache.clear("admin_users");

      res.json(userResult.rows[0]);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  },
);

app.delete(
  "/api/admin/users/:id",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Check if user exists
      const userCheck = await db.execute({
        sql: "SELECT id FROM users WHERE id = ?",
        args: [userId],
      });

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Don't allow deleting yourself
      if (parseInt(userId) === req.user.id) {
        return res
          .status(400)
          .json({ message: "Não é possível excluir o usuário atual" });
      }

      // Delete user
      await db.execute({
        sql: "DELETE FROM users WHERE id = ?",
        args: [userId],
      });

      res.json({ message: "Usuário removido com sucesso" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Erro ao remover usuário" });
    }
  },
);

app.get(
  "/api/admin/checkpoints",
  authenticateJWT,
  authorize(["admin", "guard"]),
  async (req, res) => {
    try {
      const result = await db.execute({
        sql: "SELECT * FROM checkpoints ORDER BY name",
        args: [],
      });

      // Adicionar o timestamp na resposta
      res.set('Last-Modified', lastUpdateTime.toUTCString());
      res.json({
        checkpoints: result.rows,
        lastUpdate: lastUpdateTime.toISOString(),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error getting checkpoints:", error);
      res
        .status(500)
        .json({ message: "Erro ao carregar pontos de verificação" });
    }
  },
);

app.post('/api/admin/checkpoints', authenticateJWT, authorize(["admin"]), async (req, res) => {
  try {
    const { name, description, latitude, longitude, location } = req.body;
    
    const result = await db.execute({
      sql: `INSERT INTO checkpoints (name, location, description, latitude, longitude, active) 
            VALUES (?, ?, ?, ?, ?, 1)`,
      args: [name, location, description, latitude, longitude]
    });
    
    // Atualizar timestamp após criar checkpoint
    updateLastModified();
    
    // Limpar cache relacionado
    if (cache && cache.clear) {
      // Limpar todos os caches de checkpoint
      const keys = Object.keys(cache.data);
      keys.forEach(key => {
        if (key.startsWith('checkpoint_') || key.startsWith('checkpoints_')) {
          cache.delete(key);
        }
      });
    }
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: 'Checkpoint criado com sucesso',
      timestamp: lastUpdateTime.toISOString()
    });
  } catch (error) {
    console.error('Error creating checkpoint:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/admin/checkpoints/:id', authenticateJWT, authorize(["admin"]), async (req, res) => {
  try {
    const checkpointId = req.params.id;
    const { name, description, latitude, longitude, location, active } = req.body;
    
    await db.execute({
      sql: `UPDATE checkpoints 
            SET name = ?, location = ?, description = ?, latitude = ?, longitude = ?, active = ?
            WHERE id = ?`,
      args: [name, location, description, latitude, longitude, active, checkpointId]
    });
    
    // Atualizar timestamp após atualizar checkpoint
    updateLastModified();
    
    // Limpar cache específico do checkpoint
    if (cache && cache.delete) {
      cache.delete(`checkpoint_${checkpointId}`);
      // Limpar cache de listagens
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith('checkpoints_')) {
          cache.delete(key);
        }
      });
    }
    
    res.json({ 
      success: true,
      message: 'Checkpoint atualizado com sucesso',
      timestamp: lastUpdateTime.toISOString()
    });
  } catch (error) {
    console.error('Error updating checkpoint:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/admin/checkpoints/:id', authenticateJWT, authorize(["admin"]), async (req, res) => {
  try {
    const checkpointId = req.params.id;
    
    // Usar soft delete em vez de hard delete
    await db.execute({
      sql: "UPDATE checkpoints SET active = 0 WHERE id = ?",
      args: [checkpointId]
    });
    
    // Atualizar timestamp após deletar checkpoint
    updateLastModified();
    
    // Limpar cache específico do checkpoint
    if (cache && cache.delete) {
      cache.delete(`checkpoint_${checkpointId}`);
      // Limpar cache de listagens
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith('checkpoints_')) {
          cache.delete(key);
        }
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Checkpoint desativado com sucesso',
      timestamp: lastUpdateTime.toISOString()
    });
  } catch (error) {
    console.error('Error deleting checkpoint:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.patch('/api/admin/checkpoints/:id/activate', authenticateJWT, authorize(["admin"]), async (req, res) => {
  try {
    const checkpointId = req.params.id;
    
    await db.execute({
      sql: "UPDATE checkpoints SET active = 1 WHERE id = ?",
      args: [checkpointId]
    });
    
    // Atualizar timestamp
    updateLastModified();
    
    // Limpar cache
    if (cache && cache.delete) {
      cache.delete(`checkpoint_${checkpointId}`);
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith('checkpoints_')) {
          cache.delete(key);
        }
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Checkpoint reativado com sucesso',
      timestamp: lastUpdateTime.toISOString()
    });
  } catch (error) {
    console.error('Error activating checkpoint:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get(
  "/api/admin/checkpoints/:id/qrcode",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const checkpointId = req.params.id;

      // Check if checkpoint exists
      const checkpointCheck = await db.execute({
        sql: "SELECT id FROM checkpoints WHERE id = ?",
        args: [checkpointId],
      });

      if (checkpointCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ message: "Ponto de verificação não encontrado" });
      }

      // Generate QR code
      const { qrCodeUrl } = await generateQRCode(checkpointId);

      res.json({ qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Erro ao gerar QR code" });
    }
  },
);

// Dashboard and reports routes
app.get(
  "/api/admin/dashboard/stats",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      // Get total users
      const usersResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM users WHERE role = 'guard' AND active = 1",
        args: [],
      });

      // Get total checkpoints
      const checkpointsResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM checkpoints WHERE active = 1",
        args: [],
      });

      // Get completed checks today
      const completedResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM checkins WHERE DATE(timestamp) = DATE('now', 'localtime') AND status = 'success'",
        args: [],
      });

      // Get actually pending checks - CORREÇÃO AQUI!
      // Ao invés de calcular totalPoints * totalUsers, vamos contar os pontos que deveriam ser verificados hoje
      const pendingResult = await db.execute({
        sql: `
        SELECT COUNT(*) as count 
        FROM checkpoints 
        WHERE active = 1 
        AND id NOT IN (
          SELECT DISTINCT checkpoint_id 
          FROM checkins 
          WHERE DATE(timestamp) = DATE('now', 'localtime')
        )`,
        args: [],
      });

      res.json({
        totalUsers: usersResult.rows[0].count,
        totalCheckpoints: checkpointsResult.rows[0].count,
        completedToday: completedResult.rows[0].count,
        pendingToday: pendingResult.rows[0].count, // Usar o valor real de pontos pendentes
      });
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ message: "Erro ao carregar estatísticas" });
    }
  },
);

app.get(
  "/api/admin/dashboard/recent-checkins",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      // Get recent checkins
      const result = await db.execute({
        sql: `
        SELECT 
          c.id,
          c.guard_id,
          u.name as guard_name,
          c.checkpoint_id,
          cp.name as checkpoint_name,
          cp.location,
          c.timestamp,
          c.status
        FROM checkins c
        JOIN users u ON c.guard_id = u.id
        JOIN checkpoints cp ON c.checkpoint_id = cp.id
        ORDER BY c.timestamp DESC
        LIMIT 10
      `,
        args: [],
      });

      res.json(result.rows);
    } catch (error) {
      console.error("Error getting recent checkins:", error);
      res.status(500).json({ message: "Erro ao carregar registros recentes" });
    }
  },
);

app.get(
  "/api/admin/dashboard/chart-data",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      // Get checkins by hour for today
      const hourlyResult = await db.execute({
        sql: `
        SELECT 
          strftime('%H', timestamp) as hour,
          COUNT(*) as count
        FROM checkins
        WHERE DATE(timestamp) = DATE('now', 'localtime')
        GROUP BY hour
        ORDER BY hour
      `,
        args: [],
      });

      // Fill in missing hours
      const hourlyData = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, "0");
        const found = hourlyResult.rows.find((row) => row.hour === hour);
        return {
          hour,
          count: found ? found.count : 0,
        };
      });

      res.json({
        hourlyCheckins: hourlyData,
      });
    } catch (error) {
      console.error("Error getting chart data:", error);
      res.status(500).json({ message: "Erro ao carregar dados para gráficos" });
    }
  },
);

app.get(
  "/api/admin/reports/checkins",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const { startDate, endDate, guardId, status, search } = req.query;

      let sql = `
      SELECT 
        c.id,
        c.guard_id,
        u.name as guard_name,
        c.checkpoint_id,
        cp.name as checkpoint_name,
        cp.location,
        c.timestamp,
        c.status,
        c.latitude,
        c.longitude
      FROM checkins c
      JOIN users u ON c.guard_id = u.id
      JOIN checkpoints cp ON c.checkpoint_id = cp.id
      WHERE 1=1
    `;

      const args = [];

      // Add filters
      if (startDate) {
        sql += ` AND DATE(c.timestamp) >= DATE(?)`;
        args.push(startDate);
      }

      if (endDate) {
        sql += ` AND DATE(c.timestamp) <= DATE(?)`;
        args.push(endDate);
      }

      if (guardId && guardId !== "all") {
        sql += ` AND c.guard_id = ?`;
        args.push(guardId);
      }

      if (status && status !== "all") {
        sql += ` AND c.status = ?`;
        args.push(status);
      }

      if (search) {
        sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`;
        args.push(`%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY c.timestamp DESC`;

      const result = await db.execute({
        sql,
        args,
      });

      res.json(result.rows);
    } catch (error) {
      console.error("Error getting checkins report:", error);
      res.status(500).json({ message: "Erro ao carregar relatório" });
    }
  },
);

app.get(
  "/api/admin/reports/export",
  authenticateJWT,
  authorize("admin"),
  async (req, res) => {
    try {
      const { startDate, endDate, guardId, status, search, format } = req.query;

      let sql = `
      SELECT 
        c.id,
        u.name as guard_name,
        cp.name as checkpoint_name,
        cp.location,
        c.timestamp,
        c.status,
        c.latitude,
        c.longitude
      FROM checkins c
      JOIN users u ON c.guard_id = u.id
      JOIN checkpoints cp ON c.checkpoint_id = cp.id
      WHERE 1=1
    `;

      const args = [];

      // Add filters
      if (startDate) {
        sql += ` AND DATE(c.timestamp) >= DATE(?)`;
        args.push(startDate);
      }

      if (endDate) {
        sql += ` AND DATE(c.timestamp) <= DATE(?)`;
        args.push(endDate);
      }

      if (guardId && guardId !== "all") {
        sql += ` AND c.guard_id = ?`;
        args.push(guardId);
      }

      if (status && status !== "all") {
        sql += ` AND c.status = ?`;
        args.push(status);
      }

      if (search) {
        sql += ` AND (cp.name LIKE ? OR cp.location LIKE ?)`;
        args.push(`%${search}%`, `%${search}%`);
      }

      sql += ` ORDER BY c.timestamp DESC`;

      const result = await db.execute({
        sql,
        args,
      });

      if (format === "csv") {
        // Generate CSV
        let csv =
          "ID,Guarda,Ponto,Localização,Data/Hora,Status,Latitude,Longitude\n";

        result.rows.forEach((row) => {
          csv += `${row.id},"${row.guard_name}","${row.checkpoint_name}","${row.location}","${row.timestamp}","${row.status}",${row.latitude || ""},${row.longitude || ""}\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=relatorio-${new Date().toISOString().split("T")[0]}.csv`,
        );
        res.send(csv);
      } else if (format === "pdf") {
        // For PDF, we'd normally use a library like PDFKit,
        // but for this demo we'll just return a simple text file
        // that says it's a PDF report
        const pdfText = `
        RELATÓRIO DE VERIFICAÇÕES
        --------------------------
        Data: ${new Date().toLocaleDateString("pt-BR")}
        Total de registros: ${result.rows.length}
        
        ${result.rows
          .map(
            (row) => `
          ID: ${row.id}
          Guarda: ${row.guard_name}
          Ponto: ${row.checkpoint_name}
          Localização: ${row.location}
          Data/Hora: ${new Date(row.timestamp).toLocaleString("pt-BR")}
          Status: ${row.status}
          Coordenadas: ${row.latitude || "?"}, ${row.longitude || "?"}
          --------------------------
        `,
          )
          .join("\n")}
      `;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=relatorio-${new Date().toISOString().split("T")[0]}.pdf`,
        );
        res.send(pdfText);
      } else {
        res.status(400).json({ message: "Formato não suportado" });
      }
    } catch (error) {
      console.error("Error exporting report:", error);
      res.status(500).json({ message: "Erro ao exportar relatório" });
    }
  },
);

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});

(async () => {
  try {
    await initializeDatabase();

    global.gc && global.gc();

    const server = https.createServer(options, app);

    server.listen(443, '0.0.0.0', () => {
      console.log('Servidor HTTPS rodando na porta 443');
    });
    server.keepAliveTimeout = 10000;
    server.headersTimeout = 11000;
  } catch (error) {
    console.error("Failed to start server:", error);
  }
})();

