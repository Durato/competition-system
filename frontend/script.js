const API = "http://localhost:3000";
let currentTeam = null;

// ---------------- MODAL ----------------
function openModal(type) {
  document.getElementById(type + "Modal").style.display = "flex";
}
function closeModal(type) {
  document.getElementById(type + "Modal").style.display = "none";
}

// ---------------- LOGIN ----------------
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

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
  document.getElementById("userName").innerText = data.user.name;

  closeModal("login");
  showDashboard();
  loadTeams();
  loadCategories();
  loadCategoriesAndRobots();
}

// ---------------- REGISTER ----------------
async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const birthdate = document.getElementById("registerBirthdate").value;
  const phone = document.getElementById("registerPhone").value;
  const photoInput = document.getElementById("registerPhoto");

  const formData = new FormData();
  formData.append("name", name);
  formData.append("email", email);
  formData.append("password", password);
  formData.append("birthdate", birthdate);
  formData.append("phone", phone);
  if (photoInput.files[0]) formData.append("photo", photoInput.files[0]);

  const res = await fetch(API + "/auth/register", {
    method: "POST",
    // Não definir Content-Type com FormData
    body: formData
  });

  const data = await res.json();

  if (res.ok) {
    document.getElementById("registerMessage").innerText = "Conta criada! Faça login.";
    document.getElementById("registerMessage").style.color = "#4ade80";
    setTimeout(() => {
      closeModal("register");
      openModal("login");
    }, 1500);
  } else {
    document.getElementById("registerMessage").innerText = data.error || "Erro ao criar conta";
    document.getElementById("registerMessage").style.color = "#f87171";
  }
}

// ---------------- DASHBOARD ----------------
function showDashboard() {
  document.getElementById("landing").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
}

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

// ---------------- TEAMS ----------------
async function loadTeams() {
  const res = await fetch(API + "/teams", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const teams = await res.json();
  const teamSection = document.getElementById("teamSection");
  teamSection.innerHTML = "";

  if (!teams.length) {
    teamSection.innerHTML = "<p>Você não faz parte de nenhuma equipe</p>";
    return;
  }

  teams.forEach(team => {
    const btn = document.createElement("button");
    btn.innerText = team.name;
    btn.onclick = () => {
      // Remove classe active dos outros botões
      Array.from(teamSection.children).forEach(b => b.classList.remove("active"));
      // Adiciona ao clicado
      btn.classList.add("active");
      selectTeam(team.id, team.is_leader);
    };
    teamSection.appendChild(btn);
  });
}

// ---------------- CREATE TEAM ----------------
async function handleCreateTeam(e) {
  e.preventDefault();

  const nameInput = document.getElementById("teamName");
  const institutionInput = document.getElementById("teamInstitution");
  const photoInput = document.getElementById("teamPhoto");
  const messageEl = document.getElementById("createTeamMessage");

  const formData = new FormData();
  formData.append("name", nameInput.value);
  formData.append("institution", institutionInput.value);
  if (photoInput.files[0]) formData.append("photo", photoInput.files[0]);

  const res = await fetch(API + "/teams", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: formData
  });

  const data = await res.json();

  if (res.ok) {
    messageEl.innerText = "Equipe criada com sucesso!";
    messageEl.style.color = "#4ade80";
    nameInput.value = "";
    institutionInput.value = "";
    photoInput.value = "";
    loadTeams(); // Atualiza a lista lateral
  } else {
    messageEl.innerText = data.error || "Erro ao criar equipe";
    messageEl.style.color = "#f87171";
  }
}

// ---------------- SELECT TEAM ----------------
function selectTeam(teamId, isLeader) {
  currentTeam = teamId;

  document.getElementById("membersSection").style.display = "block";
  document.getElementById("teamRobotsSection").style.display = "block";
  
  // Mostra/Esconde seções baseadas na permissão de líder
  document.getElementById("addMemberArea").style.display = isLeader ? "block" : "none";
  document.getElementById("robotSection").style.display = isLeader ? "block" : "none";
  document.getElementById("paymentSection").style.display = isLeader ? "block" : "none";

  loadMembers();
  loadRobots();
  loadPaymentData(); // Carrega dados de pagamento
}

// ---------------- MEMBERS ----------------
async function loadMembers() {
  const res = await fetch(`${API}/teams/${currentTeam}/members`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const members = await res.json();
  
  if (!res.ok) {
    console.error("Erro ao carregar membros:", members);
    return;
  }

  const membersList = document.getElementById("membersList");
  membersList.innerHTML = "";

  members.forEach(m => {
    const li = document.createElement("li");
    
    // Status de pagamento visual
    const status = m.is_paid 
      ? '<span style="color:#4ade80; font-size:0.8rem; border:1px solid #4ade80; padding:2px 6px; border-radius:4px;">PAGO</span>' 
      : '<span style="color:#f87171; font-size:0.8rem;">PENDENTE</span>';

    const photoHtml = m.photo 
      ? `<img src="${API}/uploads/${m.photo}" class="member-thumb" alt="${m.name}">` 
      : '';

    li.innerHTML = `
      <div style="display:flex; align-items:center;">
        ${photoHtml}
        <span>${m.name} (${m.role})</span>
      </div>
      ${status}
    `;
    membersList.appendChild(li);
  });
}

// ---------------- ADD MEMBER ----------------
async function handleAddMember(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById("memberEmail");
  const messageEl = document.getElementById("memberMessage");
  messageEl.innerText = "Adicionando...";
  messageEl.style.color = "#ccc";

  try {
    const res = await fetch(`${API}/teams/${currentTeam}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ email: emailInput.value })
    });

    const data = await res.json();
    console.log("Resposta do servidor:", data); // Verifique isso no F12 se der erro

    if (res.ok) {
      messageEl.innerText = data.message || "Membro adicionado!";
      messageEl.style.color = "#4ade80"; // Verde
      emailInput.value = "";
      loadMembers();
    } else {
      messageEl.innerText = data.error || "Erro ao adicionar.";
      messageEl.style.color = "#f87171"; // Vermelho
    }
  } catch (err) {
    console.error(err);
    messageEl.innerText = "Erro na comunicação com o servidor.";
    messageEl.style.color = "#f87171";
  }
}

// ---------------- ROBOTS ----------------
async function loadRobots() {
  const res = await fetch(`${API}/teams/${currentTeam}/robots`, {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const robots = await res.json();

  if (!res.ok) {
    console.error("Erro ao carregar robôs:", robots);
    return;
  }

  const teamRobotsList = document.getElementById("teamRobotsList");
  teamRobotsList.innerHTML = "";

  if (!robots.length) {
    teamRobotsList.innerHTML = "<li>Nenhum robô cadastrado</li>";
    return;
  }

  robots.forEach(r => {
    const li = document.createElement("li");
    
    const status = r.is_paid 
      ? '<span style="color:#4ade80; font-size:0.8rem; border:1px solid #4ade80; padding:2px 6px; border-radius:4px;">PAGO</span>' 
      : '<span style="color:#f87171; font-size:0.8rem;">PENDENTE</span>';

    const photoHtml = r.photo 
      ? `<img src="${API}/uploads/${r.photo}" class="robot-thumb" alt="${r.name}" style="width: 50px; height: 50px;">` 
      : '';

    li.innerHTML = `
      <div style="display:flex; align-items:center;">
        ${photoHtml}
        <span>${r.name} — ${r.category}</span>
      </div>
      ${status}
    `;
    teamRobotsList.appendChild(li);
  });
}

// ---------------- CATEGORIES ----------------
async function loadCategories() {
  const res = await fetch(API + "/categories", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const categories = await res.json();
  const robotCategory = document.getElementById("robotCategory");
  robotCategory.innerHTML = "<option value=''>Selecione categoria</option>";

  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.innerText = c.name;
    robotCategory.appendChild(opt);
  });
}

// ---------------- CREATE ROBOT ----------------
async function handleCreateRobot(e) {
  e.preventDefault();

  const name = document.getElementById("robotName").value;
  const category = document.getElementById("robotCategory").value;
  const photoInput = document.getElementById("robotPhoto");

  const formData = new FormData();
  formData.append("name", name);
  formData.append("categoryId", category);
  formData.append("teamId", currentTeam);
  if (photoInput.files[0]) {
    formData.append("photo", photoInput.files[0]);
  }

  const res = await fetch(API + "/robots", {
    method: "POST",
    headers: {
      // Não defina Content-Type aqui, o browser define automaticamente como multipart/form-data
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: formData
  });

  const data = await res.json();
  
  if (res.ok) {
    document.getElementById("robotMessage").innerText = "Robô cadastrado com sucesso!";
    document.getElementById("robotMessage").style.color = "#4ade80"; // Verde
    loadRobots();
  } else {
    document.getElementById("robotMessage").innerText = data.error || "Erro ao cadastrar";
    document.getElementById("robotMessage").style.color = "#f87171"; // Vermelho
  }
}

// ---------------- AUTO LOGIN ----------------
window.onload = () => {
  // Carrega as categorias e robôs (público)
  loadCategoriesAndRobots();
  loadPublicTeams();
  loadPaidCount();

  if (localStorage.getItem("token")) {
    showDashboard();
    loadTeams();
    loadCategories();
  }
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
      
      div.innerHTML = `
        <img src="${imgSrc}" alt="${t.name}" class="team-public-photo" />
        <div style="font-weight:bold; color:var(--text);">${t.name}</div>
        ${t.institution ? `<div style="font-size:0.8rem; color:#aaa;">${t.institution}</div>` : ''}
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error("Erro ao carregar equipes públicas:", error);
  }
}

async function loadCategoriesAndRobots() {
  // Prepara headers (envia token se tiver, senão vai sem)
  const headers = {};
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = "Bearer " + token;

  const resCategories = await fetch(`${API}/categories`, { headers });
  const categories = await resCategories.json();

  // Vamos preencher tanto o do dashboard quanto o da landing page (se existirem)
  const containers = [
    document.getElementById("robotsByCategory"),
    document.getElementById("publicRobotsDisplay")
  ];

  // Limpa containers
  containers.forEach(el => { if(el) el.innerHTML = ""; });

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
      catTitle.innerText = `${cat.name} (${paidRobots.length}/${cat.robot_limit})`;
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
          span.innerText = `${r.name} — ${r.team_name}`;
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

// ---------------- PAYMENTS ----------------
let paymentMembers = [];
let paymentRobots = [];

async function loadPaymentData() {
  // Reutiliza as rotas de listar para pegar os dados
  const [resMembers, resRobots] = await Promise.all([
    fetch(`${API}/teams/${currentTeam}/members`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } }),
    fetch(`${API}/teams/${currentTeam}/robots`, { headers: { Authorization: "Bearer " + localStorage.getItem("token") } })
  ]);

  if (!resMembers.ok || !resRobots.ok) {
    console.error("Erro ao carregar dados para pagamento.");
    return;
  }

  const members = await resMembers.json();
  const robots = await resRobots.json();

  const list = document.getElementById("paymentList");
  list.innerHTML = "";

  // Filtra apenas quem NÃO pagou
  const unpaidMembers = members.filter(m => !m.is_paid);
  const unpaidRobots = robots.filter(r => !r.is_paid);

  if (unpaidMembers.length === 0 && unpaidRobots.length === 0) {
    list.innerHTML = "<p style='text-align:center; color:#4ade80;'>Tudo pago! 🎉</p>";
    updateTotal();
    return;
  }

  // Renderiza Membros (R$ 55)
  unpaidMembers.forEach(m => {
    const div = document.createElement("div");
    div.className = "payment-item";
    div.innerHTML = `
      <input type="checkbox" class="pay-checkbox" data-type="member" data-id="${m.id}" data-price="55" onchange="updateTotal()">
      <div>
        <strong>${m.name}</strong> (Membro)<br>
        <small style="color:#aaa;">R$ 55,00</small>
      </div>
    `;
    list.appendChild(div);
  });

  // Renderiza Robôs (R$ 20)
  unpaidRobots.forEach(r => {
    const div = document.createElement("div");
    div.className = "payment-item";
    div.innerHTML = `
      <input type="checkbox" class="pay-checkbox" data-type="robot" data-id="${r.id}" data-price="20" onchange="updateTotal()">
      <div>
        <strong>${r.name}</strong> (Robô)<br>
        <small style="color:#aaa;">R$ 20,00</small>
      </div>
    `;
    list.appendChild(div);
  });

  updateTotal();
}

function updateTotal() {
  const checkboxes = document.querySelectorAll(".pay-checkbox:checked");
  let total = 0;
  checkboxes.forEach(cb => {
    total += parseFloat(cb.dataset.price);
  });
  document.getElementById("totalPrice").innerText = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

async function handleCheckout() {
  const checkboxes = document.querySelectorAll(".pay-checkbox:checked");
  const memberIds = Array.from(checkboxes).filter(c => c.dataset.type === 'member').map(c => c.dataset.id);
  const robotIds = Array.from(checkboxes).filter(c => c.dataset.type === 'robot').map(c => c.dataset.id);

  if (memberIds.length === 0 && robotIds.length === 0) return alert("Selecione pelo menos um item.");

  const res = await fetch(`${API}/payments/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
    body: JSON.stringify({ teamId: currentTeam, memberIds, robotIds })
  });

  const data = await res.json();
  if (data.init_point) window.location.href = data.init_point;
  else alert(data.error || "Erro ao gerar pagamento");
}
