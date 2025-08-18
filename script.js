const EX_BASE = "https://exercisedb.p.rapidapi.com";
const PLACEHOLDER_IMG = "./images/fallback.gif";

const resultsView = document.getElementById("resultsView");
const detailView  = document.getElementById("detailView");
const resultsGrid = document.getElementById("resultsGrid");
const pagination  = document.getElementById("pagination");
const resultMeta  = document.getElementById("resultMeta");
const categoryEls = document.querySelectorAll(".category-card");
const searchInput = document.getElementById("searchInput");
const searchBtn   = document.getElementById("searchBtn");
const backBtn     = document.getElementById("backBtn");
const detailContent = document.getElementById("detailContent");
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

const state = {
  view: "grid",
  category: "All",
  query: "",
  page: 1,
  pageSize: 48,
  lastScroll: 0,
  currentList: [],
  cache: {
    byBodyPart: {},
    byId: {},
    search: {}
  }
};

const BODY_PARTS = [
  "all","back","cardio","chest","lower arms","lower legs",
  "neck","shoulders","upper arms","upper legs","waist"
];

function httpsGif(_url, id) {
  return id ? `./images/${id}.gif` : PLACEHOLDER_IMG;
}

function onImgError(ev) {
  const img = ev?.target;
  if (!img) return;
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
  img.alt = (img.alt || "Image") + " (fallback)";
}

function onMiniImgError(ev) {
  const img = ev?.target;
  if (!img) return;
  const card = img.closest("article.mini-card");
  if (card && card.parentNode) card.parentNode.removeChild(card);
}

function setActiveCategory(bp) {
  categoryEls.forEach(el =>
    el.classList.toggle("active", (el.dataset.bp || "").toLowerCase() === bp.toLowerCase())
  );
}

function showGrid() {
  detailView.classList.add("hidden");
  resultsView.classList.remove("hidden");
  state.view = "grid";
}

function showDetailView() {
  resultsView.classList.add("hidden");
  detailView.classList.remove("hidden");
  state.view = "detail";
}

function spinnerHTML() {
  return `<div class="center" style="padding:16px"><div class="spinner" aria-label="Loading"></div></div>`;
}

function updateHistory() {
  const params = new URLSearchParams({
    v: state.view,
    bp: state.category,
    q: state.query,
    p: String(state.page)
  });
  history.replaceState({ ...state }, "", `#${params.toString()}`);
}

function readHistoryOnLoad() {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const v  = params.get("v") || "grid";
  const bp = params.get("bp") || "All";
  const q  = params.get("q")  || "";
  const p  = parseInt(params.get("p") || "1", 10);

  state.view = v;
  state.category = bp;
  state.query = q;
  state.page = Number.isFinite(p) && p > 0 ? p : 1;

  setActiveCategory(state.category);
  if (searchInput) searchInput.value = state.query;
}

function paginate(list, page, pageSize) {
  const start = (page - 1) * pageSize;
  return list.slice(start, start + pageSize);
}

async function fetchJSONFromServerless(path) {
  const res = await fetch(`/api/fetchExercise?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`Serverless fetch failed: ${res.status}`);
  return res.json();
}

async function fetchByBodyPart(bp) {
  const key = (bp || "all").toLowerCase();
  if (state.cache.byBodyPart[key]) return state.cache.byBodyPart[key];

  const path = key === "all"
    ? `/exercises`
    : `/exercises/bodyPart/${encodeURIComponent(bp)}`;

  const data = await fetchJSONFromServerless(path);
  state.cache.byBodyPart[key] = Array.isArray(data) ? data : [];
  state.cache.byBodyPart[key].forEach(ex => (state.cache.byId[ex.id] = ex));
  return state.cache.byBodyPart[key];
}

async function fetchById(id) {
  if (state.cache.byId[id]) return state.cache.byId[id];
  const ex = await fetchJSONFromServerless(`/exercises/exercise/${id}`);
  state.cache.byId[id] = ex;
  return ex;
}

async function searchSmart(query) {
  const raw = (query || "").trim().toLowerCase();
  const key = `q:${raw}`;
  if (state.cache.search[key]) return state.cache.search[key];

  if (BODY_PARTS.includes(raw)) {
    const part = raw === "all" ? "All" : raw;
    const list = await fetchByBodyPart(part);
    state.cache.search[key] = list;
    return list;
  }

  const [byName, byTarget, byEquip] = await Promise.allSettled([
    fetchJSONFromServerless(`/exercises/name/${encodeURIComponent(raw)}`),
    fetchJSONFromServerless(`/exercises/target/${encodeURIComponent(raw)}`),
    fetchJSONFromServerless(`/exercises/equipment/${encodeURIComponent(raw)}`)
  ]);

  const combined = uniqueById([
    ...(byName.value || []),
    ...(byTarget.value || []),
    ...(byEquip.value || [])
  ]);

  combined.forEach(ex => (state.cache.byId[ex.id] = ex));
  state.cache.search[key] = combined;
  return combined;
}

function uniqueById(arr) {
  const seen = new Set();
  return arr.filter(x => {
    const ok = x && x.id && !seen.has(x.id);
    if (ok) seen.add(x.id);
    return ok;
  });
}

function renderGrid(list) {
  state.currentList = list;
  const pageItems = paginate(list, state.page, state.pageSize);

  resultMeta.textContent = list.length
    ? `Total ${list.length} results • Page ${state.page}`
    : `No results`;

  if (!pageItems.length) {
    resultsGrid.innerHTML = `<div class="center" style="padding:24px">No exercises found.</div>`;
    pagination.innerHTML = "";
    return;
  }

  resultsGrid.innerHTML = pageItems.map(ex => {
    const gif = httpsGif(ex.gifUrl, ex.id);
    const safeName = (ex.name || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const bodyPart = (ex.bodyPart || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const target   = (ex.target || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const equip    = (ex.equipment || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `
      <article class="card" data-id="${ex.id}">
        <img loading="lazy" src="${gif}" alt="${safeName}" onerror="onImgError(event)" />
        <h3>${safeName}</h3>
        <div class="tags">
          <span class="tag">${bodyPart}</span>
          <span class="tag">${target}</span>
          <span class="tag">${equip}</span>
        </div>
        <div class="actions">
          <button class="btn-sm" data-view="detail" data-id="${ex.id}">View Details</button>
        </div>
      </article>
    `;
  }).join("");

  renderPagination(list.length, state.page, state.pageSize);
  updateHistory();
}

function renderPagination(total, page, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const buttons = [];

  const makeBtn = (label, newPage, disabled=false, active=false) => `
    <button class="page-btn ${active ? 'active' : ''}" data-page="${newPage}" ${disabled ? 'disabled' : ''}>
      ${label}
    </button>
  `;

  buttons.push(makeBtn("Prev", Math.max(1, page - 1), page === 1));

  const spread = 2;
  const start = Math.max(1, page - spread);
  const end = Math.min(pages, page + spread);

  if (start > 1) {
    buttons.push(makeBtn("1", 1, false, page === 1));
    if (start > 2) buttons.push(`<span class="muted">...</span>`);
  }

  for (let p = start; p <= end; p++) {
    buttons.push(makeBtn(String(p), p, false, p === page));
  }

  if (end < pages) {
    if (end < pages - 1) buttons.push(`<span class="muted">...</span>`);
    buttons.push(makeBtn(String(pages), pages, false, page === pages));
  }

  buttons.push(makeBtn("Next", Math.min(pages, page + 1), page === pages));

  pagination.innerHTML = buttons.join("");
}

function miniCardHTML(ex, removeOnError = false) {
  const gif = httpsGif(ex.gifUrl, ex.id);
  const safeName = (ex.name || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyPart = (ex.bodyPart || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const target   = (ex.target || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const onErr    = removeOnError ? "onMiniImgError(event)" : "onImgError(event)";
  return `
    <article class="mini-card" data-id="${ex.id}">
      <img loading="lazy" src="${gif}" alt="${safeName}" onerror="${onErr}" />
      <div class="meta">
        <h4>${safeName}</h4>
        <div class="tiny">${bodyPart} • ${target}</div>
        <div style="margin-top:8px">
          <button class="btn-sm" data-view="detail" data-id="${ex.id}">View</button>
        </div>
      </div>
    </article>
  `;
}

async function fetchYouTubeThumb(query) {
  const res = await fetch(`/api/fetchYouTube?query=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.items && data.items.length > 0) {
    const v = data.items[0];
    return {
      videoId: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.medium.url
    };
  }
  return null;
}

// ... Keep all your detail rendering, openDetail(), loadCategory(), runSearch() functions unchanged
// Just replace direct YouTube calls with fetchYouTubeThumb(query) as shown above

window.onImgError = onImgError;
window.onMiniImgError = onMiniImgError;
