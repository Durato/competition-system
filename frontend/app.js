// Guarda de Segurança: Se não houver token, redireciona para a página inicial.
if (!localStorage.getItem("token")) {
  window.location.href = "index.html";
}

const API = Config.API_URL;
let currentTeam = null;

// Funções utilitárias copiadas para cá. O ideal no futuro é ter um arquivo ui.js
function openModal(type) {
  document.getElementById(type + "Modal").style.display = "flex";
}
function closeModal(type) {
  document.getElementById(type + "Modal").style.display = "none";
}
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
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
function toggleLoader(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) {
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
  } else {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 300);
  }
}
function showConfirm(title, message, onConfirm) {
  document.getElementById('confirmTitle').innerText = title;
  document.getElementById('confirmMessage').innerText = message;
  const btnYes = document.getElementById('btnConfirmYes');
  btnYes.onclick = () => {
    onConfirm();
    closeModal('confirm');
  };
  openModal('confirm');
}

function logout() {
  showConfirm("Sair do Sistema", "Tem certeza que deseja fazer logout?", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html"; // Redireciona para a landing page
  });
}

// --- WRAPPER DE SEGURANÇA PARA FETCH ---
// Intercepta todas as requisições. Se der 401 (Token Inválido), desloga.
async function authFetch(url, options = {}) {
  // Adiciona o token automaticamente
  const headers = options.headers || {};
  if (!headers.Authorization) {
    headers.Authorization = "Bearer " + localStorage.getItem("token");
  }
  options.headers = headers;

  const res = await fetch(url, options);

  if (res.status === 401) {
    // Token expirou ou é inválido
    localStorage.removeItem("token");
    window.location.href = "index.html";
    return null;
  }

  return res;
}

async function loadTeams() {
  const res = await authFetch(API + "/teams");
  if (!res) return; // Redirecionou

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
      Array.from(teamSection.children).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectTeam(team.id, team.is_leader);
    };
    teamSection.appendChild(btn);
  });
}

async function handleCreateTeam(e) {
  e.preventDefault();
  const nameInput = document.getElementById("teamName");
  const institutionInput = document.getElementById("teamInstitution");
  const photoInput = document.getElementById("teamPhoto");
  const messageEl = document.getElementById("createTeamMessage");

  if (!Validators.required(institutionInput.value)) {
    messageEl.innerText = "A instituição é obrigatória.";
    messageEl.style.color = "#f87171";
    return;
  }

  const photoCheck = Validators.file(photoInput);
  if (!photoCheck.valid) {
    messageEl.innerText = photoCheck.error;
    messageEl.style.color = "#f87171";
    return;
  }
  const formData = new FormData();
  formData.append("name", nameInput.value);
  formData.append("institution", institutionInput.value);
  if (photoInput.files[0]) formData.append("photo", photoInput.files[0]);
  const res = await authFetch(API + "/teams", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  if (res.ok) {
    messageEl.innerText = "Equipe criada com sucesso!";
    messageEl.style.color = "#4ade80";
    nameInput.value = "";
    institutionInput.value = "";
    photoInput.value = "";
    loadTeams();
  } else {
    messageEl.innerText = data.error || "Erro ao criar equipe";
    messageEl.style.color = "#f87171";
  }
}

function selectTeam(teamId, isLeader) {
  currentTeam = teamId;
  document.getElementById("membersSection").style.display = "block";
  document.getElementById("teamRobotsSection").style.display = "block";
  document.getElementById("addMemberArea").style.display = isLeader ? "block" : "none";
  document.getElementById("robotSection").style.display = isLeader ? "block" : "none";
  document.getElementById("paymentSection").style.display = isLeader ? "block" : "none";
  loadMembers();
  loadRobots();
  loadPaymentData();
}

async function loadMembers() {
  const res = await authFetch(`${API}/teams/${currentTeam}/members`);
  if (!res) return;

  const members = await res.json();
  if (!res.ok) {
    console.error("Erro ao carregar membros:", members);
    return;
  }
  const membersList = document.getElementById("membersList");
  membersList.innerHTML = "";
  members.forEach(m => {
    const li = document.createElement("li");
    const divInfo = document.createElement("div");
    divInfo.style.display = "flex";
    divInfo.style.alignItems = "center";
    if (m.photo) {
      const img = document.createElement("img");
      img.src = `${API}/uploads/${m.photo}`;
      img.className = "member-thumb";
      img.alt = "Foto do membro";
      divInfo.appendChild(img);
    }
    const spanName = document.createElement("span");
    spanName.textContent = `${m.name} (${m.role})`;
    divInfo.appendChild(spanName);
    const spanStatus = document.createElement("span");
    spanStatus.innerHTML = m.is_paid 
      ? '<span style="color:#4ade80; font-size:0.8rem; border:1px solid #4ade80; padding:2px 6px; border-radius:4px;">PAGO</span>' 
      : '<span style="color:#f87171; font-size:0.8rem;">PENDENTE</span>';
    li.appendChild(divInfo);
    li.appendChild(spanStatus);
    membersList.appendChild(li);
  });
}

async function handleAddMember(e) {
  e.preventDefault();
  const emailInput = document.getElementById("memberEmail");
  const messageEl = document.getElementById("memberMessage");
  messageEl.innerText = "Adicionando...";
  messageEl.style.color = "#ccc";
  try {
    const res = await authFetch(`${API}/teams/${currentTeam}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: emailInput.value })
    });
    const data = await res.json();
    if (res.ok) {
      messageEl.innerText = data.message || "Membro adicionado!";
      messageEl.style.color = "#4ade80";
      emailInput.value = "";
      loadMembers();
    } else {
      messageEl.innerText = data.error || "Erro ao adicionar.";
      messageEl.style.color = "#f87171";
    }
  } catch (err) {
    console.error(err);
    messageEl.innerText = "Erro na comunicação com o servidor.";
    messageEl.style.color = "#f87171";
  }
}

async function loadRobots() {
  const res = await authFetch(`${API}/teams/${currentTeam}/robots`);
  if (!res) return;

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
    const divInfo = document.createElement("div");
    divInfo.style.display = "flex";
    divInfo.style.alignItems = "center";
    if (r.photo) {
      const img = document.createElement("img");
      img.src = `${API}/uploads/${r.photo}`;
      img.className = "robot-thumb";
      img.style.width = "50px";
      img.style.height = "50px";
      img.alt = "Foto do robô";
      divInfo.appendChild(img);
    }
    const spanName = document.createElement("span");
    spanName.textContent = `${r.name} — ${r.category}`;
    divInfo.appendChild(spanName);
    const spanStatus = document.createElement("span");
    spanStatus.innerHTML = r.is_paid 
      ? '<span style="color:#4ade80; font-size:0.8rem; border:1px solid #4ade80; padding:2px 6px; border-radius:4px;">PAGO</span>' 
      : '<span style="color:#f87171; font-size:0.8rem;">PENDENTE</span>';
    li.appendChild(divInfo);
    li.appendChild(spanStatus);
    teamRobotsList.appendChild(li);
  });
}

async function loadCategories() {
  const res = await authFetch(API + "/categories");
  if (!res) return;

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

async function handleCreateRobot(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = "Salvando...";
  const name = document.getElementById("robotName").value;
  const category = document.getElementById("robotCategory").value;
  const photoInput = document.getElementById("robotPhoto");
  const photoCheck = Validators.file(photoInput);
  if (!photoCheck.valid) {
    document.getElementById("robotMessage").innerText = photoCheck.error;
    document.getElementById("robotMessage").style.color = "#f87171";
    btn.disabled = false;
    btn.innerText = originalText;
    return;
  }
  const formData = new FormData();
  formData.append("name", name);
  formData.append("categoryId", category);
  formData.append("teamId", currentTeam);
  if (photoInput.files[0]) {
    formData.append("photo", photoInput.files[0]);
  }
  try {
    const res = await authFetch(API + "/robots", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showToast("Robô cadastrado com sucesso!", "success");
      document.getElementById("robotMessage").innerText = "";
      e.target.reset();
      loadRobots();
    } else {
      showToast(data.error || "Erro ao cadastrar", "error");
    }
  } catch (err) {
    showToast("Erro ao conectar com servidor", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

async function loadCategoriesAndRobots() {
  // Aqui usamos authFetch para garantir que o token vá, mas se falhar, não necessariamente precisa deslogar se for público
  // Mas como estamos no app.js (área logada), deve deslogar.
  const resCategories = await authFetch(`${API}/categories`);
  if (!resCategories) return;
  const categories = await resCategories.json();
  const container = document.getElementById("robotsByCategory");
  if(container) container.innerHTML = "";

  for (const cat of categories) {
    const resRobots = await authFetch(`${API}/robots/category/${cat.id}`);
    const robots = await resRobots.json();
    const paidRobots = robots.filter(r => r.is_paid);
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
        li.style.justifyContent = "flex-start";
        if (r.photo) {
          const img = document.createElement("img");
          img.src = `${API}/uploads/${r.photo}`;
          img.className = "robot-thumb";
          li.appendChild(img);
        }
        const span = document.createElement("span");
        span.textContent = `${r.name} — ${r.team_name}`;
        li.appendChild(span);
        ul.appendChild(li);
      });
    }
    catCard.appendChild(ul);
    if (container) container.appendChild(catCard);
  }
}

async function loadPaymentData() {
  const [resMembers, resRobots] = await Promise.all([
    authFetch(`${API}/teams/${currentTeam}/members`),
    authFetch(`${API}/teams/${currentTeam}/robots`)
  ]);
  
  if (!resMembers || !resRobots || !resMembers.ok || !resRobots.ok) {
    console.error("Erro ao carregar dados para pagamento.");
    return;
  }
  const members = await resMembers.json();
  const robots = await resRobots.json();
  const list = document.getElementById("paymentList");
  list.innerHTML = "";
  const unpaidMembers = members.filter(m => !m.is_paid);
  const unpaidRobots = robots.filter(r => !r.is_paid);
  if (unpaidMembers.length === 0 && unpaidRobots.length === 0) {
    list.innerHTML = "<p style='text-align:center; color:#4ade80;'>Tudo pago! 🎉</p>";
    updateTotal();
    return;
  }
  unpaidMembers.forEach(m => {
    const div = document.createElement("div");
    div.className = "payment-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "pay-checkbox";
    checkbox.dataset.type = "member";
    checkbox.dataset.id = m.id;
    checkbox.dataset.price = "55";
    checkbox.onchange = updateTotal;
    const infoDiv = document.createElement("div");
    const strongName = document.createElement("strong");
    strongName.textContent = m.name;
    infoDiv.appendChild(strongName);
    infoDiv.appendChild(document.createTextNode(" (Membro)"));
    infoDiv.appendChild(document.createElement("br"));
    const smallPrice = document.createElement("small");
    smallPrice.style.color = "#aaa";
    smallPrice.textContent = "R$ 55,00";
    infoDiv.appendChild(smallPrice);
    div.appendChild(checkbox);
    div.appendChild(infoDiv);
    list.appendChild(div);
  });
  unpaidRobots.forEach(r => {
    const div = document.createElement("div");
    div.className = "payment-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "pay-checkbox";
    checkbox.dataset.type = "robot";
    checkbox.dataset.id = r.id;
    checkbox.dataset.price = "20";
    checkbox.onchange = updateTotal;
    const infoDiv = document.createElement("div");
    const strongName = document.createElement("strong");
    strongName.textContent = r.name;
    infoDiv.appendChild(strongName);
    infoDiv.appendChild(document.createTextNode(" (Robô)"));
    infoDiv.appendChild(document.createElement("br"));
    const smallPrice = document.createElement("small");
    smallPrice.style.color = "#aaa";
    smallPrice.textContent = "R$ 20,00";
    infoDiv.appendChild(smallPrice);
    div.appendChild(checkbox);
    div.appendChild(infoDiv);
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
  if (memberIds.length === 0 && robotIds.length === 0) {
    showToast("Selecione pelo menos um item para pagar.", "warning");
    return;
  }
  try {
    const res = await authFetch(`${API}/payments/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: currentTeam, memberIds, robotIds })
    });
    const data = await res.json();
    if (data.paymentUrl) window.location.href = data.paymentUrl;
    else showToast(data.error || "Erro ao gerar pagamento", "error");
  } catch (err) {
    showToast("Erro de conexão ao gerar pagamento", "error");
  }
}

window.onload = async () => {
  toggleLoader(true);
  try {
    // Pega o nome do usuário do token (exemplo, você precisaria decodificar o token)
    // Por simplicidade, vamos buscar o usuário na API
    const userRes = await authFetch(API + "/auth/me");
    if (userRes.ok) {
        const user = await userRes.json();
        document.getElementById("userName").innerText = user.name;
    }

    const promises = [
      loadTeams(),
      loadCategories(),
      loadCategoriesAndRobots()
    ];
    await Promise.all(promises);
  } finally {
    toggleLoader(false);
  }
};