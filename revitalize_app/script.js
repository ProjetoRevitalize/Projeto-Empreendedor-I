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

  /* Verificação do código de autenticação de dois fatores ou cancelamento */
  const verifyRegisgterButton = document.getElementById('verifyRegisgterButton');
  if (verifyRegisgterButton) {
    // Se estivermos na página de cadastro (registerForm existe), este botão serve para
    // confirmar o código e finalizar o cadastro. Caso contrário (página de login),
    // ele atua como botão de cancelar.
    if (document.getElementById('registerForm')) {
      // Página de cadastro: verifica o código e conclui o registro
      verifyRegisgterButton.addEventListener('click', () => {
        const enteredCode = document.getElementById('twoFactorCode').value.trim();
        const storedCode = sessionStorage.getItem('twoFactorCode');
        const errorEl = document.getElementById('twoFactorError');
        if (!storedCode) {
          if (errorEl) errorEl.textContent = 'Erro interno. Por favor, tente novamente.';
          return;
        }
        if (enteredCode === storedCode) {
          // Código correto para cadastro
          sessionStorage.removeItem('twoFactorCode');
          if (errorEl) errorEl.textContent = '';
          const userObj = pendingRegistrationUser;
          pendingRegistrationUser = null;
          verificationMode = null;
          if (!userObj) {
            if (errorEl) errorEl.textContent = 'Erro interno. Por favor, tente novamente.';
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
                if (errorEl) errorEl.textContent = err.message;
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
          // Código incorreto
          if (errorEl) errorEl.textContent = 'Código inválido. Por favor, tente novamente.';
        }
      });
    } else {
      // Página de login: usa este botão como cancelar
      verifyRegisgterButton.addEventListener('click', () => {
        // Remove qualquer código de verificação pendente
        sessionStorage.removeItem('twoFactorCode');
        // Limpa estados de verificação
        verificationMode = null;
        pendingRegistrationUser = null;
        // Limpa mensagens de erro se houver
        const errorEl = document.getElementById('twoFactorError');
        if (errorEl) errorEl.textContent = '';
        // Fecha o modal de verificação
        const modal = document.getElementById('twoFactorModal');
        if (modal) modal.style.display = 'none';
      });
    }
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
    pesoInput.addEventListener('input', (e) => {
      let val = e.target.value;
      // só permite números
      val = val.replace(/\D/g, '');
      // máximo 3 dígitos
      if (val.length > 3) {
        val = val.slice(0, 3);
      }
      e.target.value = val;
    });

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
        const pesoNum = parseFloat(pesoVal);

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

        // Cria o plano
        const plans = getPlans();
        const newPlan = {
          id: Date.now(),
          height: parseFloat(alturaVal),
          weight: parseFloat(pesoVal),
          objective: objetivoVal,
          trainings: [
            {
              name: 'Treino A',
              exercises: [
                { name: 'Aquecimento', value: '15min' },
                { name: 'Exercício 1', value: '3x12' },
                { name: 'Exercício 2', value: '3x12' },
                { name: 'Exercício 3', value: '3x12' },
              ],
            },
            {
              name: 'Treino B',
              exercises: [
                { name: 'Aquecimento', value: '15min' },
                { name: 'Exercício 1', value: '3x12' },
                { name: 'Exercício 2', value: '3x12' },
                { name: 'Exercício 3', value: '3x12' },
              ],
            },
            {
              name: 'Treino C',
              exercises: [
                { name: 'Aquecimento', value: '15min' },
                { name: 'Exercício 1', value: '3x12' },
                { name: 'Exercício 2', value: '3x12' },
                { name: 'Exercício 3', value: '3x12' },
              ],
            },
          ],
          history: [],
        };
        plans.push(newPlan);
        savePlans(plans);
        alert('Plano criado com sucesso! Você poderá ajustá-lo posteriormente.');
        // Após criar, volta para a home ou abre a página de ajustes
        window.location.href = 'adjust.html';
      });
    }
  }

  /* Página Ajustar Plano */
  if (document.body.classList.contains('adjust')) {
    const backBtn = document.getElementById('backHomeFromAdjust');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = "home.html";
      });
    }
    const planListEl = document.getElementById('planList');
    const planDetailsEl = document.getElementById('planDetails');
    const planNameTitle = document.getElementById('planNameTitle');
    const adjustForm = document.getElementById('adjustForm');
    const trainingsContainer = document.getElementById('trainingsContainer');
    const cancelAdjustBtn = document.getElementById('cancelAdjust');
    const saveAdjustBtn = document.getElementById('saveAdjust');

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
      // Preenche campos
      document.getElementById('adjustAltura').value = plan.height;
      document.getElementById('adjustPeso').value = plan.weight;
      document.getElementById('adjustObjetivo').value = plan.objective;
      planNameTitle.textContent = `Plano (${plan.objective})`;
      // Renderiza treinos
      trainingsContainer.innerHTML = '';
      plan.trainings.forEach((training, tIndex) => {
        const trainingDiv = document.createElement('div');
        trainingDiv.classList.add('training-item');
        // Nome do treino
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = training.name;
        nameInput.classList.add('training-name');
        nameInput.dataset.tIndex = tIndex;
        trainingDiv.appendChild(nameInput);
        // Lista de exercícios
        const ul = document.createElement('ul');
        ul.classList.add('exercise-list');
        training.exercises.forEach((exercise, eIndex) => {
          const li = document.createElement('li');
          const nameSpan = document.createElement('span');
          nameSpan.textContent = exercise.name;
          const valueInput = document.createElement('input');
          valueInput.type = 'text';
          valueInput.value = exercise.value;
          valueInput.dataset.tIndex = tIndex;
          valueInput.dataset.eIndex = eIndex;
          valueInput.style.marginLeft = '0.5rem';
          valueInput.style.width = '80px';
          li.appendChild(nameSpan);
          li.appendChild(valueInput);
          ul.appendChild(li);
        });
        trainingDiv.appendChild(ul);
        trainingsContainer.appendChild(trainingDiv);
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
        // Atualiza métricas
        plan.height = parseFloat(document.getElementById('adjustAltura').value);
        plan.weight = parseFloat(document.getElementById('adjustPeso').value);
        plan.objective = document.getElementById('adjustObjetivo').value;
        // Atualiza treinos
        // Percorre inputs de nomes de treinos
        const nameInputs = trainingsContainer.querySelectorAll('.training-name');
        nameInputs.forEach((input) => {
          const tIndex = parseInt(input.dataset.tIndex);
          plan.trainings[tIndex].name = input.value || plan.trainings[tIndex].name;
        });
        // Atualiza valores dos exercícios
        // Seleciona os inputs de exercícios usando o atributo data-e-index (gerado via dataset.eIndex)
        const exerciseInputs = trainingsContainer.querySelectorAll('input[data-e-index]');
        exerciseInputs.forEach((input) => {
          const tIndex = parseInt(input.dataset.tIndex);
          const eIndex = parseInt(input.dataset.eIndex);
          plan.trainings[tIndex].exercises[eIndex].value = input.value || plan.trainings[tIndex].exercises[eIndex].value;
        });
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
