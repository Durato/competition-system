// Se o usuário já estiver logado, redireciona para o app
if (localStorage.getItem("token")) {
  window.location.href = "app.html";
}

const API = Config.API_URL; // Usa a configuração centralizada

// ---------------- MODAL ----------------
function openModal(type) {
  document.getElementById(type + "Modal").style.display = "flex";
}
function closeModal(type) {
  document.getElementById(type + "Modal").style.display = "none";
}

// ---------------- TOASTS ----------------
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Remove após 4 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ---------------- LOGIN ----------------
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("loginMessage").innerText = data.error || "Erro no login";
      return;
    }

    localStorage.setItem("token", data.token);
    // Redireciona para a página da aplicação
    window.location.href = "app.html";
  } catch (error) {
    document.getElementById("loginMessage").innerText = "Erro de conexão com o servidor";
  }
}

// ---------------- REGISTER ----------------
async function handleRegister(e) {
  e.preventDefault();

  // Bloqueia botão para evitar duplo clique
  const btn = e.target.querySelector('button');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = "Cadastrando...";

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const birthdate = document.getElementById("registerBirthdate").value;
  const phone = document.getElementById("registerPhone").value;
  const photoInput = document.getElementById("registerPhoto");

  // --- VALIDAÇÃO ROBUSTA (Task 2.1) ---
  if (!Validators.email(email)) {
    document.getElementById("registerMessage").innerText = "Email inválido.";
    document.getElementById("registerMessage").style.color = "#f87171";
    btn.disabled = false;
    btn.innerText = originalText;
    return;
  }

  // Exige senha forte (8 chars, letras e números)
  if (!Validators.password(password)) {
    document.getElementById("registerMessage").innerText = "Senha fraca: Mínimo 8 caracteres, com letras e números.";
    document.getElementById("registerMessage").style.color = "#f87171";
    btn.disabled = false;
    btn.innerText = originalText;
    return;
  }

  const photoCheck = Validators.file(photoInput);
  if (!photoCheck.valid) {
    document.getElementById("registerMessage").innerText = photoCheck.error;
    document.getElementById("registerMessage").style.color = "#f87171";
    btn.disabled = false;
    btn.innerText = originalText;
    return;
  }
  // -------------------------------------

  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("password", password);
  formData.append("birthdate", birthdate);
  formData.append("phone", phone);
  if (photoInput.files[0]) formData.append("photo", photoInput.files[0]);

  try {
    const res = await fetch(API + "/auth/register", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      showToast("Conta criada com sucesso!", "success");
      closeModal("register");
      openModal("login");
    } else {
      document.getElementById("registerMessage").innerText = data.error || "Erro ao criar conta";
      document.getElementById("registerMessage").style.color = "#f87171";
      showToast(data.error || "Erro ao criar conta", "error");
    }
  } catch (err) {
    showToast("Erro de conexão", "error");
  } finally {
    // Restaura o botão
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

// ---------------- AUTO LOGIN ----------------
window.onload = async () => {
  // Carrega apenas os dados públicos da landing page
  loadCategoriesAndRobots();
  loadPublicTeams();
  loadPaidCount();
};

async function loadPaidCount() {
  try {
    const res = await fetch(API + "/payments/count");
    if (res.ok) {
      const data = await res.json();
      document.getElementById("paidCountDisplay").innerText = data.count;
    }
  } catch (error) {
    console.error("Erro ao carregar contagem de inscritos:", error);
  }
}

async function loadPublicTeams() {
  // Tenta buscar todas as equipes. 
  // Nota: Se o backend exigir autenticação para /teams, essa chamada pode falhar ou precisar de uma rota específica (ex: /teams/public)
  try {
    const res = await fetch(`${API}/teams/public`);
    if (!res.ok) return;
    
    const teams = await res.json();
    const container = document.getElementById("publicTeamsList");
    if (!container) return;
    
    container.innerHTML = "";

    // Duplica a lista para criar o efeito de loop infinito perfeito
    const teamsToRender = [...teams, ...teams];

    teamsToRender.forEach(t => {
      const div = document.createElement("div");
      div.className = "team-public-card";
      
      // Se não tiver foto, usa um placeholder ou não mostra nada
      const imgSrc = t.photo ? `${API}/uploads/${t.photo}` : "https://via.placeholder.com/100?text=Equipe";
      
      // Refatorado para evitar XSS em t.name e t.institution
      const img = document.createElement("img");
      img.src = imgSrc;
      img.className = "team-public-photo";
      
      const nameDiv = document.createElement("div");
      nameDiv.style.fontWeight = "bold";
      nameDiv.style.color = "var(--text)";
      nameDiv.textContent = t.name; // SEGURO

      div.appendChild(img);
      div.appendChild(nameDiv);

      if (t.institution) {
        const instDiv = document.createElement("div");
        instDiv.style.fontSize = "0.8rem";
        instDiv.style.color = "#aaa";
        instDiv.textContent = t.institution; // SEGURO
        div.appendChild(instDiv);
      }
      
      container.appendChild(div);
    });
  } catch (error) {
    console.error("Erro ao carregar equipes públicas:", error);
  }
}

async function loadCategoriesAndRobots() {
  // Prepara headers (envia token se tiver, senão vai sem)
  const headers = {}; // Chamada pública, sem token
  const resCategories = await fetch(`${API}/categories`, { headers });
  const categories = await resCategories.json();

  // Vamos preencher tanto o do dashboard quanto o da landing page (se existirem)
  const containers = [
    document.getElementById("robotsByCategory"),
    document.getElementById("publicRobotsDisplay")
  ];

  // Limpa containers
  containers.forEach(el => { if (el) el.innerHTML = ""; });

  for (const cat of categories) {
    // Buscar todos os robôs dessa categoria com nome da equipe
    const resRobots = await fetch(`${API}/robots/category/${cat.id}`, { headers });
    const robots = await resRobots.json();

    // FILTRO: Apenas robôs pagos aparecem na lista pública
    const paidRobots = robots.filter(r => r.is_paid);

    // Cria o card HTML
    const createCard = () => {
      const catCard = document.createElement("div");
      catCard.className = "category-card";

      const catTitle = document.createElement("h3");
      catTitle.textContent = `${cat.name} (${paidRobots.length}/${cat.robot_limit})`;
      catCard.appendChild(catTitle);

      const ul = document.createElement("ul");
      if (paidRobots.length === 0) {
        const li = document.createElement("li");
        li.innerText = "Nenhum robô confirmado";
        ul.appendChild(li);
      } else {
        paidRobots.forEach(r => {
          const li = document.createElement("li");
          li.style.justifyContent = "flex-start"; // Alinha imagem e texto à esquerda
          
          if (r.photo) {
            const img = document.createElement("img");
            img.src = `${API}/uploads/${r.photo}`;
            img.className = "robot-thumb";
            li.appendChild(img);
          }

          const span = document.createElement("span");
          span.textContent = `${r.name} — ${r.team_name}`; // SEGURO
          li.appendChild(span);
          
          ul.appendChild(li);
        });
      }
      catCard.appendChild(ul);
      return catCard;
    };

    // Adiciona o card em todos os containers disponíveis
    containers.forEach(el => {
      if (el) el.appendChild(createCard());
    });
  }
}