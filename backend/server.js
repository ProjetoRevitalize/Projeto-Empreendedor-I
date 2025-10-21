const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializa banco de dados SQLite
const db = new sqlite3.Database('revitalize.db');

// Cria tabelas se não existirem
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      idade INTEGER NOT NULL,
      sexo TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS planos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      altura REAL NOT NULL,
      peso REAL NOT NULL,
      objetivo TEXT NOT NULL,
      trainings TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )`
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS imc_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      peso REAL NOT NULL,
      altura REAL NOT NULL,
      idade INTEGER,
      sexo TEXT,
      valor REAL NOT NULL,
      classificacao TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES usuarios(id)
    )`
  );
});

// Configuração fixa do Nodemailer com Gmail
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'projetorevitalize2025@gmail.com',  // seu e-mail
    pass: 'tqpp dzui qfnl gboe',              // senha de aplicativo do Gmail
  },
});

// Endpoint para envio de código de verificação por e-mail
app.post('/api/send-code', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ erro: 'Email e código são obrigatórios' });
  }

  const mailOptions = {
    from: 'projetorevitalize2025@gmail.com',
    to: email,
    subject: 'Seu código de verificação Revitalize',
    text: `Olá! Seu código de verificação é: ${code}`,
  };

  mailTransporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Erro ao enviar e-mail:', err);
      return res.status(500).json({ erro: 'Falha ao enviar e-mail' });
    }
    return res.json({ mensagem: 'E-mail enviado com sucesso' });
  });
});

// Armazena códigos de recuperação temporários em memória
const recoveryCodes = {};

// Rota para enviar código de recuperação
app.post('/api/request-password-reset', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ erro: 'Email é obrigatório' });

  // gera código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  recoveryCodes[email] = code;

  // envia email com código
  const mailOptions = {
    from: 'projetorevitalize2025@gmail.com',
    to: email,
    subject: 'Recuperação de senha - Revitalize',
    text: `Seu código de recuperação é: ${code}`,
  };

  mailTransporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error('Erro ao enviar e-mail:', err);
      return res.status(500).json({ erro: 'Falha ao enviar e-mail' });
    }
    return res.json({ mensagem: 'Código enviado para seu e-mail' });
  });
});

// Rota de reset de senha corrigida
app.post('/api/reset-password', async (req, res) => {
  const { email, code, novaSenha } = req.body;

  if (!email || !code || !novaSenha) {
    return res.status(400).json({ erro: 'Campos incompletos' });
  }

  // Verifica se o código fornecido é válido
  if (code !== recoveryCodes[email]) {
    return res.status(400).json({ erro: 'Código inválido' });
  }

  console.log("E-mail recebido:", email);

  // Verifica se o usuário existe na tabela "usuarios"
  const sqlCheckUser = `SELECT * FROM usuarios WHERE email = ?`;
  db.get(sqlCheckUser, [email], (err, row) => {
    if (err) {
      console.error("Erro ao verificar o usuário:", err);
      return res.status(500).json({ erro: 'Erro ao verificar usuário' });
    }

    console.log("Resultado da busca no banco:", row);

    if (!row) {
      console.log("Usuário não encontrado:", email);
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    // Se o usuário existir, atualizar a senha
    const hashed = bcrypt.hashSync(novaSenha, 10);

    const sqlUpdatePassword = `UPDATE usuarios SET senha_hash = ? WHERE email = ?`;
    db.run(sqlUpdatePassword, [hashed, email], function (err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao alterar senha' });
      }

      // Limpa o código após sucesso
      delete recoveryCodes[email];
      return res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
    });
  });
});

// Rota de cadastro
app.post('/api/register', (req, res) => {
  const { nome, idade, sexo, email, senha } = req.body;
  if (!nome || !idade || !sexo || !email || !senha) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (row) return res.status(409).json({ erro: 'E-mail já cadastrado' });
    bcrypt.hash(senha, 10, (errHash, hash) => {
      if (errHash) return res.status(500).json({ erro: errHash.message });
      db.run(
        'INSERT INTO usuarios (nome, idade, sexo, email, senha_hash) VALUES (?, ?, ?, ?, ?)',
        [nome, idade, sexo, email, hash],
        function (errIns) {
          if (errIns) return res.status(500).json({ erro: errIns.message });
          return res.status(201).json({ id: this.lastID, nome, idade, sexo, email });
        }
      );
    });
  });
});

// Rota de login
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Dados incompletos' });
  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!user) return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    bcrypt.compare(senha, user.senha_hash, (errComp, match) => {
      if (errComp) return res.status(500).json({ erro: errComp.message });
      if (!match) return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
      // remove hash da senha antes de retornar
      const { senha_hash, ...userData } = user;
      return res.json(userData);
    });
  });
});

// Lista planos de um usuário
app.get('/api/plans', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ erro: 'user_id é obrigatório' });
  db.all('SELECT * FROM planos WHERE user_id = ?', [user_id], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    // converte JSON armazenado
    const plans = rows.map((p) => ({
      ...p,
      trainings: JSON.parse(p.trainings),
      history: JSON.parse(p.history),
    }));
    return res.json(plans);
  });
});

// Cria um plano novo
app.post('/api/plans', (req, res) => {
  const { user_id, altura, peso, objetivo, trainings } = req.body;
  if (!user_id || !altura || !peso || !objetivo || !trainings) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const now = new Date().toISOString();
  db.run(
    'INSERT INTO planos (user_id, altura, peso, objetivo, trainings, history, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      user_id,
      altura,
      peso,
      objetivo,
      JSON.stringify(trainings),
      JSON.stringify([]),
      now,
      now,
    ],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      return res.status(201).json({ id: this.lastID });
    }
  );
});

// Atualiza um plano (e salva versão anterior no history)
app.put('/api/plans/:id', (req, res) => {
  const planId = req.params.id;
  const { altura, peso, objetivo, trainings } = req.body;
  db.get('SELECT * FROM planos WHERE id = ?', [planId], (err, plan) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!plan) return res.status(404).json({ erro: 'Plano não encontrado' });
    const history = JSON.parse(plan.history);
    // adiciona versão atual ao histórico
    history.push({
      altura: plan.altura,
      peso: plan.peso,
      objetivo: plan.objetivo,
      trainings: JSON.parse(plan.trainings),
      updated_at: plan.updated_at,
    });
    const now = new Date().toISOString();
    db.run(
      'UPDATE planos SET altura = ?, peso = ?, objetivo = ?, trainings = ?, history = ?, updated_at = ? WHERE id = ?',
      [
        altura || plan.altura,
        peso || plan.peso,
        objetivo || plan.objetivo,
        JSON.stringify(trainings || JSON.parse(plan.trainings)),
        JSON.stringify(history),
        now,
        planId,
      ],
      function (errUp) {
        if (errUp) return res.status(500).json({ erro: errUp.message });
        return res.json({ mensagem: 'Plano atualizado' });
      }
    );
  });
});

// Exclui um plano
app.delete('/api/plans/:id', (req, res) => {
  const planId = req.params.id;
  db.run('DELETE FROM planos WHERE id = ?', [planId], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: 'Plano não encontrado' });
    return res.json({ mensagem: 'Plano deletado' });
  });
});

// Lista histórico de IMC
app.get('/api/imc-history', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ erro: 'user_id é obrigatório' });
  db.all('SELECT * FROM imc_history WHERE user_id = ? ORDER BY date ASC', [user_id], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    return res.json(rows);
  });
});

// Adiciona um registro de IMC
app.post('/api/imc-history', (req, res) => {
  const { user_id, peso, altura, idade, sexo, valor, classificacao } = req.body;
  if (!user_id || !peso || !altura || !valor || !classificacao) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }
  const date = new Date().toISOString();
  db.run(
    'INSERT INTO imc_history (user_id, date, peso, altura, idade, sexo, valor, classificacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [user_id, date, peso, altura, idade || null, sexo || null, valor, classificacao],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      return res.status(201).json({ id: this.lastID });
    }
  );
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor Revitalize rodando na porta ${PORT}`);
});
