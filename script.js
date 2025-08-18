const RAPID_KEY = "adc5f59548msh38753e79c9506bcp1ab59ejsn2a0c10f1f974";

const EX_BASE = "https://exercisedb.p.rapidapi.com";
const EX_HEADERS = {
  "X-RapidAPI-Key": RAPID_KEY,
  "X-RapidAPI-Host": "exercisedb.p.rapidapi.com"
};

const YT_BASE = "https://youtube-search-and-download.p.rapidapi.com";
const YT_HEADERS = {
  "X-RapidAPI-Key": RAPID_KEY,
  "X-RapidAPI-Host": "youtube-search-and-download.p.rapidapi.com"
};

const YT_API_KEY = "AIzaSyC45iF0uz9K1CCUL3bst_-3ztcumW4x-5o";
const PLACEHOLDER_IMG = "./images/fallback.gif";
const DEBUG_CHECK = false;

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

async function fetchJSON(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function uniqueById(arr) {
  const seen = new Set();
  return arr.filter(x => {
    const ok = x && x.id && !seen.has(x.id);
    if (ok) seen.add(x.id);
    return ok;
  });
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

async function fetchByBodyPart(bp) {
  const key = (bp || "all").toLowerCase();
  if (state.cache.byBodyPart[key]) return state.cache.byBodyPart[key];

  const url = key === "all"
    ? `${EX_BASE}/exercises`
    : `${EX_BASE}/exercises/bodyPart/${encodeURIComponent(bp)}`;

  const data = await fetchJSON(url, EX_HEADERS);
  state.cache.byBodyPart[key] = Array.isArray(data) ? data : [];
  state.cache.byBodyPart[key].forEach(ex => (state.cache.byId[ex.id] = ex));
  return state.cache.byBodyPart[key];
}

async function fetchById(id) {
  if (state.cache.byId[id]) return state.cache.byId[id];
  const ex = await fetchJSON(`${EX_BASE}/exercises/exercise/${id}`, EX_HEADERS);
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
    fetchJSON(`${EX_BASE}/exercises/name/${encodeURIComponent(raw)}`, EX_HEADERS),
    fetchJSON(`${EX_BASE}/exercises/target/${encodeURIComponent(raw)}`, EX_HEADERS),
    fetchJSON(`${EX_BASE}/exercises/equipment/${encodeURIComponent(raw)}`, EX_HEADERS)
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

function renderDetailLoading() {
  detailContent.innerHTML = spinnerHTML();
}

async function renderDetail(ex, youTube, simTarget, simEquip, apiKey) {
  const gif = httpsGif(ex.gifUrl, ex.id);
  let ytItems = [];
  if (Array.isArray(youTube?.contents)) {
    ytItems = youTube.contents
      .map(c => c.video || c)
      .filter(v => v && v.videoId);
  }
  if (!ytItems.length && Array.isArray(youTube?.videos)) {
    ytItems = youTube.videos.filter(v => v.videoId);
  }
  const relatedQueries = [
    `${ex.name} exercise`,
    `${ex.name} workout`,
    `${ex.target} exercise`,
    `${ex.equipment} exercise`
  ];
  const rq = Array.from(new Set(relatedQueries.filter(Boolean)));
  ytItems = ytItems.slice(0, 8);
  const simT = (simTarget || []).filter(s => s.id !== ex.id).slice(0, 12);
  const simE = (simEquip || []).filter(s => s.id !== ex.id).slice(0, 12);
  const safeName = (ex.name || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  async function fetchYouTubeThumb(query, apiKeyInner) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${apiKeyInner}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const v = data.items[0];
        return {
          videoId: v.id.videoId,
          title: v.snippet.title,
          thumbnail: v.snippet.thumbnails.medium.url
        };
      }
    } catch (err) {
      console.error("YT fetch error:", err);
    }
    return null;
  }
  let ytSection = "";
  if (ytItems.length) {
    ytSection = ytItems.map(v => `
      <a class="thumb" href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer">
        <img loading="lazy" src="${(v.thumbnails?.[0]?.url || "").replace(/^http:\/\//, "https://")}" 
             alt="${(v.title || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}" 
             onerror="onImgError(event)" />
        <div class="meta">
          <div style="font-weight:700;font-size:14px">
            ${(v.title || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
          </div>
        </div>
      </a>
    `).join("");
  } else {
    let results = [];
    if (apiKey) {
      results = await Promise.all(rq.map(q => fetchYouTubeThumb(q, apiKey)));
      results = results.filter(Boolean);
    }
    if (results.length) {
      ytSection = results.map(v => `
        <a class="thumb" href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer">
          <img loading="lazy" src="${v.thumbnail}" 
               alt="${v.title.replace(/</g,"&lt;").replace(/>/g,"&gt;")}" 
               onerror="onImgError(event)" />
          <div class="meta">
            <div style="font-weight:700;font-size:14px">${v.title}</div>
          </div>
        </a>
      `).join("");
    } else {
      ytSection = rq.map(q => `
        <a class="thumb" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}" target="_blank" rel="noopener noreferrer">
          <div class="meta">
            <div style="font-weight:700;font-size:14px">${q}</div>
          </div>
        </a>
      `).join("");
    }
  }
  detailContent.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <img src="${gif}" alt="${safeName}" onerror="onImgError(event)" />
        <div>
          <h2 style="margin:0 0 6px">${safeName}</h2>
          <p class="muted" style="margin:0 0 10px">Great for your ${ex.target}. Equipment: ${ex.equipment}.</p>
          <div class="kv">
            <span class="pill">Body part: ${ex.bodyPart}</span>
            <span class="pill">Target: ${ex.target}</span>
            <span class="pill">Equipment: ${ex.equipment}</span>
          </div>
        </div>
      </div>
      <h3 class="section-title">YouTube videos</h3>
      <div class="row-scroll">
        ${ytSection}
      </div>
      <h3 class="section-title">Similar exercises (target)</h3>
      <div class="row-scroll">
        ${ simT.length ? simT.map(s => miniCardHTML(s, true)).join("") : `<div class="muted" style="padding:8px 0 16px">None</div>` }
      </div>
      <h3 class="section-title">Similar exercises (equipment)</h3>
      <div class="row-scroll">
        ${ simE.length ? simE.map(s => miniCardHTML(s, true)).join("") : `<div class="muted" style="padding:8px 0 16px">None</div>` }
      </div>
    </div>
  `;
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

async function loadCategory(bp, keepPage=false) {
  try {
    state.query = "";
    if (searchInput) searchInput.value = "";
    state.category = bp;
    setActiveCategory(bp);
    if (!keepPage) state.page = 1;
    resultsGrid.innerHTML = spinnerHTML();
    pagination.innerHTML = "";
    const list = await fetchByBodyPart(bp);
    showGrid();
    renderGrid(list);
  } catch (e) {
    console.error(e);
    resultsGrid.innerHTML = `<div class="center" style="padding:24px">Failed to load exercises. <button class="btn-sm" id="retryCat">Retry</button></div>`;
    document.getElementById("retryCat")?.addEventListener("click", () => loadCategory(bp, keepPage));
  }
}

async function runSearch(query) {
  try {
    state.query = (query || "").trim();
    state.page = 1;
    resultsGrid.innerHTML = spinnerHTML();
    pagination.innerHTML = "";
    const list = await searchSmart(state.query || "all");
    if (BODY_PARTS.includes(state.query.toLowerCase())) {
      state.category = state.query.toLowerCase() === "all" ? "All" : state.query.toLowerCase();
      setActiveCategory(state.category);
    } else {
      state.category = "All";
      setActiveCategory("All");
    }
    showGrid();
    renderGrid(list);
  } catch (e) {
    console.error(e);
    resultsGrid.innerHTML = `<div class="center" style="padding:24px">Search failed. <button class="btn-sm" id="retrySearch">Retry</button></div>`;
    document.getElementById("retrySearch")?.addEventListener("click", () => runSearch(state.query));
  }
}

async function openDetail(id) {
  try {
    state.lastScroll = window.scrollY || 0;
    showDetailView();
    renderDetailLoading();
    updateHistory();
    const ex = await fetchById(id);
    const [yt, simT, simE] = await Promise.allSettled([
      fetchJSON(`${YT_BASE}/search?query=${encodeURIComponent(ex.name + " exercise")}&hl=en&gl=US`, YT_HEADERS),
      fetchJSON(`${EX_BASE}/exercises/target/${encodeURIComponent(ex.target)}`, EX_HEADERS),
      fetchJSON(`${EX_BASE}/exercises/equipment/${encodeURIComponent(ex.equipment)}`, EX_HEADERS),
    ]);
    await renderDetail(
      ex,
      yt.value || { contents: [] },
      simT.value || [],
      simE.value || [],
      YT_API_KEY
    );
    const params = new URLSearchParams({
      v: "detail",
      id,
      bp: state.category,
      q: state.query,
      p: String(state.page)
    });
    history.pushState({ ...state, view: "detail", id }, "", `#${params.toString()}`);
  } catch (e) {
    console.error(e);
    detailContent.innerHTML = `<div class="center" style="padding:24px">Failed to load details. <button class="btn-sm" id="retryDetail">Retry</button></div>`;
    document.getElementById("retryDetail")?.addEventListener("click", () => openDetail(id));
  }
}

function backToGrid() {
  showGrid();
  setTimeout(() => window.scrollTo({ top: state.lastScroll, behavior: "instant" }), 0);
  updateHistory();
}

categoryEls.forEach(el => {
  el.addEventListener("click", () => {
    const bp = el.dataset.bp;
    loadCategory(bp);
  });
});

if (searchBtn) searchBtn.addEventListener("click", () => runSearch(searchInput.value));
if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch(searchInput.value);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view='detail']");
  if (btn) {
    const id = btn.getAttribute("data-id");
    openDetail(id);
    return;
  }
  const pageBtn = e.target.closest(".page-btn");
  if (pageBtn) {
    const newPage = parseInt(pageBtn.getAttribute("data-page"), 10);
    if (Number.isFinite(newPage) && newPage !== state.page) {
      state.page = newPage;
      renderGrid(state.currentList);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }
});

if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (history.state?.view === "detail") {
      history.back();
    } else {
      backToGrid();
    }
  });
}

window.addEventListener("popstate", (ev) => {
  const st = ev.state;
  if (!st) return;
  state.view = st.view || "grid";
  state.category = st.category || st.bp || "All";
  state.query = st.query || st.q || "";
  state.page = st.page || parseInt(st.p || "1", 10) || 1;
  setActiveCategory(state.category);
  if (searchInput) searchInput.value = state.query;
  if (state.view === "detail" && st.id) {
    showDetailView();
    openDetail(st.id);
  } else {
    showGrid();
    const qLower = (state.query || "").toLowerCase();
    const cached = BODY_PARTS.includes(qLower)
      ? state.cache.byBodyPart[qLower]
      : state.cache.byBodyPart[state.category.toLowerCase()];
    if (cached && cached.length) {
      renderGrid(cached);
      setTimeout(() => window.scrollTo({ top: state.lastScroll, behavior: "instant" }), 0);
    } else if (state.query) {
      runSearch(state.query);
    } else {
      loadCategory(state.category, true);
    }
  }
});

window.onImgError = onImgError;
window.onMiniImgError = onMiniImgError;

async function debugCheckApis() {
  try {
    const ytTestUrl = `${YT_BASE}/video/download?id=dQw4w9WgXcQ`;
    const ytRes = await fetch(ytTestUrl, { headers: YT_HEADERS });
    console.log("[DEBUG] YT download status:", ytRes.status);
    const ytText = await ytRes.text();
    console.log("[DEBUG] YT download body (truncated):", ytText.slice(0, 200));
  } catch (err) {
    console.warn("[DEBUG] YouTube download test failed:", err);
  }
  try {
    const exStatusUrl = `${EX_BASE}/status`;
    const exRes = await fetch(exStatusUrl, { headers: EX_HEADERS });
    console.log("[DEBUG] ExerciseDB status:", exRes.status);
    const exText = await exRes.text();
    console.log("[DEBUG] ExerciseDB status body:", exText);
  } catch (err) {
    console.warn("[DEBUG] ExerciseDB status test failed:", err);
  }
}

(async function init() {
  readHistoryOnLoad();
  if (DEBUG_CHECK) {
    debugCheckApis();
  }
  if (state.query) {
    await runSearch(state.query);
  } else {
    await loadCategory(state.category || "All", true);
  }
})();
