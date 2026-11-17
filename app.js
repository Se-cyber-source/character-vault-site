const API_URL = "https://character-vault-api.seba-cieckiewicz.workers.dev";

const TOKEN_KEY = "characterVault_session";

let token = localStorage.getItem(TOKEN_KEY) || "";

let db = {
  bots: [],
  projects: []
};

let currentImage = "";
let imageMode = "upload";
let greetings = [];
let currentPage = "home";

const $ = id => document.getElementById(id);

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout(false);
    throw new Error("Sesja wygasła. Zaloguj się ponownie.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Błąd komunikacji z serwerem.");
  }

  return data;
}

// Logowanie
async function login() {
  const password = $("loginPassword").value;

  if (!password) {
    return toast("Wpisz hasło.");
  }

  try {
    const result = await api("/login", {
      method: "POST",
      body: JSON.stringify({ password }),
      headers: {}
    });

    token = result.token;
    localStorage.setItem(TOKEN_KEY, token);

    $("loginPassword").value = "";

    await loadDatabase();

    $("loginPage").classList.add("hidden");
    $("appContent").classList.remove("hidden");

    showPage("home");
    toast("Zalogowano pomyślnie!");
  } catch (error) {
    toast(error.message);
  }
}

// Wylogowanie
async function logout(callServer = true) {
  const oldToken = token;

  // Natychmiast wyczyść lokalną sesję
  token = "";
  localStorage.removeItem(TOKEN_KEY);

  db = {
    bots: [],
    projects: []
  };

  currentImage = "";
  greetings = [];

  $("appContent").classList.add("hidden");
  $("loginPage").classList.remove("hidden");

  // Wylogowanie po stronie serwera
  if (callServer && oldToken) {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${oldToken}`
        }
      });
    } catch (error) {
      console.error("Błąd wylogowania z serwera:", error);
    }
  }
}

// Pobieranie całej biblioteki
async function loadDatabase() {
  const [characters, projects] = await Promise.all([
    api("/characters"),
    api("/projects")
  ]);

  db.bots = characters.bots || [];
  db.projects = projects.projects || [];

  render();
}

// Zapis projektów na GitHub
async function saveProjects() {
  await api("/projects", {
    method: "PUT",
    body: JSON.stringify({
      projects: db.projects
    })
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2500);
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));
  $(page + "Page").classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-page]").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  $("breadcrumb").textContent = {
    home: "Dashboard",
    projects: "Projekty",
    editor: "Edytor postaci",
    detail: "Szczegóły postaci"
  }[page] || page;

  closeSidebar();
  window.scrollTo(0, 0);
}

function showEditor(id = "") {
  $("characterForm").reset();
  $("botId").value = id;
  currentImage = "";
  greetings = [];

  const bot = db.bots.find(b => b.id === id);

  imageMode = bot?.imageMode ||
  (bot?.image
    ? (bot.image.startsWith("data:") ? "upload" : "external")
    : (bot ? "default" : "upload"));

  if (bot) {
    $("editorTitle").textContent = "Edytuj postać";
    $("botName").value = bot.name;
    $("botDescription").value = bot.description || "";
    $("botTags").value = (bot.tags || []).join(", ");
    $("botProject").value = bot.project || "";
    $("botAuthor").value = bot.author || "";
    $("botStatus").value = bot.status || "active";
    $("botDefinition").value = bot.definition || "";
    $("botNotes").value = bot.notes || "";
    currentImage = bot.image || "";
    greetings = [...(bot.greetings || [])];
    $("imageZoom").value = bot.zoom || 100;
    $("imageX").value = bot.x ?? 50;
    $("imageY").value = bot.y ?? 50;
  } else {
    $("editorTitle").textContent = "Nowa postać";
    $("imageZoom").value = 100;
    $("imageX").value = 50;
    $("imageY").value = 50;
  }

  $("imageMode").value = imageMode;

$("downloadImageUrl").value = "";
$("externalImageUrl").value = "";

if (imageMode === "external" && bot?.image) {
  $("externalImageUrl").value = bot.image;
}

if (imageMode === "download" && bot?.image) {
  $("downloadImageUrl").value = "";
}

$("uploadImageOption").classList.toggle("hidden", imageMode !== "upload");
$("downloadImageOption").classList.toggle("hidden", imageMode !== "download");
$("externalImageOption").classList.toggle("hidden", imageMode !== "external");
$("defaultImageOption").classList.toggle("hidden", imageMode !== "default");

renderProjectOptions();
renderGreetings();
updateImagePreview();

  
  updateCounters();
  showPage("editor");
}

function updateCounters() {
  $("descCounter").textContent =
    `${$("botDescription").value.length} / 500`;
  $("definitionCounter").textContent =
    `${$("botDefinition").value.length.toLocaleString("pl-PL")} / 100 000`;
}

function renderProjectOptions() {
  const select = $("botProject");
  const previous = select.value;

  select.innerHTML = '<option value="">Bez folderu</option>' +
    db.projects.map(p =>
      `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`
    ).join("");

  if ([...select.options].some(option => option.value === previous)) {
  select.value = previous;
     }
}

function renderGreetings() {
  $("greetingsList").innerHTML = greetings.map((g, i) => `
    <div class="greeting-item">
      <div class="panel-heading">
        <strong>Powitanie ${i + 1}</strong>
        <button type="button" class="secondary-btn danger"
          onclick="removeGreeting(${i})">Usuń</button>
      </div>
      <textarea rows="5" data-greeting="${i}"
        placeholder="Wpisz początek historii...">${escapeHTML(g)}</textarea>
    </div>
  `).join("");

  $("greetingsList").querySelectorAll("[data-greeting]").forEach(el => {
    el.addEventListener("input", () => {
      greetings[Number(el.dataset.greeting)] = el.value;
    });
  });
}

function removeGreeting(index) {
  greetings.splice(index, 1);
  renderGreetings();
}

function updateImagePreview() {
  const preview = $("imagePreview");
  const cropControls = $("cropControls");

  if (imageMode === "default" || !currentImage) {
    preview.innerHTML = `
      <div class="default-character-image">
        <span>✦</span>
        <small>Brak zdjęcia</small>
      </div>
    `;

    if (cropControls) {
      cropControls.classList.add("hidden");
    }

    return;
  }

  if (cropControls) {
    cropControls.classList.remove("hidden");
  }

  preview.innerHTML = `
    <img src="${escapeHTML(currentImage)}" alt="Podgląd">
  `;

  const img = preview.querySelector("img");

  img.style.transform =
    `scale(${$("imageZoom").value / 100})`;

  img.style.objectPosition =
    `${$("imageX").value}% ${$("imageY").value}%`;
}

function changeImageMode(mode) {
  imageMode = mode;

  $("uploadImageOption").classList.toggle(
    "hidden", mode !== "upload"
  );

  $("downloadImageOption").classList.toggle(
    "hidden", mode !== "download"
  );

  $("externalImageOption").classList.toggle(
    "hidden", mode !== "external"
  );

  $("defaultImageOption").classList.toggle(
    "hidden", mode !== "default"
  );

  if (mode === "default") {
    currentImage = "";
  }

  updateImagePreview();
}

async function downloadImageFromUrl() {
  const url = $("downloadImageUrl").value.trim();

  if (!url) {
    return toast("Wklej adres zdjęcia.");
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Nie udało się pobrać zdjęcia.");
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      throw new Error("Podany link nie prowadzi do zdjęcia.");
    }

    if (blob.size > 2 * 1024 * 1024) {
      throw new Error("Zdjęcie jest większe niż 2 MB.");
    }

    const reader = new FileReader();

    reader.onload = () => {
      currentImage = reader.result;
      updateImagePreview();
      toast("Zdjęcie pobrane!");
    };

    reader.onerror = () => {
      toast("Nie udało się odczytać zdjęcia.");
    };

    reader.readAsDataURL(blob);

  } catch (error) {
    toast(
      error.name === "TypeError"
        ? "Nie można pobrać zdjęcia. Serwer może blokować CORS."
        : error.message
    );
  }
}

function setExternalImage() {
  const url = $("externalImageUrl").value.trim();

  if (!url) {
    return toast("Wklej adres zdjęcia.");
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return toast("Nieprawidłowy adres zdjęcia.");
    }

    currentImage = url;
    updateImagePreview();

    toast("Ustawiono zdjęcie z linku!");

  } catch {
    toast("Nieprawidłowy adres URL.");
  }
}

function getCrop() {
  return {
    zoom: Number($("imageZoom").value),
    x: Number($("imageX").value),
    y: Number($("imageY").value)
  };
}


async function saveCharacter() {
  const name = $("botName").value.trim();

  if (!name) return toast("Podaj nazwę postaci.");

  const id = $("botId").value;
  const old = db.bots.find(b => b.id === id);
  const crop = getCrop();

  const bot = {
    id: id || crypto.randomUUID(),
    name,
    description: $("botDescription").value,
    tags: $("botTags").value.split(",").map(t => t.trim()).filter(Boolean),
    project: $("botProject").value,
    author: $("botAuthor").value,
    status: $("botStatus").value,
    definition: $("botDefinition").value,
    notes: $("botNotes").value,
    greetings: greetings.filter(g => g.trim()),
    imageMode: imageMode,
    image: imageMode === "default"
      ? ""
      : currentImage || old?.image || "",
    ...crop,
    created: old?.created || new Date().toISOString(),
    updated: new Date().toISOString()
  };

  try {
    await api("/characters", {
      method: old ? "PUT" : "POST",
      body: JSON.stringify(bot)
    });

    await loadDatabase();

    toast("Postać została zapisana!");
    showPage("home");

  } catch (error) {
    toast(error.message);
  }
}

function render() {
  $("botCount").textContent = db.bots.length;
  $("projectCount").textContent = db.projects.length;
  $("greetingCount").textContent =
    db.bots.reduce((sum, bot) => sum + (bot.greetings || []).length, 0);

  renderProjectOptions();

  $("projectFilter").innerHTML =
    '<option value="">Wszystkie projekty</option>' +
    db.projects.map(p =>
      `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`
    ).join("");

  renderProjectNav();
  renderCharacters();
  renderProjects();
}

function renderProjectNav() {
  $("projectNav").innerHTML = db.projects.map(p => `
    <button class="nav-item" onclick="filterProject('${p.id}')">
      ▣ ${escapeHTML(p.name)}
    </button>
  `).join("");
}

function renderCharacters() {
  const search = $("searchInput").value.toLowerCase();
  const project = $("projectFilter").value;

  const bots = db.bots.filter(bot => {
    const matchesSearch =
      bot.name.toLowerCase().includes(search) ||
      (bot.description || "").toLowerCase().includes(search) ||
      (bot.tags || []).some(t => t.toLowerCase().includes(search));

    return matchesSearch && (!project || bot.project === project);
  });

  $("characterGrid").innerHTML = bots.map(bot => `
    <article class="character-card" onclick="showDetail('${bot.id}')">
      ${bot.image
        ? `<img src="${escapeHTML(bot.image)}" alt="${escapeHTML(bot.name)}"
             style="object-position:${bot.x ?? 50}% ${bot.y ?? 50}%">`
        : `<div class="image-preview">✦</div>`}
      <div class="card-body">
        <h3>${escapeHTML(bot.name)}</h3>
        <p class="muted">${escapeHTML(bot.description || "Brak opisu")}</p>
        <div class="tags">
          ${(bot.tags || []).slice(0, 4).map(tag =>
            `<span class="tag">${escapeHTML(tag)}</span>`
          ).join("")}
        </div>
        <small class="muted">${bot.status === "draft" ? "Szkic" :
          bot.status === "archived" ? "Archiwum" : "Aktywna"}</small>
      </div>
    </article>
  `).join("");

  $("emptyState").classList.toggle("hidden", bots.length > 0);
}

function filterProject(id) {
  showPage("home");
  $("projectFilter").value = id;
  renderCharacters();
}

function renderProjects() {
  $("projectGrid").innerHTML = db.projects.map(p => {
    const count = db.bots.filter(b => b.project === p.id).length;
    return `
      <div class="project-card">
        <h3>▣ ${escapeHTML(p.name)}</h3>
        <p class="muted">${count} postaci</p>
        <button class="secondary-btn" onclick="filterProject('${p.id}')">
          Otwórz folder
        </button>
        <button class="secondary-btn danger"
          onclick="deleteProject('${p.id}')">Usuń folder</button>
      </div>`;
  }).join("");
}

async function addProject() {
  const name = $("projectName").value.trim();

  if (!name) return toast("Podaj nazwę projektu.");

  const project = {
    id: crypto.randomUUID(),
    name
  };

  db.projects.push(project);

  try {
    await saveProjects();
    $("projectName").value = "";
    await loadDatabase();
    toast("Dodano folder.");
  } catch (error) {
    db.projects = db.projects.filter(p => p.id !== project.id);
    toast(error.message);
  }
}

async function deleteProject(id) {
  if (!confirm("Usunąć folder? Postacie zostaną zachowane.")) return;

  const previousProjects = [...db.projects];
  const previousBots = db.bots.map(b => ({ ...b }));

  db.projects = db.projects.filter(p => p.id !== id);

  db.bots.forEach(b => {
    if (b.project === id) b.project = "";
  });

  try {
    await saveProjects();

    // Zapisz zmiany przypisania postaci do folderów
    for (const bot of db.bots.filter(b =>
      previousBots.find(old => old.id === b.id)?.project === id
    )) {
      await api("/characters", {
        method: "PUT",
        body: JSON.stringify(bot)
      });
    }

    await loadDatabase();
    toast("Usunięto folder.");
  } catch (error) {
    db.projects = previousProjects;
    db.bots = previousBots;
    render();
    toast(error.message);
  }
}

function showDetail(id) {
  const bot = db.bots.find(b => b.id === id);
  if (!bot) return;

  const project = db.projects.find(p => p.id === bot.project);

  $("detailContent").innerHTML = `
    <button class="secondary-btn" onclick="showPage('home')">← Wróć</button>
    <div class="panel" style="margin-top:20px">
      <div class="detail-cover">
        ${bot.image ? `<img src="${escapeHTML(bot.image)}" alt="">` : ""}
        <div>
          <span class="eyebrow">CHARACTER PROFILE</span>
          <h1>${escapeHTML(bot.name)}</h1>
          <p>${escapeHTML(bot.description || "")}</p>
          <div class="tags">${(bot.tags || []).map(t =>
            `<span class="tag">${escapeHTML(t)}</span>`).join("")}</div>
          <p class="muted">${escapeHTML(project?.name || "Bez folderu")}</p>
        </div>
      </div>

      <div class="detail-actions">
        <button class="primary-btn" onclick="copyText('${bot.id}','definition')">
          Kopiuj Definition
        </button>
        <button class="secondary-btn" onclick="copyText('${bot.id}','all')">
          Kopiuj cały prompt
        </button>
        <button class="secondary-btn" onclick="showEditor('${bot.id}')">
          ✎ Edytuj
        </button>
        <button class="secondary-btn danger" onclick="deleteBot('${bot.id}')">
          Usuń
        </button>
      </div>
    </div>

    <div class="panel">
      <h3>Definition</h3>
      <pre class="detail-text">${escapeHTML(bot.definition || "Brak definicji")}</pre>
    </div>

    <div class="panel">
      <h3>Wiadomości powitalne</h3>
      ${(bot.greetings || []).map((g,i) => `
        <div class="greeting-item">
          <strong>Powitanie ${i+1}</strong>
          <pre class="detail-text">${escapeHTML(g)}</pre>
          <button class="secondary-btn" onclick="copyGreeting('${bot.id}',${i})">
            Kopiuj powitanie
          </button>
        </div>`).join("") || "<p class='muted'>Brak powitań.</p>"}
    </div>

    <div class="panel">
      <h3>Notatki</h3>
      <pre class="detail-text">${escapeHTML(bot.notes || "Brak notatek")}</pre>
      <small class="muted">Autor: ${escapeHTML(bot.author || "Nie podano")}</small>
    </div>
  `;

  showPage("detail");
}

async function copyText(id, mode) {
  const b = db.bots.find(bot => bot.id === id);
  if (!b) return;

  const text = mode === "definition" ? b.definition : [
    `Character: ${b.name}`,
    `Description: ${b.description}`,
    `Tags: ${(b.tags || []).join(", ")}`,
    `Definition:\n${b.definition}`,
    ...(b.greetings || []).map((g,i) => `\nGreeting ${i+1}:\n${g}`)
  ].join("\n\n");

  await navigator.clipboard.writeText(text);
  toast("Skopiowano do schowka!");
}

async function copyGreeting(id, index) {
  const b = db.bots.find(bot => bot.id === id);
  if (!b || !b.greetings[index]) return;
  await navigator.clipboard.writeText(b.greetings[index]);
  toast("Powitanie skopiowane!");
}

async function deleteBot(id) {
  if (!confirm("Czy na pewno usunąć tę postać?")) return;

  try {
    await api(`/characters/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    await loadDatabase();

    showPage("home");
    toast("Usunięto postać.");

  } catch (error) {
    toast(error.message);
  }
}

// Zdjęcia i kadrowanie
$("imageFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Wybierz plik graficzny.");

  if (file.size > 2 * 1024 * 1024) {
    return toast("Wybierz zdjęcie do 2 MB.");
  }

  const reader = new FileReader();
  reader.onload = () => {
    currentImage = reader.result;
    updateImagePreview();
  };
  reader.readAsDataURL(file);
});

$("imageUrl").addEventListener("change", () => {
  const url = $("imageUrl").value.trim();
  if (!url) return;
  currentImage = url;
  updateImagePreview();
});

["imageZoom","imageX","imageY"].forEach(id => {
  $(id).addEventListener("input", updateImagePreview);
});

$("resetCropBtn").addEventListener("click", () => {
  $("imageZoom").value = 100;
  $("imageX").value = 50;
  $("imageY").value = 50;
  updateImagePreview();
});

// Eksport i import całej biblioteki
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "character-vault-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);

      if (!Array.isArray(data.bots) || !Array.isArray(data.projects)) {
        throw new Error("Nieprawidłowy format");
      }

      if (!confirm("Import zastąpi obecną bibliotekę. Kontynuować?")) {
        return;
      }

      // Najpierw zapisujemy projekty
      await api("/projects", {
        method: "PUT",
        body: JSON.stringify({
          projects: data.projects
        })
      });

      // Następnie zapisujemy postacie
      for (const bot of data.bots) {
        await api("/characters", {
          method: "POST",
          body: JSON.stringify(bot)
        });
      }

      await loadDatabase();
      toast("Zaimportowano bibliotekę.");

    } catch (error) {
      console.error(error);
      toast("Błąd importu: " + error.message);
    }
  };

  reader.readAsText(file);
}

// Obsługa interfejsu
document.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.page === "editor") showEditor();
    else showPage(btn.dataset.page);
  });
});

$("newBtn").addEventListener("click", () => showEditor());
$("saveBtn").addEventListener("click", saveCharacter);
$("addGreetingBtn").addEventListener("click", () => {
  greetings.push("");
  renderGreetings();
});
$("addProjectBtn").addEventListener("click", addProject);
$("searchInput").addEventListener("input", renderCharacters);
$("projectFilter").addEventListener("change", renderCharacters);
$("botDescription").addEventListener("input", updateCounters);
$("botDefinition").addEventListener("input", updateCounters);
$("exportBtn").addEventListener("click", exportData);
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", e => {
  if (e.target.files[0]) importData(e.target.files[0]);
});
$("logoutBtn").addEventListener("click", async () => {
  if (!confirm("Czy na pewno chcesz się wylogować?")) return;

  await logout(true);
  toast("Wylogowano pomyślnie.");
});

$("characterForm").addEventListener("submit", e => e.preventDefault());


async function initializeApp() {
  $("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    login();
  });

  if (!token) {
    $("loginPage").classList.remove("hidden");
    $("appContent").classList.add("hidden");
    return;
  }

  try {
    await loadDatabase();

    $("loginPage").classList.add("hidden");
    $("appContent").classList.remove("hidden");

    showPage("home");

  } catch (error) {
    console.error(error);
    logout(false);
  }
}

initializeApp();


// Obsługa mobilnego menu
const menuBtn = $("menuBtn");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = $("sidebarOverlay");
const sidebarClose = $("sidebarClose");

function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("active");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");
}

menuBtn.addEventListener("click", () => {
  sidebar.classList.contains("open")
    ? closeSidebar()
    : openSidebar();
});

sidebarClose.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

// Zamykanie menu po wybraniu zakładki lub folderu
sidebar.addEventListener("click", e => {
  if (e.target.closest(".nav-item")) {
    closeSidebar();
  }
});

// Zamykanie klawiszem Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeSidebar();
});

