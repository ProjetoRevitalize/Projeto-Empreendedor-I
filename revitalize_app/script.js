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
        errorEl.textContent = 'No campo "Nome" utilize apenas letras e espaços.';
        return;
      }

      const ageNumber = parseInt(ageInput, 10);
      if (!ageInput || isNaN(ageNumber) || ageNumber <= 0 || /[^0-9]/.test(ageInput)) {
        errorEl.textContent = 'No campo "Idade", utilize apenas caracteres numéricos inteiros.';
        return;
      }

      if (!genderInput) {
        errorEl.textContent = 'Selecione uma opção de gênero.';
        return;
      }

      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(email)) {
        errorEl.textContent = 'No campo "E-mail" há caracteres inválidos.';
        return;
      }

      const users = getUsers();
      const emailExists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        errorEl.textContent = 'E-mail informado já está cadastrado em nosso banco de dados.';
        return;
      }

      const errors = [];
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
        errorEl.textContent = errors.join(" ");
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
        // Fallback: exibe o código em um alerta para simular envio
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
        // Código correto: decide entre fluxo de cadastro ou login
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
          // Se estivermos usando API, o usuário já foi salvo em currentUser no passo de login.
          // Para localStorage, salvamos aqui também para manter compatibilidade.
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

  /* Link de recuperação de senha */
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      alert(
        'Recuperação de senha ainda não implementada neste protótipo. Por favor, cadastre-se novamente ou contate o suporte.'
      );
    });
  }

  /* ====================
     Funções auxiliares para planos de treino
     ====================
     Os planos são armazenados em localStorage com a chave 'revitalizePlans'.
     Cada plano possui um id único (timestamp), métricas (altura, peso, objetivo),
     uma lista de treinos (com nomes e exercícios) e um histórico de versões
     antigas para possibilitar reversões.  */
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

  /* Funções auxiliares para histórico de IMC. Cada entrada contém
     data, peso, altura, valor calculado e classificação. */
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

  /* ====================
     Página Home
     ====================
     A home exibe uma saudação ao usuário logado e botões para navegar
     entre as funcionalidades principais (criar plano, ajustar plano,
     monitoramento e calculadora IMC). Também possui um botão de sair
     que remove o usuário da sessão e retorna à tela de login. */
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
      greeting.textContent = `Olá, ${user.name}`;
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
     Página Criar Plano (plan.html)
     ====================
     Esta página coleta altura, peso e objetivo do usuário e gera
     automaticamente um plano de treino padrão com três treinos (A, B, C).
     Os dados são validados e armazenados em localStorage.  */
  if (document.body.classList.contains('plan')) {
    const backBtn = document.getElementById('backHomeFromPlan');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
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
        // Valida altura e peso como números positivos (duas casas decimais são permitidas via step)
        const alturaNum = parseFloat(alturaVal);
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

  /* ====================
     Página Ajustar Plano (adjust.html)
     ====================
     Permite listar, editar e deletar planos existentes. Ao editar um
     plano, o usuário pode ajustar métricas e exercícios; a versão
     anterior é armazenada no histórico do plano para possível reversão. */
  if (document.body.classList.contains('adjust')) {
    const backBtn = document.getElementById('backHomeFromAdjust');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
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

  /* ====================
     Página Monitoramento (monitoring.html)
     ====================
     Exibe abas para cada plano e módulos para relatório e nutrição.
     Os dados de progresso são mostrados de forma resumida. O botão
     'Exportar Relatório' gera um arquivo PDF simples com as métricas. */
  if (document.body.classList.contains('monitoring')) {
    const backBtn = document.getElementById('backHomeFromMonitoring');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
    }
    const monitorTabs = document.getElementById('monitorTabs');
    const exportBtn = document.getElementById('exportReportBtn');
    const reportCard = document.getElementById('reportCard');
    const nutritionCard = document.getElementById('nutritionCard');
    const plans = getPlans();
    // Função para calcular métricas básicas de um plano
    function calculateMetrics(plan) {
      const originalWeight = plan.history.length ? plan.history[0].weight : plan.weight;
      const currentWeight = plan.weight;
      const diff = (currentWeight - originalWeight).toFixed(1);
      return {
        originalWeight,
        currentWeight,
        diff,
        objective: plan.objective,
      };
    }
    // Renderiza abas de planos
    function renderTabs() {
      if (!monitorTabs) return;
      monitorTabs.innerHTML = '';
      plans.forEach((plan, index) => {
        const tab = document.createElement('div');
        tab.classList.add('tab');
        if (index === 0) tab.classList.add('active');
        tab.textContent = `Plano ${index + 1}`;
        tab.dataset.index = index;
        monitorTabs.appendChild(tab);
      });
    }
    // Exibe métricas do plano atual ao clicar no cartão de relatório
    function showReport(index) {
      const plan = plans[index];
      if (!plan) {
        alert('Nenhum plano selecionado.');
        return;
      }
      const metrics = calculateMetrics(plan);
      const message = `Relatório do Plano\n\n` +
        `Peso inicial: ${metrics.originalWeight} kg\n` +
        `Peso atual: ${metrics.currentWeight} kg\n` +
        `Diferença de peso: ${metrics.diff} kg\n` +
        `Objetivo: ${metrics.objective}`;
      alert(message);
    }
    // Exibe placeholder para nutrição e suplementação
    function showNutrition() {
      alert('Módulo de Nutrição e Suplementação em desenvolvimento.');
    }
    // Exporta relatório como PDF usando jsPDF, caso disponível, ou gera um texto simples
    function exportReport() {
      if (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text('Relatório de Monitoramento', 10, 10);
        let y = 20;
        plans.forEach((plan, i) => {
          const metrics = calculateMetrics(plan);
          doc.text(`Plano ${i + 1}`, 10, y);
          y += 6;
          doc.setFontSize(11);
          doc.text(`Peso inicial: ${metrics.originalWeight} kg`, 12, y);
          y += 5;
          doc.text(`Peso atual: ${metrics.currentWeight} kg`, 12, y);
          y += 5;
          doc.text(`Diferença de peso: ${metrics.diff} kg`, 12, y);
          y += 5;
          doc.text(`Objetivo: ${metrics.objective}`, 12, y);
          y += 8;
          doc.setFontSize(14);
        });
        doc.save('relatorio_monitoramento.pdf');
      } else {
        // Fallback: gera arquivo de texto
        let content = 'Relatório de Monitoramento\n\n';
        plans.forEach((plan, i) => {
          const metrics = calculateMetrics(plan);
          content += `Plano ${i + 1}\n`;
          content += `Peso inicial: ${metrics.originalWeight} kg\n`;
          content += `Peso atual: ${metrics.currentWeight} kg\n`;
          content += `Diferença de peso: ${metrics.diff} kg\n`;
          content += `Objetivo: ${metrics.objective}\n\n`;
        });
        const blob = new Blob([content], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'relatorio_monitoramento.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
    renderTabs();
    // Eventos das abas
    if (monitorTabs) {
      monitorTabs.addEventListener('click', (e) => {
        const tabEl = e.target;
        if (tabEl.classList.contains('tab')) {
          // ativa/desativa
          monitorTabs.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
          tabEl.classList.add('active');
        }
      });
    }
    if (reportCard) {
      reportCard.addEventListener('click', () => {
        const activeTab = monitorTabs.querySelector('.tab.active');
        const index = activeTab ? parseInt(activeTab.dataset.index) : 0;
        showReport(index);
      });
    }
    if (nutritionCard) {
      nutritionCard.addEventListener('click', () => {
        showNutrition();
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportReport();
      });
    }
  }

  /* ====================
     Página Calculadora IMC (imc.html)
     ====================
     Permite calcular o IMC informando peso e altura, exibe o resultado
     e a classificação e armazena cada cálculo no histórico. Também
     exibe o histórico a pedido do usuário.  */
  if (document.body.classList.contains('imc')) {
    const backBtn = document.getElementById('backHomeFromImc');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.history.back();
      });
    }
    const pesoInput = document.getElementById('pesoImc');
    const alturaInput = document.getElementById('alturaImc');
    // Novos campos opcionais para idade e sexo, conforme atualizado no documento
    const idadeInput = document.getElementById('idadeImc');
    const sexoInputs = document.querySelectorAll('input[name="sexoImc"]');
    const calcularBtn = document.getElementById('calcularImcBtn');
    const historyBtn = document.getElementById('imcHistoryBtn');
    const limparBtn = document.getElementById('limparImcBtn');
    const resultEl = document.getElementById('imcResult');
    const errorEl = document.getElementById('imcError');
    // Calcula e classifica o IMC
    function calcularImc() {
      // Recupera valores numéricos
      const peso = parseFloat(pesoInput.value);
      const altura = parseFloat(alturaInput.value);
      const idade = idadeInput ? parseInt(idadeInput.value) : null;
      // Determina sexo selecionado (ou null se nenhum)
      let sexo = null;
      sexoInputs.forEach((input) => {
        if (input.checked) sexo = input.value;
      });
      errorEl.textContent = '';
      resultEl.textContent = '';
      // Valida peso e altura como números positivos
      if (!peso || peso <= 0) {
        errorEl.textContent = 'No campo "Peso", utilize apenas caracteres numéricos positivos com duas casas decimais.';
        return;
      }
      if (!altura || altura <= 0) {
        errorEl.textContent = 'No campo "Altura", utilize apenas caracteres numéricos positivos com duas casas decimais.';
        return;
      }
      // Se idade foi fornecida, valida positivo
      if (idadeInput && idadeInput.value && (isNaN(idade) || idade <= 0)) {
        errorEl.textContent = 'No campo "Idade", utilize apenas caracteres numéricos inteiros positivos.';
        return;
      }
      // Se sexo é obrigatório, mas opcional aqui - você pode adicionar validação se precisar
      // Calcula IMC
      const imc = peso / (altura * altura);
      const imcFixed = parseFloat(imc.toFixed(1));
      // Classificação baseada em faixas clássicas de IMC (WHO)
      let classificacao = '';
      if (imcFixed < 18.5) {
        classificacao = 'Abaixo do peso';
      } else if (imcFixed < 25) {
        classificacao = 'Peso normal';
      } else if (imcFixed < 30) {
        classificacao = 'Sobrepeso';
      } else if (imcFixed < 35) {
        classificacao = 'Obesidade Grau I';
      } else if (imcFixed < 40) {
        classificacao = 'Obesidade Grau II';
      } else {
        classificacao = 'Obesidade Grau III';
      }
      resultEl.textContent = `Seu IMC é: ${imcFixed}  —  ${classificacao}`;
      // Salva no histórico (local ou via API) incluindo idade e sexo se disponíveis
      if (USE_API) {
        const userStr = sessionStorage.getItem('currentUser');
        const userObj = userStr ? JSON.parse(userStr) : null;
        if (userObj && userObj.id) {
          apiAddImcEntry({
            user_id: userObj.id,
            peso,
            altura,
            idade: idade || null,
            sexo: sexo || null,
            valor: imcFixed,
            classificacao,
          }).catch((err) => {
            console.error('Erro ao salvar IMC no servidor', err);
          });
        }
      } else {
        const history = getImcHistory();
        history.push({
          date: new Date().toLocaleString(),
          peso,
          altura,
          idade: idade || null,
          sexo: sexo || null,
          valor: imcFixed,
          classificacao,
        });
        saveImcHistory(history);
      }
    }
    if (calcularBtn) {
      calcularBtn.addEventListener('click', () => {
        calcularImc();
      });
    }
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        if (USE_API) {
          const userStr = sessionStorage.getItem('currentUser');
          const userObj = userStr ? JSON.parse(userStr) : null;
          if (!userObj || !userObj.id) {
            alert('Nenhum usuário logado.');
            return;
          }
          apiGetImcHistory(userObj.id)
            .then((history) => {
              if (!history || history.length === 0) {
                alert('Nenhum cálculo de IMC foi realizado ainda.');
                return;
              }
              let message = 'Histórico de IMC\n\n';
              history.forEach((entry, index) => {
                let line = `${index + 1}. ${new Date(entry.date).toLocaleString()} - IMC: ${entry.valor} (${entry.classificacao})`;
                if (entry.idade) line += ` - Idade: ${entry.idade}`;
                if (entry.sexo) line += ` - Sexo: ${entry.sexo}`;
                message += line + '\n';
              });
              alert(message);
            })
            .catch((err) => {
              alert('Erro ao obter histórico: ' + err.message);
            });
        } else {
          const history = getImcHistory();
          if (history.length === 0) {
            alert('Nenhum cálculo de IMC foi realizado ainda.');
            return;
          }
          let message = 'Histórico de IMC\n\n';
          history.forEach((entry, index) => {
            let line = `${index + 1}. ${entry.date} - IMC: ${entry.valor} (${entry.classificacao})`;
            if (entry.idade) line += ` - Idade: ${entry.idade}`;
            if (entry.sexo) line += ` - Sexo: ${entry.sexo}`;
            message += line + '\n';
          });
          alert(message);
        }
      });
    }
    if (limparBtn) {
      limparBtn.addEventListener('click', () => {
        pesoInput.value = '';
        alturaInput.value = '';
        resultEl.textContent = '';
        errorEl.textContent = '';
      });
    }
  }
});