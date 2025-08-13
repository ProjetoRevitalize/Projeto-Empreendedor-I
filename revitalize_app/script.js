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
  const verifyCodeButton = document.getElementById('verifyCodeButton');
  if (verifyCodeButton) {
    verifyCodeButton.addEventListener('click', () => {
      const enteredCode = document.getElementById('twoFactorCode').value.trim();
      const storedCode = sessionStorage.getItem('twoFactorCode');
      const errorEl = document.getElementById('twoFactorError');
      if (!storedCode) {
        errorEl.textContent = 'Erro interno. Por favor, faça login novamente.';
        return;
      }
      if (enteredCode === storedCode) {
        sessionStorage.removeItem('twoFactorCode');
        errorEl.textContent = '';
        if (verificationMode === 'register') {
          // Finaliza cadastro após confirmação do código
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
}});
