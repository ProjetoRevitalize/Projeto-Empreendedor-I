/*-------------------Unidade 1-------------------*/

document.addEventListener('DOMContentLoaded', () => {

  const USE_API = false;
  const API_BASE = 'http://localhost:50000/api';

  async function apiRequest(path, method = 'GET', data) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(`${API_BASE}${path}`, options);
    const contentType = response.headers.get('content-type') || '';
    let payload = null;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
    if (!response.ok) {
      throw new Error(payload.erro || payload || 'Erro na requisição');
    }
    return payload;
  }

  async function apiRegisterUser(user) {
    return apiRequest('/register', 'POST', user);
  }
  async function apiLoginUser(email, senha) {
    return apiRequest('/login', 'POST', { email, senha });
  }
  async function apiGetPlans(userId) {
    return apiRequest(`/plans?user_id=${encodeURIComponent(userId)}`, 'GET');
  }
  async function apiCreatePlan(plan) {
    return apiRequest('/plans', 'POST', plan);
  }
  async function apiUpdatePlan(planId, plan) {
    return apiRequest(`/plans/${planId}`, 'PUT', plan);
  }
  async function apiDeletePlan(planId) {
    return apiRequest(`/plans/${planId}`, 'DELETE');
  }
  async function apiGetImcHistory(userId) {
    return apiRequest(`/imc-history?user_id=${encodeURIComponent(userId)}`, 'GET');
  }
  async function apiAddImcEntry(entry) {
    return apiRequest('/imc-history', 'POST', entry);
  }

  async function apiSendCode(email, code) {
    return apiRequest('/send-code', 'POST', { email, code });
  }
  let pendingRegistrationUser = null;
  let verificationMode = null;
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem('revitalizeUsers')) || [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem('revitalizeUsers', JSON.stringify(users));
  }

  /* Cadastro de usuários */
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const ageInput = document.getElementById('age').value.trim();
      const genderInput = document.querySelector('input[name="gender"]:checked');
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const errorEl = document.getElementById('registerError');
      errorEl.textContent = '';

      const nameRegex = /^[A-Za-zÀ-ÿ ]+$/;
      if (!nameRegex.test(name)) {
        errorEl.textContent = 'No campo “Nome” utilize apenas caracteres alfabéticos e espaços.';
        return;
      }

      const ageNumber = parseInt(ageInput, 10);
      if (!ageInput || isNaN(ageNumber) || ageNumber <= 0 || /[^0-9]/.test(ageInput)) {
        errorEl.textContent = 'No campo “Idade” utilize apenas caracteres numéricos inteiros.';
        return;
      }

      if (!genderInput) {
        errorEl.textContent = 'Selecione uma opção de gênero.';
        return;
      }

      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(email)) {
        errorEl.textContent = 'No campo “E-mail” há caracteres inválidos.';
        return;
      }

      const users = getUsers();
      const emailExists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        errorEl.textContent = 'E-mail informado já está cadastrado em nosso banco de dados.';
        return;
      }

      const errors = [];
      if (password.length < 8
        || password.length > 16
        || !/[a-z]/.test(password)
        || !/[A-Z]/.test(password)
        || !/[0-9]/.test(password)
        || !/[^A-Za-z0-9]/.test(password)
      ) {
        errors.push("A senha não atende aos requisitos.");
      }
      if (password.length < 8 || password.length > 16) {
        errors.push("A senha deve ter entre 8 e 16 caracteres.");
      }
      if (!/[a-z]/.test(password)) {
        errors.push("A senha deve conter pelo menos uma letra minúscula.");
      }
      if (!/[A-Z]/.test(password)) {
        errors.push("A senha deve conter pelo menos uma letra maiúscula.");
      }
      if (!/[0-9]/.test(password)) {
        errors.push("A senha deve conter pelo menos um número.");
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push("A senha deve conter pelo menos um caractere especial.");
      }
      if (errors.length > 0) {
        errorEl.textContent = errors.join("\n");
        return;
      }
      errorEl.textContent = "";

      if (password !== confirmPassword) {
        errorEl.textContent = 'As senhas informadas não coincidem.';
        return;
      }

      const newUser = {
        nome: name,
        idade: ageNumber,
        sexo: genderInput.value,
        email,
        senha: password,
      };

      pendingRegistrationUser = newUser;
      verificationMode = 'register';

      const regCode = Math.floor(1000 + Math.random() * 9000).toString();
      sessionStorage.setItem('twoFactorCode', regCode);
      // Envia o código por e‑mail se estivermos usando API
      if (USE_API) {
        apiSendCode(newUser.email, regCode).catch((err) => {
          console.error('Falha ao enviar código de cadastro por e‑mail:', err.message);
        });
      } else {
        // Exibe o código em um alerta para simular envio
        alert('Código de verificação (simulação de envio por e-mail): ' + regCode);
      }
      // Atualiza título e subtítulo do modal para contexto de cadastro
      const titleEl = document.getElementById('twoFactorTitle');
      const subtitleEl = document.getElementById('twoFactorSubtitle');
      if (titleEl) titleEl.textContent = 'Confirme seu cadastro';
      if (subtitleEl)
        subtitleEl.textContent =
          'Enviamos um código para o seu e‑mail. Insira abaixo para confirmar o cadastro:';
      // Exibe o modal de verificação
      const modal = document.getElementById('twoFactorModal');
      if (modal) {
        modal.style.display = 'flex';
      }
    });
  }

  /* Verificação do código de autenticação de dois fatores */
  const verifyRegisgterButton = document.getElementById('verifyRegisgterButton');
  if (verifyRegisgterButton) {
    verifyRegisgterButton.addEventListener('click', () => {
      // Se estivermos no fluxo de cadastro (verificationMode === 'register'), valida o código e conclui o cadastro.
      const enteredCode = document.getElementById('twoFactorCode').value.trim();
      const storedCode = sessionStorage.getItem('twoFactorCode');
      const errorEl = document.getElementById('twoFactorError');
      // Verifica se há um código salvo
      if (verificationMode === 'register' && pendingRegistrationUser) {
        if (!storedCode) {
          if (errorEl) errorEl.textContent = 'Erro interno. Por favor, tente novamente.';
          return;
        }
        if (enteredCode === storedCode) {
          // Código correto: conclui cadastro
          sessionStorage.removeItem('twoFactorCode');
          const userObj = pendingRegistrationUser;
          pendingRegistrationUser = null;
          verificationMode = null;
          if (USE_API) {
            apiRegisterUser(userObj)
              .then(() => {
                alert('Cadastro confirmado com sucesso! Faça login para continuar.');
                // Fecha o modal e redireciona para a tela de login
                const modal = document.getElementById('twoFactorModal');
                if (modal) modal.style.display = 'none';
                window.location.href = 'index.html';
              })
              .catch((err) => {
                if (errorEl) errorEl.textContent = err.message;
              });
          } else {
            // Salva em localStorage usando propriedades consistentes com o login
            const users = getUsers();
            users.push({
              name: userObj.nome,
              age: userObj.idade,
              gender: userObj.sexo,
              email: userObj.email,
              password: userObj.senha,
            });
            saveUsers(users);
            alert('Cadastro confirmado com sucesso! Faça login para continuar.');
            const modal = document.getElementById('twoFactorModal');
            if (modal) modal.style.display = 'none';
            window.location.href = 'index.html';
          }
        } else {
          if (errorEl) errorEl.textContent = 'Código inválido. Por favor, tente novamente.';
        }
      } else {
        // Caso contrário, atua como "Cancelar": limpa estados e fecha o modal
        sessionStorage.removeItem('twoFactorCode');
        verificationMode = null;
        pendingRegistrationUser = null;
        if (errorEl) errorEl.textContent = '';
        const modal = document.getElementById('twoFactorModal');
        if (modal) modal.style.display = 'none';
        // O usuário permanece na página atual
      }
    });
  }




  /*-------------------Unidade 2-------------------*/

  /* Login de usuários */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errorEl = document.getElementById('loginError');
      errorEl.textContent = '';
      // Autentica via API ou localStorage
      function proceedToTwoFactor(userObj) {
        // Armazena usuário para saudação após login
        sessionStorage.setItem('currentUser', JSON.stringify(userObj));
        // Define contexto de verificação para login e limpa qualquer cadastro pendente
        verificationMode = 'login';
        pendingRegistrationUser = null;
        // Gera um código de 4 dígitos (1000-9999) para verificação
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        sessionStorage.setItem('twoFactorCode', code);
        // Se estivermos usando API, envia o código por e-mail ao usuário
        if (USE_API) {
          apiSendCode(userObj.email, code).catch((err) => {
            console.error('Falha ao enviar código por e-mail:', err.message);
          });
        } else {
          // Fallback: exibe o código em um alerta para simular envio
          alert('Código de verificação (simulação de envio por e-mail): ' + code);
        }
        // Atualiza título e subtítulo do modal para contexto de login
        const titleEl = document.getElementById('twoFactorTitle');
        const subtitleEl = document.getElementById('twoFactorSubtitle');
        if (titleEl) titleEl.textContent = 'Verificação em 2 passos';
        if (subtitleEl) subtitleEl.textContent = 'Código enviado para o seu e‑mail. Insira abaixo:';
        // Exibe o modal de verificação
        const modal = document.getElementById('twoFactorModal');
        if (modal) {
          modal.style.display = 'flex';
        }
      }
      if (USE_API) {
        apiLoginUser(email, password)
          .then((userObj) => {
            proceedToTwoFactor(userObj);
          })
          .catch((err) => {
            errorEl.textContent = err.message;
            setTimeout(() => {
              errorEl.textContent = '';
            }, 3000);
          });
      } else {
        const users = getUsers();
        const user = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        if (!user) {
          errorEl.textContent = 'E-mail ou senha incorretos.';
          setTimeout(() => {
            errorEl.textContent = '';
          }, 3000);
          return;
        }
        proceedToTwoFactor(user);
      }
    });
  }

  /* Verificação do código de autenticação de dois fatores */
  const verifyLoginButton = document.getElementById('verifyLoginButton');
  if (verifyLoginButton) {
    verifyLoginButton.addEventListener('click', () => {
      const enteredCode = document.getElementById('twoFactorCode').value.trim();
      const storedCode = sessionStorage.getItem('twoFactorCode');
      const errorEl = document.getElementById('twoFactorError');
      if (!storedCode) {
        errorEl.textContent = 'Erro interno. Por favor, faça login novamente.';
        return;
      }
      if (enteredCode === storedCode) {
        // Código correto: decide entre fluxo de cadastro ou login
        sessionStorage.removeItem('twoFactorCode');
        errorEl.textContent = '';
        if (verificationMode === 'register') {
          const userObj = pendingRegistrationUser;
          pendingRegistrationUser = null;
          verificationMode = null;
          if (!userObj) {
            errorEl.textContent = 'Erro interno. Por favor, tente novamente.';
            return;
          }
          if (USE_API) {
            apiRegisterUser(userObj)
              .then(() => {
                alert('Cadastro confirmado com sucesso! Faça login para continuar.');
                // Esconde o modal e redireciona para a tela de login
                const modal = document.getElementById('twoFactorModal');
                if (modal) modal.style.display = 'none';
                window.location.href = 'index.html';
              })
              .catch((err) => {
                errorEl.textContent = err.message;
              });
          } else {
            // Salva em localStorage
            const users = getUsers();
            users.push({
              name: userObj.nome,
              age: userObj.idade,
              gender: userObj.sexo,
              email: userObj.email,
              password: userObj.senha,
            });
            saveUsers(users);
            alert('Cadastro confirmado com sucesso! Faça login para continuar.');
            const modal = document.getElementById('twoFactorModal');
            if (modal) modal.style.display = 'none';
            window.location.href = 'index.html';
          }
        } else {
          // Fluxo de login
          if (!USE_API) {
            const emailField = document.getElementById('loginEmail');
            const emailVal = emailField ? emailField.value.trim() : null;
            if (emailVal) {
              const users = getUsers();
              const u = users.find((usr) => usr.email.toLowerCase() === emailVal.toLowerCase());
              if (u) sessionStorage.setItem('currentUser', JSON.stringify(u));
            }
          }
          // Fecha o modal de 2FA e redireciona à home
          const modal = document.getElementById('twoFactorModal');
          if (modal) {
            modal.style.display = 'none';
          }
          window.location.href = 'home.html';
        }
      } else {
        errorEl.textContent = 'Código inválido. Por favor, tente novamente.';
      }
    });
  }

  /* ------------ Recuperação de senha ------------ */
  const forgotLink = document.getElementById('forgotPasswordLink');
  const resetModal = document.getElementById('resetModal');
  const closeBtn = document.getElementById('resetCloseBtn');

  let resetEmailGlobal = null;
  let resetCodeGlobal = null;

  // Abrir modal
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      resetModal.style.display = 'flex';
      document.getElementById('resetStepEmail').style.display = 'block';
      document.getElementById('resetStepCode').style.display = 'none';
      document.getElementById('resetStepPassword').style.display = 'none';
    });
  }

  // Fechar modal
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      resetModal.style.display = 'none';
    });
  }

  // Etapa 1: Solicitar código
  const resetRequestBtn = document.getElementById('resetRequestBtn');
  if (resetRequestBtn) {
    resetRequestBtn.addEventListener('click', async () => {
      const email = document.getElementById('resetEmail').value.trim();
      const errorEl = document.getElementById('resetError');
      errorEl.textContent = '';

      if (!email) {
        errorEl.textContent = 'Informe seu e-mail.';
        return;
      }

      if (USE_API) {
        // Modo API: solicita ao backend o envio do código de recuperação
        try {
          const response = await fetch("http://localhost:3000/api/request-password-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
          if (!response.ok) {
            // tenta extrair mensagem de erro do backend
            let errMsg = 'Erro ao solicitar recuperação.';
            try {
              const err = await response.json();
              if (err && err.erro) errMsg = err.erro;
            } catch (e) {
              // ignora
            }
            throw new Error(errMsg);
          }
          // Armazena apenas o e‑mail. O código será digitado pelo usuário na próxima etapa.
          resetEmailGlobal = email;
          resetCodeGlobal = null;
          console.log("📧 E-mail salvo:", resetEmailGlobal, "Código enviado por e-mail");
          // Avança para etapa de inserção de código
          document.getElementById('resetStepEmail').style.display = 'none';
          document.getElementById('resetStepCode').style.display = 'block';
        } catch (err) {
          errorEl.textContent = err.message;
        }
      } else {
        // Modo local: verifica se o usuário existe no armazenamento local
        const users = getUsers();
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) {
          errorEl.textContent = 'Usuário não encontrado.';
          return;
        }
        // Gera um código de recuperação de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        resetEmailGlobal = email;
        resetCodeGlobal = code; // guarda código gerado para verificação
        // Exibe o código em um alerta para simular envio por e-mail
        alert('Código de recuperação (modo local): ' + code);
        console.log("📧 E-mail salvo:", resetEmailGlobal, "Código gerado:", resetCodeGlobal);
        // Avança para etapa de inserção de código
        document.getElementById('resetStepEmail').style.display = 'none';
        document.getElementById('resetStepCode').style.display = 'block';
      }
    });
  }

  // ===== Etapa 2: Verificar código =====
  const resetCodeBtn = document.getElementById('resetCodeBtn');
  const resetErrorCode = document.getElementById('resetErrorCode');
  const resetStepCode = document.getElementById('resetStepCode');
  const resetStepPassword = document.getElementById('resetStepPassword');

  if (resetCodeBtn && resetErrorCode && resetStepCode && resetStepPassword) {
    resetCodeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = document.getElementById('resetCode').value.trim();
      resetErrorCode.textContent = '';

      if (!code) {
        resetErrorCode.textContent = 'Preencha todos os campos.';
        return;
      }

      // Verificação do código
      console.log('Código digitado:', code);
      if (USE_API) {
        // Em modo API, armazenamos o código digitado para enviá-lo ao backend
        resetCodeGlobal = code;
        // Não validamos aqui; o backend fará a verificação
      } else {
        // Em modo local, comparamos com o código gerado anteriormente
        if (code !== resetCodeGlobal) {
          resetErrorCode.textContent = 'Código inválido.';
          return;
        }
      }
      // Avança para etapa de nova senha
      resetStepCode.style.display = 'none';
      resetStepPassword.style.display = 'block';
    });
  }

  // Etapa 3: Alterar senha
  const resetChangeBtn = document.getElementById('resetChangeBtn');
  if (resetChangeBtn) {
    resetChangeBtn.addEventListener('click', async () => {
      const novaSenha = document.getElementById('resetNewPassword').value;
      const confirmSenha = document.getElementById('resetConfirmPassword').value;
      const errorEl = document.getElementById('resetErrorPassword');
      errorEl.textContent = '';

      const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}$/;
      if (!regex.test(novaSenha)) {
        errorEl.textContent = 'Senha deve ter mínimo 6 caracteres, 1 letra maiúscula, 1 número e 1 símbolo.';
        return;
      }

      if (novaSenha !== confirmSenha) {
        errorEl.textContent = 'As senhas não coincidem.';
        return;
      }

      if (USE_API) {
        // Modo API: envia requisição ao backend
        try {
          const response = await fetch("http://localhost:3000/api/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: resetEmailGlobal,
              code: resetCodeGlobal,
              novaSenha: novaSenha
            })
          });
          if (!response.ok) {
            let errMsg = 'Erro ao alterar senha.';
            try {
              const err = await response.json();
              if (err && err.erro) errMsg = err.erro;
            } catch (e) {
              // ignora
            }
            throw new Error(errMsg);
          }
          alert("Senha alterada com sucesso!");
          // Fecha o modal de recuperação
          resetModal.style.display = 'none';
          // Redireciona automaticamente para a tela de login para que o usuário possa
          // autenticar com a nova senha
          window.location.href = 'index.html';
        } catch (err) {
          errorEl.textContent = err.message;
        }
      } else {
        // Modo local: atualiza a senha no armazenamento local
        const users = getUsers();
        const idx = users.findIndex((u) => u.email.toLowerCase() === resetEmailGlobal.toLowerCase());
        if (idx === -1) {
          errorEl.textContent = 'Usuário não encontrado.';
          return;
        }
        // Atualiza a senha em claro no objeto e salva. Para armazenamento local,
        // o objeto do usuário utiliza a propriedade "password", conforme definido no cadastro.
        users[idx].password = novaSenha;
        saveUsers(users);
        alert("Senha alterada com sucesso!");
        // Fecha o modal de recuperação
        resetModal.style.display = 'none';
        // Redireciona para a tela de login para que o usuário possa autenticar
        window.location.href = 'index.html';
      }
    });
  }

  /* Funções auxiliares para planos de treino */
  function getPlans() {
    try {
      return JSON.parse(localStorage.getItem('revitalizePlans')) || [];
    } catch (e) {
      return [];
    }
  }

  function savePlans(plans) {
    localStorage.setItem('revitalizePlans', JSON.stringify(plans));
  }

  /* Funções auxiliares para histórico de IMC. */
  function getImcHistory() {
    try {
      return JSON.parse(localStorage.getItem('revitalizeImcHistory')) || [];
    } catch (e) {
      return [];
    }
  }

  function saveImcHistory(history) {
    localStorage.setItem('revitalizeImcHistory', JSON.stringify(history));
  }

  /* =============================
     RF3 – MODELOS por Nível/Objetivo
     Estas estruturas definem sugestões de treinos de acordo com o
     nível de treino selecionado (Iniciante, Intermediário, Avançado ou Em branco)
     e o objetivo (Perda de Peso, Ganho de Massa ou Manutenção/Mobilidade).
     Cada sugestão possui cinco dias e, em cada dia, seis itens: um
     aquecimento e cinco exercícios. Os exercícios são apenas exemplos
     genéricos e servem como ponto de partida para o usuário, que pode
     editá-los posteriormente na tela de ajustes.
  =============================*/

  // Cria um objeto de exercício a partir de um nome e um valor
  function ex(name, value = '3x12') {
    return { name, value };
  }

  // Gera uma lista padrão de seis exercícios, incluindo um
  // aquecimento customizável. O valor para as repetições pode ser
  // modificado depois pelo usuário.
  function baseSix(aquec = 'Aquecimento') {
    // Retorna um conjunto padrão de exercícios: aquecimento, cinco exercícios genéricos e um alongamento.
    return [
      ex(aquec, ''),
      ex('Exercício 1'),
      ex('Exercício 2'),
      ex('Exercício 3'),
      ex('Exercício 4'),
      ex('Exercício 5'),
      ex('Alongamento', ''),
    ];
  }

  // Modelos de treinos sugeridos para cada nível e objetivo. Para simplificar,
  // apenas alguns exemplos foram detalhados (como o nível Iniciante para
  // Perda de Peso); os demais reutilizam a estrutura baseSix() para
  // permitir que o usuário personalize conforme desejar. Se desejar
  // personalizar mais, adicione os nomes dos dias e aquecimentos
  // conforme os anexos do projeto.
  const templates = {
    'Iniciante': {
      // Treinos completos extraídos do documento para o nível Iniciante
      'Perda de Peso': [
        {
          name: 'Treino 1 – Peito e Ombro',
          exercises: [
            { name: 'Aquecimento', value: '10 min caminhada rápida ou bicicleta' },
            { name: 'Supino reto com halteres', value: '3x12-15' },
            { name: 'Supino inclinado com halteres', value: '3x12' },
            { name: 'Crucifixo máquina (voador)', value: '3x12-15' },
            { name: 'Elevação lateral com halteres', value: '3x12' },
            { name: 'Desenvolvimento (ombro) com halteres', value: '3x12' },
            { name: 'Prancha', value: '3x30s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Aquecimento', value: '10 min esteira inclinada' },
            { name: 'Agachamento livre sem peso ou com halteres leves', value: '3x15' },
            { name: 'Leg press', value: '3x12-15' },
            { name: 'Afundo (avanço)', value: '3x12 cada perna' },
            { name: 'Cadeira extensora', value: '3x12-15' },
            { name: 'Mesa flexora', value: '3x12' },
            { name: 'Panturrilha em pé', value: '3x20' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Aquecimento', value: '5 min corda ou bicicleta' },
            { name: 'Puxada na polia frente', value: '3x12-15' },
            { name: 'Remada baixa máquina', value: '3x12' },
            { name: 'Remada unilateral com halter', value: '3x12 cada braço' },
            { name: 'Abdominal reto no colchonete', value: '3x20' },
            { name: 'Abdominal bicicleta', value: '3x20' },
            { name: 'Prancha lateral', value: '2x20s cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Aquecimento', value: '5 min corda' },
            { name: 'Rosca direta com halteres', value: '3x12' },
            { name: 'Rosca alternada', value: '3x12' },
            { name: 'Rosca martelo', value: '3x12' },
            { name: 'Tríceps corda no cabo', value: '3x12' },
            { name: 'Tríceps francês com halter', value: '3x12' },
            { name: 'Flexão de braço no chão', value: '2x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Corpo todo + Cardio',
          exercises: [
            { name: 'Aquecimento', value: '5 min corrida leve' },
            { name: 'Supino reto halteres', value: '3x12' },
            { name: 'Agachamento com halteres', value: '3x12' },
            { name: 'Remada curvada com halteres', value: '3x12' },
            { name: 'Desenvolvimento militar halteres', value: '3x12' },
            { name: 'Cardio HIIT: esteira ou bike', value: '8 min (30s rápido / 30s leve)' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Ganho de Massa': [
        {
          name: 'Treino 1 – Peito + Ombro',
          exercises: [
            { name: 'Supino reto barra', value: '4x8-10' },
            { name: 'Supino inclinado máquina', value: '4x8-10' },
            { name: 'Crucifixo inclinado halteres', value: '3x10' },
            { name: 'Desenvolvimento com halteres', value: '4x8-10' },
            { name: 'Elevação lateral', value: '4x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Agachamento livre barra', value: '4x8-10' },
            { name: 'Leg press', value: '4x10' },
            { name: 'Hack machine', value: '3x10' },
            { name: 'Cadeira extensora', value: '4x12' },
            { name: 'Stiff com halteres', value: '4x10' },
            { name: 'Mesa flexora', value: '3x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Barra fixa (ou puxada no gravitron)', value: '4x até 8-10' },
            { name: 'Remada curvada barra', value: '4x10' },
            { name: 'Puxada frente polia', value: '3x10' },
            { name: 'Remada baixa máquina', value: '3x10' },
            { name: 'Lombar banco romano', value: '4x10' },
            { name: 'Abdominal infra banco declinado', value: '4x15' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Rosca direta barra', value: '4x8-10' },
            { name: 'Rosca inclinada', value: '3x10' },
            { name: 'Rosca martelo', value: '3x10' },
            { name: 'Tríceps corda', value: '4x8-10' },
            { name: 'Tríceps francês', value: '3x10' },
            { name: 'Paralelas (ou banco)', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Ombro + Panturrilha + Core',
          exercises: [
            { name: 'Desenvolvimento militar barra', value: '4x8-10' },
            { name: 'Elevação lateral polia', value: '4x12' },
            { name: 'Elevação frontal halteres', value: '3x12' },
            { name: 'Panturrilha em pé', value: '4x20' },
            { name: 'Panturrilha sentado', value: '4x20' },
            { name: 'Prancha', value: '4x30-40s' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Manutenção/Mobilidade': [
        {
          name: 'Treino 1 – Coluna e Quadril',
          exercises: [
            { name: 'Gato-camelo', value: '3x10' },
            { name: 'Ponte de quadril', value: '3x15' },
            { name: 'Prancha', value: '3x30s' },
            { name: 'Alongamento borboleta', value: '3x20s' },
            { name: 'Rotação de quadril em pé', value: '3x10 cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Ombros e Braços',
          exercises: [
            { name: 'Mobilidade de ombro com bastão', value: '3x10' },
            { name: 'Rotação externa com elástico', value: '3x12' },
            { name: 'Elevação lateral com elástico', value: '3x12' },
            { name: 'Alongamento de tríceps acima da cabeça', value: '3x20s' },
            { name: 'Alongamento de peitoral na parede', value: '3x20s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Pernas',
          exercises: [
            { name: 'Agachamento profundo com peso corporal', value: '3x10' },
            { name: 'Elevação de calcanhar em pé', value: '3x15' },
            { name: 'Afundo estático', value: '3x10 cada perna' },
            { name: 'Alongamento posterior da coxa sentado', value: '3x20s' },
            { name: 'Mobilidade de joelho (circulares)', value: '3x10' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Coluna e Core',
          exercises: [
            { name: 'Bird-dog', value: '3x10' },
            { name: 'Prancha lateral', value: '3x20s cada lado' },
            { name: 'Alongamento cobra', value: '3x20s' },
            { name: 'Mobilidade torácica em 4 apoios', value: '3x10' },
            { name: 'Abdominal hipopressivo', value: '3x30s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Full Body Mobilidade',
          exercises: [
            { name: 'Caminhada do urso', value: '3x10 passos' },
            { name: 'Caminhada do caranguejo', value: '3x10 passos' },
            { name: 'Mobilidade de ombro com elástico', value: '3x12' },
            { name: 'Mobilidade de quadril em 4 apoios', value: '3x12' },
            { name: 'Alongamento global em pé', value: '3x30s' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
    },
    // Treinos completos para o nível Intermediário extraídos do PDF.
    'Intermediário': {
      'Perda de Peso': [
        {
          name: 'Treino 1 – Peito e Ombro',
          exercises: [
            { name: 'Supino reto barra', value: '4x12-15' },
            { name: 'Supino inclinado halteres', value: '4x12' },
            { name: 'Crucifixo máquina', value: '3x12-15' },
            { name: 'Desenvolvimento militar barra', value: '3x12' },
            { name: 'Elevação lateral + frontal (bi-set)', value: '3x12 cada' },
            { name: 'Flexão de braço', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Agachamento livre com barra', value: '4x12' },
            { name: 'Leg press', value: '4x15-12' },
            { name: 'Afundo caminhando', value: '3x12 cada perna' },
            { name: 'Cadeira extensora + mesa flexora (bi-set)', value: '3x12-15' },
            { name: 'Stiff com barra', value: '3x12' },
            { name: 'Panturrilha em pé', value: '4x20' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Barra fixa (ou gravitron)', value: '4x8-12' },
            { name: 'Remada curvada barra', value: '4x12' },
            { name: 'Puxada polia frente', value: '3x12' },
            { name: 'Remada unilateral halteres', value: '3x12 cada braço' },
            { name: 'Abdominal infra no banco', value: '3x20' },
            { name: 'Prancha com elevação de perna', value: '3x40s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Rosca barra W', value: '4x12' },
            { name: 'Rosca alternada sentado', value: '3x12' },
            { name: 'Rosca martelo com corda', value: '3x12' },
            { name: 'Tríceps corda', value: '4x12' },
            { name: 'Tríceps testa', value: '3x12' },
            { name: 'Mergulho no banco', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Full Body + Cardio HIIT',
          exercises: [
            { name: 'Supino reto halteres', value: '3x12' },
            { name: 'Agachamento com barra', value: '3x12' },
            { name: 'Remada baixa máquina', value: '3x12' },
            { name: 'Desenvolvimento militar', value: '3x12' },
            { name: 'HIIT esteira/bike', value: '12 min (30s rápido / 15s leve)' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Ganho de Massa': [
        {
          name: 'Treino 1 – Peito + Ombro',
          exercises: [
            { name: 'Supino reto barra', value: '5x6-8' },
            { name: 'Supino inclinado halteres', value: '4x8-10' },
            { name: 'Crucifixo inclinado', value: '3x10' },
            { name: 'Desenvolvimento com barra', value: '4x8-10' },
            { name: 'Elevação lateral + frontal (bi-set)', value: '3x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Agachamento livre barra', value: '5x8' },
            { name: 'Leg press', value: '4x10' },
            { name: 'Passada andando com halteres', value: '3x12 cada perna' },
            { name: 'Cadeira extensora', value: '4x12 (drop set última série)' },
            { name: 'Stiff com barra', value: '4x10' },
            { name: 'Panturrilha sentado', value: '5x20' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Barra fixa', value: '5x até 8-10' },
            { name: 'Remada curvada barra', value: '4x8-10' },
            { name: 'Puxada polia frente', value: '3x10' },
            { name: 'Remada baixa máquina', value: '3x10' },
            { name: 'Lombar banco romano com anilha', value: '4x12' },
            { name: 'Abdominal infra com peso', value: '4x15' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Rosca direta barra', value: '4x8-10' },
            { name: 'Rosca inclinada halteres', value: '3x10' },
            { name: 'Rosca concentrada', value: '3x10' },
            { name: 'Tríceps francês halteres', value: '3x10' },
            { name: 'Tríceps pulley corda', value: '4x8-10' },
            { name: 'Paralelas', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Ombro + Core',
          exercises: [
            { name: 'Desenvolvimento militar barra', value: '5x8' },
            { name: 'Elevação lateral', value: '4x12' },
            { name: 'Elevação frontal polia', value: '3x12' },
            { name: 'Encolhimento de ombros barra', value: '4x12' },
            { name: 'Prancha com peso', value: '4x40-60s' },
            { name: 'Abdominal lateral com anilha', value: '3x15 cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Manutenção/Mobilidade': [
        {
          name: 'Treino 1 – Coluna e Quadril',
          exercises: [
            { name: 'Gato-camelo', value: '3x12' },
            { name: 'Ponte de quadril com uma perna', value: '3x12 cada' },
            { name: 'Prancha dinâmica (movendo braços)', value: '3x30s' },
            { name: 'Alongamento borboleta + rotação quadril', value: '3x20s' },
            { name: 'Dead bug (core)', value: '3x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Ombros',
          exercises: [
            { name: 'Mobilidade ombro bastão', value: '3x12' },
            { name: 'Rotação externa com elástico', value: '3x15' },
            { name: 'Face pull (elástico ou polia)', value: '3x12' },
            { name: 'Alongamento peitoral parede', value: '3x20s' },
            { name: 'Alongamento trapézio lateral', value: '3x20s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Pernas e Joelhos',
          exercises: [
            { name: 'Agachamento profundo (sumô)', value: '3x10' },
            { name: 'Mobilidade tornozelo (avanço com joelho)', value: '3x12' },
            { name: 'Afundo isométrico', value: '3x cada perna' },
            { name: 'Alongamento posterior coxa', value: '3x20s' },
            { name: 'Ponte unilateral (glúteo)', value: '3x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Core e Coluna',
          exercises: [
            { name: 'Bird-dog com pausa', value: '3x12' },
            { name: 'Prancha lateral com elevação quadril', value: '3x20s' },
            { name: 'Mobilidade torácica em 4 apoios', value: '3x12' },
            { name: 'Alongamento cobra', value: '3x20s' },
            { name: 'Hollow hold', value: '3x20s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Full Body Mobilidade Ativa',
          exercises: [
            { name: 'Caminhada do urso', value: '3x12 passos' },
            { name: 'Caminhada do caranguejo', value: '3x12 passos' },
            { name: 'Fire hydrant (quadril)', value: '3x12 cada perna' },
            { name: 'Mobilidade dinâmica de ombro (elástico)', value: '3x12' },
            { name: 'Alongamento global em pé', value: '3x30s' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
    },
    // Treinos completos para o nível Avançado extraídos do PDF.
    'Avançado': {
      'Perda de Peso': [
        {
          name: 'Treino 1 – Peito e Ombro',
          exercises: [
            { name: 'Supino reto barra', value: '5x15 (descanso 30s)' },
            { name: 'Supino inclinado halteres', value: '4x12-15' },
            { name: 'Crucifixo máquina', value: '4x15 (drop set na última série)' },
            { name: 'Desenvolvimento militar barra', value: '4x12' },
            { name: 'Elevação lateral + frontal (bi-set)', value: '4x12 cada' },
            { name: 'Flexão de braço com batida de mão', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Agachamento livre barra', value: '5x15' },
            { name: 'Leg press', value: '4x15 (drop set última série)' },
            { name: 'Afundo caminhando com halteres', value: '4x12 cada perna' },
            { name: 'Cadeira extensora + mesa flexora (bi-set)', value: '4x12-15' },
            { name: 'Stiff com barra', value: '4x12' },
            { name: 'Panturrilha em pé explosiva', value: '4x25' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Barra fixa com carga', value: '5x10-12' },
            { name: 'Remada curvada barra', value: '4x12' },
            { name: 'Puxada polia frente', value: '4x12' },
            { name: 'Remada unilateral halteres', value: '3x12 cada braço' },
            { name: 'Abdominal infra com caneleira', value: '4x20' },
            { name: 'Prancha dinâmica com deslocamento', value: '4x45s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Rosca direta barra', value: '5x12' },
            { name: 'Rosca inclinada halteres', value: '4x12' },
            { name: 'Rosca concentrada', value: '3x12' },
            { name: 'Tríceps corda', value: '5x12' },
            { name: 'Tríceps testa barra W', value: '4x12' },
            { name: 'Mergulho entre bancos com peso', value: '3x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Full Body + HIIT Pesado',
          exercises: [
            { name: 'Supino reto halteres', value: '3x12' },
            { name: 'Agachamento frontal barra', value: '3x12' },
            { name: 'Levantamento terra', value: '3x10' },
            { name: 'Desenvolvimento militar barra', value: '3x12' },
            { name: 'HIIT esteira/bike', value: '15 min (20s sprint / 10s leve – Tabata)' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Ganho de Massa': [
        {
          name: 'Treino 1 – Peito + Ombro',
          exercises: [
            { name: 'Supino reto barra', value: '6x6-8 (pirâmide crescente)' },
            { name: 'Supino inclinado halteres', value: '5x8' },
            { name: 'Crucifixo inclinado', value: '4x10' },
            { name: 'Desenvolvimento militar barra', value: '5x8' },
            { name: 'Elevação lateral', value: '4x12-15' },
            { name: 'Encolhimento de ombros', value: '4x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Pernas',
          exercises: [
            { name: 'Agachamento livre barra', value: '6x6-8 (carga alta)' },
            { name: 'Leg press', value: '5x10' },
            { name: 'Passada andando com barra', value: '4x12 cada perna' },
            { name: 'Cadeira extensora', value: '4x12 (rest-pause na última série)' },
            { name: 'Stiff barra', value: '5x8-10' },
            { name: 'Panturrilha sentado', value: '5x25' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Costas + Abdômen',
          exercises: [
            { name: 'Barra fixa com peso', value: '6x6-10' },
            { name: 'Remada curvada barra', value: '5x8' },
            { name: 'Puxada polia frente', value: '4x10' },
            { name: 'Remada baixa máquina', value: '4x10' },
            { name: 'Levantamento terra', value: '4x6' },
            { name: 'Abdominal infra com peso', value: '5x15-20' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Braços',
          exercises: [
            { name: 'Rosca direta barra', value: '5x8' },
            { name: 'Rosca inclinada halteres', value: '4x10' },
            { name: 'Rosca martelo com corda', value: '4x10' },
            { name: 'Tríceps corda', value: '5x8-10' },
            { name: 'Tríceps francês halteres', value: '4x10' },
            { name: 'Paralelas com peso', value: '4x até a falha' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Ombro + Core',
          exercises: [
            { name: 'Desenvolvimento militar barra', value: '6x6-8' },
            { name: 'Elevação lateral', value: '5x12' },
            { name: 'Elevação frontal polia', value: '4x12' },
            { name: 'Face pull', value: '4x12' },
            { name: 'Prancha com peso', value: '5x60s' },
            { name: 'Abdominal oblíquo com peso', value: '4x15 cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
      'Manutenção/Mobilidade': [
        {
          name: 'Treino 1 – Coluna e Quadril',
          exercises: [
            { name: 'Gato-camelo com pausa de 2s', value: '3x12' },
            { name: 'Ponte de quadril unilateral com elevação de braço', value: '3x12 cada lado' },
            { name: 'Prancha com toque no ombro', value: '3x12' },
            { name: 'Mobilidade torácica em 4 apoios (girar tronco)', value: '3x12 cada lado' },
            { name: 'Dead bug avançado (com peso leve)', value: '3x12' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 2 – Ombros e Braços',
          exercises: [
            { name: 'Mobilidade com bastão (passar por trás da cabeça)', value: '3x12' },
            { name: 'Rotação externa com elástico em pé', value: '3x15' },
            { name: 'Face pull (elástico ou polia)', value: '3x12' },
            { name: 'Y-T-W (mobilidade escapular deitado)', value: '3x12 cada posição' },
            { name: 'Flexão de braço isométrica (segurar meio movimento)', value: '3x20s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 3 – Pernas e Joelhos',
          exercises: [
            { name: 'Agachamento sumô profundo com pausa', value: '3x10' },
            { name: 'Mobilidade tornozelo (avanço com joelho)', value: '3x12 cada perna' },
            { name: 'Afundo búlgaro isométrico (segura 15s)', value: '3x cada perna' },
            { name: 'Ponte de glúteo unilateral com pé elevado', value: '3x12' },
            { name: 'Caminhada lateral com miniband (elástico)', value: '3x12 passos cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 4 – Core e Coluna',
          exercises: [
            { name: 'Bird-dog com elástico', value: '3x12 cada lado' },
            { name: 'Prancha lateral com elevação de quadril', value: '3x12 cada lado' },
            { name: 'Hollow body hold (corpo em forma de barquinho)', value: '3x20s' },
            { name: 'Mobilidade torácica com bastão (em pé, girando tronco)', value: '3x12' },
            { name: 'Abdominal hipopressivo', value: '3x30s' },
            { name: 'Alongamento', value: '' },
          ],
        },
        {
          name: 'Treino 5 – Full Body Mobilidade Ativa',
          exercises: [
            { name: 'Caminhada do urso (bear crawl)', value: '3x15 passos' },
            { name: 'Caminhada do caranguejo', value: '3x15 passos' },
            { name: 'Fire hydrant com elástico', value: '3x15 cada lado' },
            { name: 'Mobilidade de ombro com elástico (abdução e adução)', value: '3x12' },
            { name: 'Turkish Get Up (subida turca com halter leve)', value: '3x6 cada lado' },
            { name: 'Alongamento', value: '' },
          ],
        },
      ],
    },
  };

  // Para o nível "Em branco", gera cinco dias vazios, que poderão
  // ser totalmente editados depois pelo usuário na tela de ajustes.
  function blankFiveDays() {
    const days = [];
    for (let i = 1; i <= 5; i++) {
      days.push({
        name: `Dia ${i}`,
        exercises: baseSix('Aquecimento'),
      });
    }
    return days;
  }

  // Retorna um array de treinos com base no nível e objetivo
  function buildTrainingsByLevel(level, objetivo) {
    if (level === 'Em branco') return blankFiveDays();
    const lvlObj = templates[level] || templates['Iniciante'];
    // Ajusta a chave do objetivo: "Manutenção" e "Manutenção/Mobilidade" são tratados juntos
    const key = (objetivo === 'Manutenção' || objetivo === 'Manutenção/Mobilidade')
      ? 'Manutenção/Mobilidade'
      : objetivo;
    const list = (lvlObj && lvlObj[key]) ? lvlObj[key] : blankFiveDays();
    // Copia profundamente para não alterar o modelo original
    return JSON.parse(JSON.stringify(list));
  }

  /* Página Home */
  if (document.body.classList.contains('home')) {
    const greeting = document.getElementById('greeting');
    const logoutBtn = document.getElementById('logoutBtn');
    const createPlanBtn = document.getElementById('createPlanBtn');
    const adjustPlanBtn = document.getElementById('adjustPlanBtn');
    const monitoringBtn = document.getElementById('monitoringBtn');
    const imcBtn = document.getElementById('imcBtn');

    // Exibe saudação com o nome do usuário logado
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      greeting.textContent = `Bem-Vindo, ${user.name}`;
    }

    // Navegação
    if (createPlanBtn) {
      createPlanBtn.addEventListener('click', () => {
        window.location.href = 'plan.html';
      });
    }
    if (adjustPlanBtn) {
      adjustPlanBtn.addEventListener('click', () => {
        window.location.href = 'adjust.html';
      });
    }
    if (monitoringBtn) {
      monitoringBtn.addEventListener('click', () => {
        window.location.href = 'monitoring.html';
      });
    }
    if (imcBtn) {
      imcBtn.addEventListener('click', () => {
        window.location.href = 'imc.html';
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
      });
    }
  }

  /* ====================
     REQUISITO FUNCIONAL 3 – CRIAÇÃO DO PLANO DE TREINO
     Esta seção corresponde à página plan.html. Nela são coletados altura, peso e objetivo do usuário,
     validados e utilizados para gerar automaticamente um plano de treino padrão com três treinos (A, B, C).
     O plano criado é armazenado em localStorage e o usuário é direcionado para a tela de ajustes.
  ==================== */
  /* Página Criar Plano */
  if (document.body.classList.contains('plan')) {
    const backBtn = document.getElementById('backHomeFromPlan');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
    }

    const alturaInput = document.getElementById('altura');
    alturaInput.addEventListener('input', (e) => {
      let val = e.target.value;
      val = val.replace(/\D/g, '');
      if (val.length > 2) {
        val = val.slice(0, -2) + ',' + val.slice(-2);
      } else if (val.length === 2) {
        val = val[0] + ',' + val[1];
      } else if (val.length === 1) {
        val = val;
      } else {
        val = '';
      }
      e.target.value = val;
    });

    const pesoInput = document.getElementById('peso');
    // Ajusta o comprimento máximo do campo de peso para permitir valores com vírgula (ex.: 88,60)
    if (pesoInput) {
      pesoInput.setAttribute('maxlength', '6');
    }
    pesoInput.addEventListener('input', (e) => {
      let val = e.target.value;
      // Permite apenas dígitos e uma vírgula
      val = val.replace(/[^0-9,]/g, '');
      // Garante no máximo uma vírgula
      const parts = val.split(',');
      if (parts.length > 2) {
        val = parts[0] + ',' + parts.slice(1).join('');
      }
      // Limita a parte inteira a 3 dígitos e a parte decimal a 2 dígitos
      const [intPart, decPart] = val.split(',');
      let newVal = intPart ? intPart.slice(0, 3) : '';
      if (decPart !== undefined) {
        newVal += ',' + decPart.slice(0, 2);
      }
      e.target.value = newVal;
    });

    /* =============================
       RF3 – Inserir campo "Nível de treino"
       Este bloco injeta dinamicamente, entre os campos de peso e objetivo,
       um seletor de nível de treino com quatro opções: Iniciante,
       Intermediário, Avançado e Em branco. Isso permite que o usuário
       escolha o nível de intensidade desejado antes de gerar o plano.
    =============================*/
    const planFormEl = document.getElementById('planForm');
    if (planFormEl && !document.getElementById('nivelTreino')) {
      // Localiza o grupo de peso para inserir o novo seletor após ele
      const pesoGroup = document.getElementById('peso')?.closest('.input-group');
      const nivelGroup = document.createElement('div');
      nivelGroup.className = 'input-group';
      nivelGroup.innerHTML = `
        <label for="nivelTreino">Nível de treino</label>
        <select id="nivelTreino" required>
          <option value="Iniciante">Iniciante</option>
          <option value="Intermediário">Intermediário</option>
          <option value="Avançado">Avançado</option>
          <option value="Em branco">Em branco (editável)</option>
        </select>
      `;
      if (pesoGroup && pesoGroup.nextSibling) {
        planFormEl.insertBefore(nivelGroup, pesoGroup.nextSibling);
      } else {
        planFormEl.appendChild(nivelGroup);
      }
    }

    const planForm = document.getElementById('planForm');
    if (planForm) {
      planForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const alturaVal = document.getElementById('altura').value.trim();
        const pesoVal = document.getElementById('peso').value.trim();
        const objetivoVal = document.getElementById('objetivo').value;
        const errorEl = document.getElementById('planError');

        errorEl.textContent = '';

        const alturaNum = parseFloat(alturaVal.replace(',', '.'));
        const pesoNum = parseFloat(pesoVal.replace(',', '.'));

        if (!alturaVal || isNaN(alturaNum) || alturaNum <= 0) {
          errorEl.textContent = 'Informe uma altura válida (em metros).';
          return;
        }
        if (!pesoVal || isNaN(pesoNum) || pesoNum <= 0) {
          errorEl.textContent = 'Informe um peso válido (em quilogramas).';
          return;
        }
        if (!objetivoVal) {
          errorEl.textContent = 'Selecione um objetivo.';
          return;
        }

        /* =============================
           RF3 – CRIAÇÃO DO PLANO DE TREINO
           Aqui criamos o plano utilizando o nível de treino escolhido pelo
           usuário e o objetivo selecionado. Utilizamos a função
           buildTrainingsByLevel() para obter cinco dias com seis exercícios
           cada. O campo "level" é salvo para referência futura (não usado
           atualmente). O plano é então salvo em localStorage e o usuário
           redirecionado para a página de ajustes.
        =============================*/
        const nivelVal = document.getElementById('nivelTreino')?.value || 'Iniciante';
        const plans = getPlans();
        const newPlan = {
          id: Date.now(),
          height: alturaNum,
          weight: pesoNum,
          objective: objetivoVal,
          level: nivelVal,
          trainings: buildTrainingsByLevel(nivelVal, objetivoVal),
          history: [],
        };
        plans.push(newPlan);
        savePlans(plans);
        alert('Plano criado com sucesso! Você poderá ajustá-lo posteriormente.');
        // Redireciona diretamente para a tela de ajustes para permitir edição imediata
        window.location.href = 'adjust.html';
      });
    }
  }

  /* ====================
     Fim da criação de plano (RF3)
  ==================== */

  /* ====================
     REQUISITO FUNCIONAL 4 – AJUSTES DO PLANO DE TREINO
     Esta seção corresponde à página adjust.html. Permite listar, editar e deletar planos existentes.
     Ao editar um plano, o usuário pode ajustar métricas e exercícios; a versão anterior é armazenada
     no histórico do plano para possível reversão.
  ==================== */
  /* Página Ajustar Plano */
  if (document.body.classList.contains('adjust')) {
    const backBtn = document.getElementById('backHomeFromAdjust');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        // Volta para a página anterior usando histórico do navegador
        window.history.back();
      });
    }
    const planListEl = document.getElementById('planList');
    const planDetailsEl = document.getElementById('planDetails');
    const planNameTitle = document.getElementById('planNameTitle');
    const adjustForm = document.getElementById('adjustForm');
    const trainingsContainer = document.getElementById('trainingsContainer');
    const cancelAdjustBtn = document.getElementById('cancelAdjust');
    const saveAdjustBtn = document.getElementById('saveAdjust');

    /* =============================
       RF4 – Funções auxiliares para Ajustes do Plano
       Aqui definimos componentes reutilizáveis para desenhar dias e
       exercícios de forma dinâmica. Cada dia possui um input para o
       título e uma lista editável de exercícios. Cada exercício tem
       campos para nome e valor e um botão para remoção. O container
       para cada dia guarda um método _getData() que retorna os dados
       inseridos pelo usuário, facilitando a coleta no momento do
       salvamento.
    =============================*/
    // Armazenará as referências dos dias renderizados
    let dayNodes = [];

    /**
     * Faz o parsing de um valor de exercício no formato antigo (ex.: "3x12-15", "10 min",
     * "3x30s", "3x até a falha"). Retorna um objeto com as propriedades
     * series, rep e tempo preenchidas conforme o conteúdo detectado. Caso o
     * valor não contenha a letra "x" para demarcar séries, assume que é
     * tempo (se contiver "min" ou "s") ou repetições.
     * @param {string} value Valor original do exercício
     * @returns {{series: string, rep: string, tempo: string}}
     */
    function parseExerciseValue(value) {
      const result = { series: '', rep: '', tempo: '' };
      if (!value) return result;
      const v = value.toString().trim().toLowerCase();
      // Expressão para capturar "n x resto" (ex.: 3x12-15, 3x30s)
      const match = v.match(/^(\d+)\s*x\s*(.+)$/);
      if (match) {
        result.series = match[1];
        const rest = match[2];
        // Se o restante contém minutos ou segundos, interpreta como tempo
        if (/\b(min|s)\b/.test(rest) || /\d+\s*(min|s)/.test(rest)) {
          result.tempo = rest;
        } else {
          result.rep = rest;
        }
      } else {
        // Nenhum "x" encontrado: se contiver min/s trata como tempo
        if (/\b(min|s)\b/.test(v) || /\d+\s*(min|s)/.test(v)) {
          result.tempo = v;
        } else {
          result.rep = v;
        }
      }
      return result;
    }

    /**
     * Cria uma linha de exercício editável em formato de tabela. Cada linha
     * contém campos para nome, peso, séries, repetições e tempo (min/h), além
     * de botões de adicionar e remover linha. Ao clicar em "+" uma nova linha
     * em branco é criada logo abaixo da atual. Ao clicar em "–" a linha
     * corrente é removida. A lista de linhas é passada como parâmetro para
     * permitir a inserção dinâmica.
     *
     * @param {Object} exercise Objeto contendo as propriedades name, weight, series, rep e tempo
     * @param {HTMLElement} list O contêiner no qual a linha será inserida
     * @returns {HTMLElement} O elemento da linha criada
     */
    function renderExerciseRow(exercise, list) {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      // Campo: nome do exercício (usa textarea para permitir quebra de linha)
      const nameInput = document.createElement('textarea');
      nameInput.rows = 1;
      nameInput.className = 'ex-name';
      nameInput.value = exercise.name || '';
      // --- Ajuste dinâmico da altura ---
      // Para garantir que o texto completo do exercício seja visível, ajustamos
      // dinamicamente a altura do textarea com base em seu conteúdo. Se o
      // conteúdo ocupar mais de aproximadamente uma linha, adicionamos uma
      // classe "multi-line" na linha inteira para permitir que todos os
      // outros campos se alinhem no topo e aproveitem o espaço extra.
      function adjustTextareaHeight() {
        // Reinicia a altura antes de calcular a nova altura
        nameInput.style.height = 'auto';
        // Define a nova altura com base no scrollHeight
        nameInput.style.height = nameInput.scrollHeight + 'px';
        // Verifica se o conteúdo ocupa mais de 1,5 linhas (empírico)
        const lineHeight = parseFloat(getComputedStyle(nameInput).lineHeight) || 16;
        if (nameInput.scrollHeight > lineHeight * 1.5) {
          row.classList.add('multi-line');
        } else {
          row.classList.remove('multi-line');
        }
      }
      // Ajuste inicial para valores pré-carregados
      setTimeout(adjustTextareaHeight);
      // Ajusta sempre que o usuário digita
      nameInput.addEventListener('input', adjustTextareaHeight);
      // Campo: peso (permanece vazio para inserção pelo usuário)
      const weightInput = document.createElement('input');
      weightInput.type = 'text';
      weightInput.className = 'ex-weight';
      weightInput.value = exercise.weight || '';
      // Campo: séries
      const seriesInput = document.createElement('input');
      seriesInput.type = 'text';
      seriesInput.className = 'ex-series';
      seriesInput.value = exercise.series || '';
      // Campo: repetições
      const repInput = document.createElement('input');
      repInput.type = 'text';
      repInput.className = 'ex-rep';
      repInput.value = exercise.rep || '';
      // Campo: tempo (min/h)
      const tempoInput = document.createElement('input');
      tempoInput.type = 'text';
      tempoInput.className = 'ex-tempo';
      tempoInput.value = exercise.tempo || '';
      // Botão adicionar nova linha
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn add-ex-row';
      addBtn.textContent = '+';
      addBtn.title = 'Adicionar novo exercício';
      addBtn.addEventListener('click', () => {
        const newRow = renderExerciseRow({ name: '', weight: '', series: '', rep: '', tempo: '' }, list);
        // Insere logo após a linha atual
        list.insertBefore(newRow, row.nextSibling);
      });
      // Botão remover linha
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn del-ex-row';
      delBtn.textContent = '–';
      delBtn.title = 'Excluir este exercício';
      delBtn.addEventListener('click', () => {
        row.remove();
      });
      // Constrói a linha no layout de grade
      row.appendChild(nameInput);
      row.appendChild(weightInput);
      row.appendChild(seriesInput);
      row.appendChild(repInput);
      row.appendChild(tempoInput);
      row.appendChild(addBtn);
      row.appendChild(delBtn);
      return row;
    }

    // Cria e retorna um container para um dia de treino
    function renderTrainingDay(training, dayIndex) {
      const day = document.createElement('div');
      // Usa a mesma classe "training-item" para herdar estilos do CSS existente
      day.className = 'training-item';
      /*
        Cabeçalho do dia: exibe um rótulo "TREINO X", um campo de texto editável
        para o nome do treino e dois botões: um para adicionar um novo treino
        logo abaixo ("+") e outro para remover este dia ("–"). O nome do
        treino pode ser editado pelo usuário conforme requerido. O botão de
        exclusão remove todo o dia, e o botão de adição insere um dia em
        branco logo após o atual.
      */
      const header = document.createElement('div');
      header.className = 'training-header';
      // Label "TREINO X"
      const label = document.createElement('span');
      label.className = 'training-label';
      label.textContent = `TREINO ${dayIndex + 1}`;
      // Campo para nome do treino (editável)
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'training-name';
      titleInput.value = training.name || `Treino ${dayIndex + 1}`;
      // Botão para adicionar novo treino logo abaixo
      const addDayBtn = document.createElement('button');
      addDayBtn.type = 'button';
      addDayBtn.className = 'btn add-day-btn';
      addDayBtn.textContent = '+';
      addDayBtn.title = 'Adicionar novo treino abaixo';
      addDayBtn.addEventListener('click', () => {
        const parent = day.parentElement;
        const idx = dayNodes.indexOf(day);
        const newIdx = idx + 1;
        // Cria exercícios padrão usando baseSix para garantir ao menos uma estrutura básica
        const exs = baseSix('Aquecimento').map((ex) => {
          // Para cada exercício do modelo, fazemos o parse do valor (caso exista)
          const parsed = parseExerciseValue(ex.value);
          return {
            name: ex.name || '',
            weight: '',
            series: parsed.series || '',
            rep: parsed.rep || '',
            tempo: parsed.tempo || '',
          };
        });
        const newTraining = {
          name: `Treino ${newIdx + 1}`,
          exercises: exs,
        };
        const newNode = renderTrainingDay(newTraining, newIdx);
        // Insere o novo nó no DOM após o dia atual
        parent.insertBefore(newNode, day.nextSibling);
        // Insere no array dayNodes na posição correta
        dayNodes.splice(newIdx, 0, newNode);
        // Atualiza os rótulos "TREINO X" de todos os dias
        dayNodes.forEach((node, i) => {
          const lbl = node.querySelector('.training-label');
          if (lbl) lbl.textContent = `TREINO ${i + 1}`;
        });
      });
      // Botão de deletar dia (representado por "–")
      const delDayBtn = document.createElement('button');
      delDayBtn.type = 'button';
      delDayBtn.className = 'btn del-day-btn';
      delDayBtn.textContent = '–';
      delDayBtn.title = 'Excluir este treino';
      delDayBtn.addEventListener('click', () => {
        day.remove();
        // Remove referência deste dia do array dayNodes
        dayNodes = dayNodes.filter((n) => n !== day);
        // Reindexa os rótulos "TREINO X" remanescentes
        dayNodes.forEach((item, idx) => {
          const lbl = item.querySelector('.training-label');
          if (lbl) lbl.textContent = `TREINO ${idx + 1}`;
        });
      });
      // Monta cabeçalho
      header.appendChild(label);
      header.appendChild(titleInput);
      header.appendChild(addDayBtn);
      header.appendChild(delDayBtn);
      day.appendChild(header);
      /*
        Monta a tabela de exercícios. A primeira linha é o cabeçalho fixo com
        os títulos de cada coluna. As linhas subsequentes contêm campos
        editáveis para nome, peso, séries, repetições e tempo, além dos
        botões de adicionar e remover linha. Os botões fazem parte da
        própria linha para que cada linha gerencie sua inserção e remoção.
      */
      const table = document.createElement('div');
      table.className = 'exercise-table';
      // Cabeçalho
      const headerRow = document.createElement('div');
      headerRow.className = 'exercise-row header';
      ['Nome Exercício', 'Peso', 'Séries', 'Rep.', 'min/h'].forEach((text) => {
        const cell = document.createElement('span');
        cell.textContent = text;
        headerRow.appendChild(cell);
      });
      // Adiciona células vazias para alinhar com botões de ação
      const actionPlaceholder1 = document.createElement('span');
      const actionPlaceholder2 = document.createElement('span');
      headerRow.appendChild(actionPlaceholder1);
      headerRow.appendChild(actionPlaceholder2);
      table.appendChild(headerRow);
      // Corpo da tabela
      const tbody = document.createElement('div');
      tbody.className = 'exercise-body';
      (training.exercises || []).forEach((ex) => {
        // Se o exercício no modelo tiver a propriedade value, converta-a para
        // series/rep/tempo. Caso contrário, use os campos existentes.
        let exObj = {};
        if (Object.prototype.hasOwnProperty.call(ex, 'value')) {
          const parsed = parseExerciseValue(ex.value);
          exObj = {
            name: ex.name || '',
            weight: '',
            series: parsed.series || '',
            rep: parsed.rep || '',
            tempo: parsed.tempo || '',
          };
        } else {
          exObj = {
            name: ex.name || '',
            weight: ex.weight || '',
            series: ex.series || '',
            rep: ex.rep || '',
            tempo: ex.tempo || '',
          };
        }
        tbody.appendChild(renderExerciseRow(exObj, tbody));
      });
      // Se não houver exercícios, cria ao menos uma linha em branco
      if (tbody.children.length === 0) {
        tbody.appendChild(renderExerciseRow({ name: '', weight: '', series: '', rep: '', tempo: '' }, tbody));
      }
      table.appendChild(tbody);
      day.appendChild(table);
      // Método para retornar dados atualizados deste dia
      day._getData = () => {
        const name = titleInput.value.trim() || `Treino ${dayNodes.indexOf(day) + 1}`;
        const exercises = Array.from(tbody.children)
          .filter((el) => el.classList.contains('exercise-row'))
          .map((row) => {
            const nameInput = row.querySelector('.ex-name');
            const weightInput = row.querySelector('.ex-weight');
            const seriesInput = row.querySelector('.ex-series');
            const repInput = row.querySelector('.ex-rep');
            const tempoInput = row.querySelector('.ex-tempo');
            return {
              name: nameInput.value.trim() || 'Exercício',
              weight: weightInput.value.trim() || '',
              series: seriesInput.value.trim() || '',
              rep: repInput.value.trim() || '',
              tempo: tempoInput.value.trim() || '',
            };
          });
        return { name, exercises };
      };
      return day;
    }

    // Renderiza a lista de planos
    function renderPlanList() {
      const plans = getPlans();
      if (!planListEl) return;
      planListEl.innerHTML = '';
      if (plans.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Nenhum plano cadastrado.';
        p.style.color = 'var(--light-color)';
        planListEl.appendChild(p);
        return;
      }
      plans.forEach((plan) => {
        const item = document.createElement('div');
        item.classList.add('plan-item');
        const title = document.createElement('h3');
        // Usa o objetivo ou ID como nome básico do plano
        title.textContent = plan.objective || 'Plano';
        const actions = document.createElement('div');
        actions.classList.add('plan-actions');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.classList.add('edit-btn');
        editBtn.dataset.id = plan.id;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Deletar';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.dataset.id = plan.id;
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(title);
        item.appendChild(actions);
        planListEl.appendChild(item);
      });
    }

    // Abre a interface de detalhes de um plano para edição
    function openPlanDetails(planId) {
      const plans = getPlans();
      const plan = plans.find((p) => p.id == planId);
      if (!plan || !planDetailsEl) return;

      // Preenche campos de métricas
      // Preparar formatos: display (vírgula) e numeric (ponto) para inputs number
      const alturaDisplay = (plan.height !== undefined && plan.height !== null)
        ? Number(plan.height).toFixed(2).replace('.', ',')
        : '';
      const alturaNumber = (plan.height !== undefined && plan.height !== null)
        ? Number(plan.height).toFixed(2)
        : '';

      const alturaFields = planDetailsEl.querySelectorAll('input[id*=\"altura\" i], input[name*=\"altura\" i]');
      alturaFields.forEach((field) => {
        if (field.type === 'number') {
          field.value = alturaNumber;
        } else {
          field.value = alturaDisplay;
        }
      });
      // Se nenhum campo de altura foi encontrado dentro de planDetailsEl, procura em todo o documento
      if (alturaFields.length === 0) {
        const globalAltFields = document.querySelectorAll('input[id*=\"altura\" i], input[name*=\"altura\" i]');
        globalAltFields.forEach((field) => {
          if (field.type === 'number') {
            field.value = alturaNumber;
          } else {
            field.value = alturaDisplay;
          }
        });
      }

      // Peso (display com vírgula para campos text e número com ponto para inputs number)
      const pesoDisplay = (plan.weight !== undefined && plan.weight !== null)
        ? Number(plan.weight).toFixed(2).replace('.', ',')
        : '';
      const pesoNumber = (plan.weight !== undefined && plan.weight !== null)
        ? Number(plan.weight).toFixed(2)
        : '';

      const pesoFields = planDetailsEl.querySelectorAll('input[id*=\"peso\" i], input[name*=\"peso\" i]');
      pesoFields.forEach((field) => {
        if (field.type === 'number') {
          field.value = pesoNumber;
        } else {
          field.value = pesoDisplay;
        }
      });
      // Se nenhum campo de peso foi encontrado no detalhe, procura globalmente
      if (pesoFields.length === 0) {
        const globalPesoFields = document.querySelectorAll('input[id*=\"peso\" i], input[name*=\"peso\" i]');
        globalPesoFields.forEach((field) => {
          if (field.type === 'number') {
            field.value = pesoNumber;
          } else {
            field.value = pesoDisplay;
          }
        });
      }

      // Campos explícitos adjustAltura / adjustPeso (prefer numeric format for number inputs)
      const explicitHeightField = document.getElementById('adjustAltura');
      if (explicitHeightField) {
        // If it's a number input, set numeric string (with dot). Otherwise use display string with comma.
        explicitHeightField.value = (explicitHeightField.type === 'number') ? alturaNumber : alturaDisplay;
      }
      const explicitWeightField = document.getElementById('adjustPeso');
      if (explicitWeightField) {
        explicitWeightField.value = (explicitWeightField.type === 'number') ? pesoNumber : pesoDisplay;
      }

      // Preenche o objetivo
      const ajustObjSelect = document.getElementById('adjustObjetivo');
      if (ajustObjSelect) ajustObjSelect.value = plan.objective || '';

      // Renderiza treinos existentes
      trainingsContainer.innerHTML = '';
      dayNodes = [];
      (plan.trainings || []).forEach((training, idx) => {
        const node = renderTrainingDay(training, idx);
        trainingsContainer.appendChild(node);
        dayNodes.push(node);
      });

      planDetailsEl.style.display = 'block';
      // Armazena ID do plano atualmente em edição
      planDetailsEl.dataset.currentId = plan.id;
    }

    // Listeners de clique para editar e deletar
    if (planListEl) {
      planListEl.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
          const planId = target.dataset.id;
          openPlanDetails(planId);
        }
        if (target.classList.contains('delete-btn')) {
          const planId = target.dataset.id;
          if (confirm('Tem certeza que deseja deletar este plano?')) {
            let plans = getPlans();
            plans = plans.filter((p) => p.id != planId);
            savePlans(plans);
            renderPlanList();
          }
        }
      });
    }

    // Cancelar edição
    if (cancelAdjustBtn) {
      cancelAdjustBtn.addEventListener('click', () => {
        planDetailsEl.style.display = 'none';
      });
    }

    // Salvar alterações
    if (adjustForm) {
      adjustForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const planId = planDetailsEl.dataset.currentId;
        let plans = getPlans();
        const planIndex = plans.findIndex((p) => p.id == planId);
        if (planIndex === -1) return;
        const plan = plans[planIndex];
        // Salva a versão atual no histórico antes de modificar
        const planCopy = JSON.parse(JSON.stringify(plan));
        plan.history.push(planCopy);
        // Atualiza métricas (converte vírgula para ponto caso o usuário tenha inserido com vírgula)
        plan.height = parseFloat(document.getElementById('adjustAltura').value.toString().replace(',', '.'));
        plan.weight = parseFloat(document.getElementById('adjustPeso').value.toString().replace(',', '.'));
        plan.objective = document.getElementById('adjustObjetivo').value;
        // Constrói a nova lista de treinos a partir dos elementos dinâmicos
        plan.trainings = dayNodes.map((node, idx) => node._getData());
        // Salva de volta
        plans[planIndex] = plan;
        savePlans(plans);
        alert('Plano atualizado com sucesso!');
        planDetailsEl.style.display = 'none';
        renderPlanList();
      });
    }

    // Inicializa lista
    renderPlanList();
  }

});
