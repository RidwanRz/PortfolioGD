/**
 * RIDWAN STUDIO â€” PROJECT-BASED AESTHETIC ENGINE
 */

const INITIAL_PROJECTS = [];

const DEFAULT_SLIDES = [];

const state = {
  projects: [],
  categories: ['Crypto / Finance', 'Education'],
  activeCategory: 'all',
  activeView: 'grid',
  searchQuery: '',
  securityPin: localStorage.getItem('portfolio_pin') || '1234',
  uploadedImagesData: [], // Array of base64 for works
  uploadedCoverData: null,
  currentZoom: 1,
  lightboxIndex: 0,
  activeProject: null, // If null, show projects. If set, show works inside project.
  heroSlides: [],
  tempSlideImg: null
};

// â”€â”€â”€ API DATABASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function dbFetchFull() {
  try {
    const res = await fetch('http://localhost:3000/api/data');
    if (!res.ok) return { projects: [] };
    return await res.json();
  } catch { return { projects: [] }; }
}

async function dbPut(project) {
  const db = await dbFetchFull();
  const current = db.projects || [];
  const idx = current.findIndex(p => p.id === project.id);
  if (idx > -1) current[idx] = project;
  else current.push(project);
  
  db.projects = current;
  
  await fetch('http://localhost:3000/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  });
}

async function dbDelete(id) {
  const db = await dbFetchFull();
  let current = db.projects || [];
  current = current.filter(p => p.id !== id);
  db.projects = current;
  
  await fetch('http://localhost:3000/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  });
}

async function uploadImageFile(file, projectName, type = '') {
  const formData = new FormData();
  formData.append('project', projectName);
  if (type) formData.append('type', type);
  formData.append('image', file);
  
  const res = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return data.path;
}

// â”€â”€â”€ BOOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadProjects();
  
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('project');
  if (pid) {
    state.activeProject = state.projects.find(p => p.id === pid) || null;
  }
  history.replaceState({ projectId: state.activeProject ? state.activeProject.id : null }, '', window.location.href);

  bindEvents();
  setupDropzone();
  setupAdminTabs();
  renderAll();
  
  if (sessionStorage.getItem('studio_logged_in') === 'true') {
    openAdminModal();
  }
});

// â”€â”€â”€ DATA LOAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadProjects() {
  const db = await dbFetchFull();
  
  if (db.settings) {
    state.settings = { ...state.settings, ...db.settings };
  } else {
    state.settings = { publicViews: true };
  }
  
  const custom = db.projects || [];
  const deleted = db.deletedInitials || JSON.parse(localStorage.getItem('deleted_initials') || '[]');
  
  const customIds = custom.map(c => c.id);
  const initial = INITIAL_PROJECTS.filter(a => !deleted.includes(a.id) && !customIds.includes(a.id));
  state.projects = [...initial, ...custom.filter(c => c.id !== 'hero_slides')];
  
  const slidesRec = custom.find(c => c.id === 'hero_slides');
  state.heroSlides = slidesRec ? slidesRec.slides : [...DEFAULT_SLIDES];
}

async function loadCategories() {
  const db = await dbFetchFull();
  const custom = db.customCategories || JSON.parse(localStorage.getItem('custom_categories') || '[]');
  state.categories = Array.from(new Set([...custom]));
}

async function saveCustomCategories() {
  const custom = state.categories;
  localStorage.setItem('custom_categories', JSON.stringify(custom));
  
  const db = await dbFetchFull();
  db.customCategories = custom;
  await fetch('http://localhost:3000/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db)
  });
}

function getFilteredProjects() {
  return state.projects.filter(p => {
    const catOk = state.activeCategory === 'all' || p.category === state.activeCategory;
    const q = state.searchQuery.toLowerCase();
    const srcOk = !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q));
    return catOk && srcOk;
  });
}
// ─── UTILS ────────────────────────────────────────────────────────────────
let draggedItemData = null;

function initDragAndDrop(containerId, arrayRef, itemSelector, renderCallback, saveCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const items = container.querySelectorAll(itemSelector);

  items.forEach((item, index) => {
    item.setAttribute('draggable', 'true');
    item.style.cursor = 'grab';

    item.addEventListener('dragstart', e => {
      draggedItemData = { arrayRef, index, sourceContainerId: containerId };
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.style.opacity = '0.5', 0);
    });

    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      items.forEach(el => el.classList.remove('drag-over'));
      draggedItemData = null;
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedItemData && draggedItemData.sourceContainerId === containerId && draggedItemData.index !== index) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', async e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (draggedItemData && draggedItemData.sourceContainerId === containerId && draggedItemData.index !== index) {
        // Swap or Reorder in arrayRef
        const draggedIndex = draggedItemData.index;
        const targetIndex = index;
        
        // Remove item from old position and insert at new position
        const [movedItem] = arrayRef.splice(draggedIndex, 1);
        arrayRef.splice(targetIndex, 0, movedItem);

        if (renderCallback) renderCallback();
        if (saveCallback) await saveCallback();
      }
    });
  });
}

// ─── RENDERING ────────────────────────────────────────────────────────────
function renderAll() {
  renderCategorySelect();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderManageList === 'function') renderManageList();
  if (typeof renderCategoryList === 'function') renderCategoryList();
  if (typeof renderSliderAdmin === 'function') renderSliderAdmin();
  if (typeof renderFooterAdmin === 'function') renderFooterAdmin();
}

function renderDashboard() {
  const metricProjects = document.getElementById('metric-projects');
  const metricImages = document.getElementById('metric-images');
  const chartContainer = document.getElementById('dashboard-cat-chart');
  
  if (!metricProjects || !metricImages || !chartContainer) return;

  const totalProjects = state.projects.length;
  let totalImages = 0;
  
  const categoryCounts = {};
  state.categories.forEach(c => categoryCounts[c] = 0);

  state.projects.forEach(p => {
    // Count images
    if (p.coverImage) totalImages += 1;
    if (p.works && p.works.length) totalImages += p.works.length;
    
    // Count categories
    if (p.category && categoryCounts[p.category] !== undefined) {
      categoryCounts[p.category]++;
    } else if (p.category) {
      categoryCounts[p.category] = 1; // fallback if category not in list
    }
  });

  metricProjects.textContent = totalProjects;
  metricImages.textContent = totalImages;

  let maxCount = 0;
  for (const cat in categoryCounts) {
    if (categoryCounts[cat] > maxCount) maxCount = categoryCounts[cat];
  }

  // Build horizontal bar chart
  let chartHTML = '';
  const sortedCats = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);

  if (maxCount === 0) {
    chartHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No data to display. Upload projects to see metrics!</div>';
  } else {
    sortedCats.forEach(cat => {
      const count = categoryCounts[cat];
      const percentage = (count / maxCount) * 100;
      
      chartHTML += `
        <div style="display: flex; flex-direction: column; gap: 0.3rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600;">
            <span>${cat}</span>
            <span style="color: var(--text-muted);">${count}</span>
          </div>
          <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.05); border-radius: var(--rad-pill); overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: var(--accent); border-radius: var(--rad-pill); transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
    });
  }

  const metricViews = document.getElementById('metric-views');
  const topProjectsContainer = document.getElementById('dashboard-top-projects');
  
  if (metricViews) {
    let totalViews = 0;
    state.projects.forEach(p => totalViews += (p.views || 0));
    metricViews.textContent = totalViews;
  }

  if (topProjectsContainer) {
    const topProjects = [...state.projects].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    
    if (topProjects.length === 0) {
      topProjectsContainer.innerHTML = '<li style="color:var(--text-muted); font-size:0.9rem;">No data to display.</li>';
    } else {
      topProjectsContainer.innerHTML = topProjects.map((p, idx) => `
        <li style="display:flex; justify-content:space-between; align-items:center; padding: 0.8rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-lt); border-radius: var(--rad-sm);">
          <div style="display:flex; align-items:center; gap: 1rem;">
            <span style="font-weight:700; color:var(--text-muted); width: 20px;">#${idx+1}</span>
            <img src="${p.coverImage}" style="width: 40px; height: 40px; object-fit: cover; border-radius: var(--rad-sm);">
            <strong style="font-size:0.95rem; color:var(--text-main);">${p.title}</strong>
          </div>
          <span class="badge" style="background:var(--bg-card); border: 1px solid var(--border); color:var(--accent);"><i class="fa-regular fa-eye"></i> ${p.views || 0}</span>
        </li>
      `).join('');
    }
  }
  
  const toggleViews = document.getElementById('toggle-public-views');
  if (toggleViews) {
    // Check state and init UI
    toggleViews.checked = state.settings && state.settings.publicViews !== false;
    
    // Unbind previous to prevent duplicates
    const newToggle = toggleViews.cloneNode(true);
    toggleViews.parentNode.replaceChild(newToggle, toggleViews);
    
    newToggle.addEventListener('change', async (e) => {
      if (!state.settings) state.settings = {};
      state.settings.publicViews = e.target.checked;
      
      const db = await dbFetchFull();
      db.settings = state.settings;
      try {
        await fetch('http://localhost:3000/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(db)
        });
        showToast('Settings saved.', 'success');
      } catch (err) {
        showToast('Failed to save settings.', 'error');
      }
    });
  }

  chartContainer.innerHTML = chartHTML;
}

function updateHero() {
  const badge = document.getElementById('hero-badge');
  const title = document.getElementById('hero-title');
  const subtitle = document.getElementById('hero-subtitle');
  const backBtn = document.getElementById('back-to-projects-btn');
  const statLabel = document.getElementById('stat-total-label');

  if (!state.activeProject) {
    if (badge) badge.textContent = "GRAPHICS DESIGN PORTFOLIO";
    if (title) title.innerHTML = 'PREMIUM<br><span class="text-accent">VISUALS</span> THAT<br>MOVE FAST.';
    subtitle.textContent = 'High-impact infographics, editorial design, and data visualization crafted for forward-thinking brands.';
    if (statLabel) statLabel.textContent = 'TOTAL PROJECTS';
    backBtn.classList.add('hidden');
  } else {
    badge.textContent = state.activeProject.category.toUpperCase();
    title.innerHTML = state.activeProject.title.toUpperCase();
    const rawDesc = state.activeProject.description || 'Project details.';
    subtitle.innerHTML = typeof marked !== 'undefined' ? marked.parse(rawDesc) : rawDesc;
    if (statLabel) statLabel.textContent = 'TOTAL WORKS';
    backBtn.classList.remove('hidden');
  }
}

function renderCategoryNav() {
  const container = document.getElementById('category-filters');
  
  let pillsData = [];
  if (!state.activeProject) {
    pillsData = [ { cat: 'all', label: 'ALL' }, ...state.categories.map(c => ({ cat: c, label: c })) ];
  } else {
    const works = state.activeProject.works || [];
    const uniqueCats = Array.from(new Set(works.map(w => w.category).filter(Boolean)));
    pillsData = [ { cat: 'all', label: 'ALL' }, ...uniqueCats.map(c => ({ cat: c, label: c.toUpperCase() })) ];
  }

  container.innerHTML = pillsData.map(p => `
    <button class="cat-pill ${state.activeCategory === p.cat ? 'active' : ''}" data-category="${p.cat}">
      ${p.label}
    </button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(btn =>
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      renderCategoryNav();
      renderAll();
    })
  );
}

function renderCategorySelect() {
  const sel = document.getElementById('artwork-category');
  if (sel) sel.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderGrid() {
  const grid = document.getElementById('portfolio-grid');
  const empty = document.getElementById('empty-state');
  const badgeTotal = document.getElementById('stat-total-badge');
  
  grid.className = `portfolio-grid view-${state.activeView}`;

  if (!state.activeProject) {
    // Render Projects
    const filtered = getFilteredProjects();
    badgeTotal.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    
    grid.innerHTML = filtered.map(item => `
      <article class="portfolio-card project-card" data-id="${item.id}">
        <div class="card-media">
          <img src="${item.coverImage}" alt="${item.title}" loading="lazy" style="object-fit: contain; padding: 2rem; background: var(--bg);">
        </div>
        <div class="card-info">
          <div class="card-top">
            <span class="cat-badge">${item.category}</span>
            <span class="card-date">${item.date || ''}</span>
          </div>
          <div class="card-top" style="align-items: flex-end; margin-top: auto;">
            <div>
              <h3 class="card-title">${item.title}</h3>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${(item.works || []).length} Works</p>
            </div>
            <div class="card-arrow"><i class="fa-solid fa-arrow-right"></i></div>
          </div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => {
        state.activeProject = state.projects.find(p => p.id === card.dataset.id);
        state.activeCategory = 'all'; // Reset category when entering a project
        history.pushState({ projectId: state.activeProject.id }, '', '?project=' + state.activeProject.id);
        renderAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

  } else {
    // Render Works inside Active Project
    let works = state.activeProject.works || [];
    
    // Filter internal works by active category tab
    if (state.activeCategory !== 'all') {
      works = works.filter(w => w.category === state.activeCategory);
    }
    
    badgeTotal.textContent = works.length;

    if (works.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    
    grid.innerHTML = works.map((item, idx) => `
      <article class="portfolio-card work-card" data-idx="${idx}">
        <div class="card-media">
          <img src="${item.image}" alt="${item.title}" loading="lazy">
        </div>
        <div class="card-info" style="flex: none; padding: 1rem;">
          <h3 class="card-title" style="font-size: 1.1rem;">${item.title || 'Untitled'}</h3>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.work-card').forEach(card => {
      card.addEventListener('click', () => openLightbox(parseInt(card.dataset.idx)));
    });
  }
}

// â”€â”€â”€ LIGHTBOX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openLightbox(idx) {
  if (!state.activeProject) return;
  const works = state.activeProject.works || [];
  if (!works.length) return;

  state.lightboxIndex = Math.max(0, Math.min(idx, works.length - 1));
  populateLightbox(works[state.lightboxIndex]);
  document.getElementById('lightbox-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  const works = state.activeProject.works || [];
  state.lightboxIndex = (state.lightboxIndex + dir + works.length) % works.length;
  state.currentZoom = 1;
  document.getElementById('lightbox-img').style.transform = 'scale(1)';
  document.getElementById('zoom-level').textContent = '100%';
  populateLightbox(works[state.lightboxIndex]);
}

function populateLightbox(work) {
  document.getElementById('lightbox-img').src = work.image;
  document.getElementById('lightbox-title').textContent = work.title || 'Untitled';
  document.getElementById('lightbox-date').textContent = state.activeProject.title; // Show project name here
  document.getElementById('lightbox-description').textContent = '';
  document.getElementById('lightbox-category').textContent = state.activeProject.category;
  
  const tagsEl = document.getElementById('lightbox-tags');
  tagsEl.innerHTML = ''; // Specific tags removed for brevity, or can inherit from project
  
  const dl = document.getElementById('lightbox-download');
  dl.href = work.image;
  dl.download = (work.title || 'work').replace(/\s+/g, '_') + '.jpg';
}

function setZoom(z) {
  state.currentZoom = Math.min(3, Math.max(0.5, z));
  document.getElementById('lightbox-img').style.transform = `scale(${state.currentZoom})`;
  document.getElementById('zoom-level').textContent = Math.round(state.currentZoom * 100) + '%';
}

// â”€â”€â”€ PIN & ADMIN MODALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openPinModal() {
  document.getElementById('pin-modal').classList.remove('hidden');
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').classList.add('hidden');
  setTimeout(() => document.getElementById('pin-input').focus(), 100);
}
function closePinModal() { document.getElementById('pin-modal').classList.add('hidden'); }

function openAdminModal() {
  document.getElementById('pin-screen')?.classList.add('hidden');
  document.getElementById('studio-interface')?.classList.add('active');
  if (typeof renderManageList === 'function') renderManageList();
}
function closeAdminModal() { 
  document.getElementById('studio-interface')?.classList.remove('active');
  document.getElementById('pin-screen')?.classList.remove('hidden');
}

function setupAdminTabs() {
  document.querySelectorAll('.stab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stab, .stab-content').forEach(el => el.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// â”€â”€â”€ UPLOAD & DROPZONE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setupDropzone() {
  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const previewGallery = document.getElementById('preview-gallery');
  
  const renderPreviewGallery = () => {
    const summaryText = document.getElementById('dz-summary-text');
    const inlineThumbnails = document.getElementById('inline-thumbnails');
    
    if (state.uploadedImagesData.length > 0) {
      document.getElementById('dropzone-prompt').classList.add('hidden');
      document.getElementById('dropzone-preview').classList.remove('hidden');
      if(summaryText) summaryText.textContent = `${state.uploadedImagesData.length} Image(s) Staged`;
      
      if (inlineThumbnails) {
        inlineThumbnails.innerHTML = state.uploadedImagesData.map(img => `<img src="${img.src}" alt="${img.title || ''}">`).join('');
      }
    } else {
      document.getElementById('dropzone-preview').classList.add('hidden');
      document.getElementById('dropzone-prompt').classList.remove('hidden');
      if(summaryText) summaryText.textContent = '0 Images Staged';
      if (inlineThumbnails) inlineThumbnails.innerHTML = '';
    }
  };

  const renderPreUploadModal = () => {
    const list = document.getElementById('pre-upload-list');
    if (!list) return;
    
    list.innerHTML = state.uploadedImagesData.map((img, idx) => `
      <div class="edit-work-item" style="display:flex; gap: 1rem; align-items: flex-start; background: var(--bg); padding: 1rem; border: 1px solid var(--border); border-radius: var(--rad-sm);">
        <img src="${img.src}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--rad-sm);" alt="">
        <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
          <input type="text" class="dz-work-title" data-idx="${idx}" value="${img.title || ''}" placeholder="Image Title" style="width:100%;">
          <input type="text" class="dz-work-category" data-idx="${idx}" value="${img.category || ''}" placeholder="Image Category (e.g., News, Tutorials)" style="width:100%;">
          <textarea class="dz-work-desc" data-idx="${idx}" rows="2" placeholder="Image Description" style="width:100%; font-size:0.85rem; padding: 0.5rem;">${img.description || ''}</textarea>
        </div>
        <button type="button" class="btn-danger btn-sm remove-dz-work-btn" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
      </div>
    `).join('');
    
    list.querySelectorAll('.dz-work-title').forEach(input => {
      input.addEventListener('input', e => { state.uploadedImagesData[e.target.dataset.idx].title = e.target.value; });
    });
    list.querySelectorAll('.dz-work-category').forEach(input => {
      input.addEventListener('input', e => { state.uploadedImagesData[e.target.dataset.idx].category = e.target.value; });
    });
    list.querySelectorAll('.dz-work-desc').forEach(input => {
      input.addEventListener('input', e => { state.uploadedImagesData[e.target.dataset.idx].description = e.target.value; });
    });
    list.querySelectorAll('.remove-dz-work-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        state.uploadedImagesData.splice(btn.dataset.idx, 1);
        renderPreUploadModal();
        renderPreviewGallery();
        if(state.uploadedImagesData.length === 0) {
          document.getElementById('pre-upload-modal').classList.add('hidden');
        }
      });
    });

    initDragAndDrop('pre-upload-list', state.uploadedImagesData, '.edit-work-item', renderPreUploadModal, null);
  };

  const handleFiles = files => {
    let added = false;
    for(let file of files) {
      if (!file || !file.type.startsWith('image/')) continue;
      
      let baseName = file.name;
      const lastDot = baseName.lastIndexOf('.');
      if (lastDot !== -1) baseName = baseName.substring(0, lastDot);
      
      state.uploadedImagesData.push({ 
        src: URL.createObjectURL(file), 
        file: file, 
        name: file.name,
        title: baseName,
        category: '',
        description: ''
      });
      added = true;
    }
    
    if (added) {
      renderPreviewGallery();
      renderPreUploadModal();
      document.getElementById('pre-upload-modal').classList.remove('hidden');
    }
  };

  document.getElementById('browse-btn').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  dz.addEventListener('click', e => { if(e.target === dz) fileInput.click(); });
  fileInput.addEventListener('change', e => handleFiles(e.target.files));
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--accent)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = 'var(--border-lt)'; });
  dz.addEventListener('drop', e => { e.preventDefault(); dz.style.borderColor = 'var(--border-lt)'; handleFiles(e.dataTransfer.files); });
  
  document.getElementById('remove-img-btn').addEventListener('click', e => {
    e.stopPropagation();
    state.uploadedImagesData = [];
    fileInput.value = '';
    renderPreviewGallery();
  });

  document.getElementById('review-uploads-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    renderPreUploadModal();
    document.getElementById('pre-upload-modal').classList.remove('hidden');
  });

  document.getElementById('close-preupload-modal')?.addEventListener('click', () => {
    document.getElementById('pre-upload-modal').classList.add('hidden');
  });

  document.getElementById('save-preupload-btn')?.addEventListener('click', () => {
    document.getElementById('pre-upload-modal').classList.add('hidden');
  });

  // â”€â”€â”€ Cover Dropzone â”€â”€â”€
  const coverDz = document.getElementById('cover-dropzone');
  const coverInput = document.getElementById('cover-input');
  
  const handleCoverFile = file => {
    if (!file || !file.type.startsWith('image/')) return;
    state.uploadedCoverData = { src: URL.createObjectURL(file), file: file };
    document.getElementById('cover-dz-prompt').classList.add('hidden');
    document.getElementById('cover-preview').classList.remove('hidden');
    document.getElementById('cover-preview-img').src = state.uploadedCoverData.src;
  };
  
  if (coverDz && coverInput) {
    coverDz.addEventListener('click', e => { 
      if (e.target.closest('#remove-cover-btn') || e.target.closest('#cover-preview')) return;
      coverInput.click(); 
    });
    coverInput.addEventListener('change', e => handleCoverFile(e.target.files[0]));
    coverDz.addEventListener('dragover', e => { e.preventDefault(); coverDz.style.borderColor = 'var(--accent)'; });
    coverDz.addEventListener('dragleave', () => { coverDz.style.borderColor = 'var(--border-lt)'; });
    coverDz.addEventListener('drop', e => { e.preventDefault(); coverDz.style.borderColor = 'var(--border-lt)'; handleCoverFile(e.dataTransfer.files[0]); });
    
    document.getElementById('remove-cover-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      state.uploadedCoverData = null;
      coverInput.value = '';
      document.getElementById('cover-preview').classList.add('hidden');
      document.getElementById('cover-preview-img').src = '';
      document.getElementById('cover-dz-prompt').classList.remove('hidden');
    });
  }
}

async function handleUploadSubmit(e) {
  e.preventDefault();
  if (!state.uploadedCoverData) { showToast('Select a project cover/logo image.', 'error'); return; }

  const title = document.getElementById('artwork-title').value.trim();
  
  try {
    const coverImage = state.uploadedCoverData.file ? await uploadImageFile(state.uploadedCoverData.file, title, 'logo') : state.uploadedCoverData.src;

    const works = [];
    for (let i = 0; i < state.uploadedImagesData.length; i++) {
      const img = state.uploadedImagesData[i];
      const imagePath = img.file ? await uploadImageFile(img.file, title, 'works') : img.src;
      works.push({
        id: `w-${Date.now()}-${i}`,
        image: imagePath,
        title: img.title || `${title} - Part ${i + 1}`,
        category: img.category || '',
        description: img.description || ''
      });
    }

    const project = {
      id: `proj-${Date.now()}`,
      title,
      category: document.getElementById('artwork-category').value,
      status: document.getElementById('artwork-status')?.value || 'live',
      coverImage,
      date: document.getElementById('artwork-date').value || new Date().toISOString().split('T')[0],
      tags: document.getElementById('artwork-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      description: document.getElementById('artwork-desc').value.trim(),
      isInitial: false,
      works
    };

    await dbPut(project);
    state.projects.unshift(project);
    document.getElementById('upload-artwork-form').reset();
    document.getElementById('remove-img-btn').click();
    state.uploadedCoverData = null;
    document.getElementById('cover-preview').classList.add('hidden');
    document.getElementById('cover-preview-img').src = '';
    document.getElementById('cover-input').value = '';
    document.getElementById('cover-dz-prompt').classList.remove('hidden');
    renderAll();
    showToast('Project Published.', 'success');
  } catch(e) {
    console.error(e);
    showToast('Upload Failed.', 'error');
  }
}

// â”€â”€â”€ MANAGE LIST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderManageList() {
  const container = document.getElementById('manage-list-container');
  if (!container) return;
  if (!state.projects.length) { container.innerHTML = '<p style="color:var(--text-muted)">No projects found.</p>'; return; }

  container.innerHTML = state.projects.map(item => `
    <div class="manage-item">
      <div class="manage-item-left">
        <input type="checkbox" class="manage-item-checkbox" data-id="${item.id}" style="margin-right: 0.5rem; cursor: pointer;">
        <img src="${item.coverImage}" class="manage-thumb" alt="">
        <div>
            <span class="manage-title" style="display:inline-block;">${item.title}</span>
            ${item.status === 'draft' ? '<span class="badge" style="background:var(--accent); color:var(--bg); margin-left:0.5rem; font-size:0.6rem;">DRAFT</span>' : ''}
            <span style="font-size:0.75rem; color:var(--text-muted); display:block;">${(item.works || []).length} Works</span>
        </div>
      </div>
      <div>
        <button class="btn-secondary btn-sm edit-btn" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" data-id="${item.id}">EDIT</button>
        <button class="btn-danger btn-sm del-btn" data-id="${item.id}">DEL</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.del-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteProject(btn.dataset.id))
  );
  
  container.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  );

  const checkboxes = container.querySelectorAll('.manage-item-checkbox');
  const selectAll = document.getElementById('manage-select-all');
  
  const updateBulkActions = () => {
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const count = checked.length;
    const total = checkboxes.length;
    
    const liveSelectAll = document.getElementById('manage-select-all');
    if (liveSelectAll) {
      liveSelectAll.checked = (count === total && total > 0);
    }
    
    document.getElementById('bulk-selected-count').textContent = `${count} Selected`;
    
    if (count > 0) {
      document.getElementById('manage-default-actions').style.display = 'none';
      document.getElementById('manage-bulk-actions').style.display = 'flex';
      // Populate category select
      const catSelect = document.getElementById('bulk-category-select');
      const prevVal = catSelect.value;
      catSelect.innerHTML = '<option value="">Change Category...</option>' + state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
      catSelect.value = prevVal;
    } else {
      document.getElementById('manage-default-actions').style.display = 'block';
      document.getElementById('manage-bulk-actions').style.display = 'none';
    }
  };

  checkboxes.forEach(cb => cb.addEventListener('change', updateBulkActions));
  
  if (selectAll) {
    // Unbind any old listeners if this is re-rendered (replace node)
    const newSelectAll = selectAll.cloneNode(true);
    if (selectAll.parentNode) {
      selectAll.parentNode.replaceChild(newSelectAll, selectAll);
    }
    
    newSelectAll.checked = false;
    newSelectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      checkboxes.forEach(cb => { cb.checked = isChecked; });
      updateBulkActions();
    });
  }
  
  updateBulkActions();

  // Prevent drag-and-drop from triggering when clicking on checkboxes
  container.querySelectorAll('.manage-item-checkbox').forEach(cb => {
    cb.addEventListener('mousedown', e => e.stopPropagation());
    cb.addEventListener('click', e => e.stopPropagation());
  });

  initDragAndDrop(
    'manage-list-container', 
    state.projects, 
    '.manage-item', 
    renderManageList, 
    async () => {
      const db = await dbFetchFull();
      db.projects = state.projects;
      await fetch('http://localhost:3000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      renderGrid();
    }
  );
}

let currentEditCover = null;

function openEditModal(id) {
  const project = state.projects.find(p => p.id === id);
  if (!project) return;
  
  document.getElementById('edit-project-id').value = project.id;
  document.getElementById('edit-title').value = project.title;
  
  currentEditCover = project.coverImage || '';
  document.getElementById('edit-cover-preview').src = currentEditCover;
  document.getElementById('edit-cover-input').value = '';
  
  const catSelect = document.getElementById('edit-category');
  catSelect.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
  catSelect.value = project.category;
  
  const statusSelect = document.getElementById('edit-status');
  if (statusSelect) statusSelect.value = project.status || 'live';
  
  document.getElementById('edit-date').value = project.date || '';
  document.getElementById('edit-tags').value = (project.tags || []).join(', ');
  document.getElementById('edit-desc').value = project.description || '';
  
  currentEditWorks = JSON.parse(JSON.stringify(project.works || []));
  renderEditWorksList();
  
  document.getElementById('edit-project-modal').classList.remove('hidden');
}

let currentEditWorks = [];

function renderEditWorksList() {
  const container = document.getElementById('edit-works-list');
  if (!container) return;
  if (!currentEditWorks.length) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No images in this project.</p>';
    return;
  }
  
  container.innerHTML = currentEditWorks.map((work, idx) => `
    <div class="edit-work-item" style="display:flex; gap: 1rem; align-items: flex-start; background: var(--bg); padding: 1rem; border: 1px solid var(--border); border-radius: var(--rad-sm);">
      <img src="${work.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--rad-sm);" alt="">
      <div style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
        <input type="text" class="edit-work-title" data-idx="${idx}" value="${work.title || ''}" placeholder="Image Title" style="width:100%;">
        <input type="text" class="edit-work-category" data-idx="${idx}" value="${work.category || ''}" placeholder="Image Category (e.g., News, Tutorials)" style="width:100%;">
        <textarea class="edit-work-desc" data-idx="${idx}" rows="2" placeholder="Image Description" style="width:100%; font-size:0.85rem; padding: 0.5rem;">${work.description || ''}</textarea>
      </div>
      <button type="button" class="btn-danger btn-sm remove-edit-work-btn" data-idx="${idx}"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.edit-work-title').forEach(input => {
    input.addEventListener('input', e => {
      currentEditWorks[e.target.dataset.idx].title = e.target.value;
    });
  });

  container.querySelectorAll('.edit-work-category').forEach(input => {
    input.addEventListener('input', e => {
      currentEditWorks[e.target.dataset.idx].category = e.target.value;
    });
  });
  
  container.querySelectorAll('.edit-work-desc').forEach(input => {
    input.addEventListener('input', e => {
      currentEditWorks[e.target.dataset.idx].description = e.target.value;
    });
  });

  container.querySelectorAll('.remove-edit-work-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentEditWorks.splice(btn.dataset.idx, 1);
      renderEditWorksList();
    });
  });

  initDragAndDrop('edit-works-list', currentEditWorks, '.edit-work-item', renderEditWorksList, null);
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-project-id').value;
  const projectIndex = state.projects.findIndex(p => p.id === id);
  if (projectIndex === -1) return;
  
  const title = document.getElementById('edit-title').value.trim();

  try {
    let coverImage = currentEditCover;
    if (typeof currentEditCover === 'object' && currentEditCover !== null && currentEditCover.file) {
      coverImage = await uploadImageFile(currentEditCover.file, title, 'logo');
    }
    
    for (let w of currentEditWorks) {
      if (w.file) {
        w.image = await uploadImageFile(w.file, title, 'works');
        delete w.file;
      }
    }

    const updatedProject = {
      ...state.projects[projectIndex],
      title,
      category: document.getElementById('edit-category').value,
      status: document.getElementById('edit-status')?.value || 'live',
      coverImage,
      date: document.getElementById('edit-date').value,
      tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      description: document.getElementById('edit-desc').value.trim(),
      works: currentEditWorks
    };
    
    await dbPut(updatedProject);
    state.projects[projectIndex] = updatedProject;
    document.getElementById('edit-project-modal').classList.add('hidden');
    renderAll();
    showToast('Project Updated.', 'success');
  } catch(err) {
    console.error(err);
    showToast('Update Failed.', 'error');
  }
}

async function deleteProject(id) {
  const item = state.projects.find(a => a.id === id);
  if (!item || !confirm(`Delete project "${item.title}"?`)) return;

  if (item.isInitial || INITIAL_PROJECTS.some(p => p.id === id)) {
    const db = await dbFetchFull();
    const del = db.deletedInitials || JSON.parse(localStorage.getItem('deleted_initials') || '[]');
    if (!del.includes(id)) {
      del.push(id);
      db.deletedInitials = del;
      localStorage.setItem('deleted_initials', JSON.stringify(del));
      
      await fetch('http://localhost:3000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
    }
  }
  
  try { 
    await fetch('http://localhost:3000/api/images/' + encodeURIComponent(item.title), { method: 'DELETE' });
  } catch(e) { console.error('Failed to delete images', e); }
  
  try { await dbDelete(id); } catch(e) {}

  state.projects = state.projects.filter(a => a.id !== id);
  if (state.activeProject && state.activeProject.id === id) state.activeProject = null;
  renderAll();
  showToast('Project Deleted.', 'success');
}

// â”€â”€â”€ SLIDER MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderSliderAdmin() {
  const ul = document.getElementById('admin-slider-list');
  const count = document.getElementById('slider-count');
  if (!ul || !count) return;

  count.textContent = `${state.heroSlides.length} / 10`;
  
  ul.innerHTML = state.heroSlides.map(slide => `
    <li class="cat-list-item slider-item" data-id="${slide.id}" style="display:flex; gap:1rem; align-items:center; padding: 1rem; cursor: grab;">
      <i class="fa-solid fa-grip-vertical" style="color:var(--text-muted); font-size:1.2rem; margin-right: 0.5rem; cursor: grab;"></i>
      <img src="${slide.image}" style="width: 100px; height: 60px; object-fit: cover; border-radius: var(--rad-sm); border: 1px solid var(--border);">
      <div style="flex:1; overflow:hidden;">
        <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; font-size:1rem; margin-bottom: 0.2rem;">${slide.title}</strong>
        <span style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${slide.desc}</span>
      </div>
      <button class="btn-danger btn-sm del-slide-btn" data-id="${slide.id}"><i class="fa-solid fa-xmark"></i></button>
    </li>
  `).join('');

  document.querySelectorAll('.del-slide-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation(); // prevent drag
      const id = e.currentTarget.dataset.id;
      if (!confirm('Delete this slide?')) return;
      state.heroSlides = state.heroSlides.filter(s => s.id !== id);
      await saveSlides();
      renderAll();
      showToast('Slide Deleted.', 'success');
    });
  });

  initDragAndDrop(
    'admin-slider-list',
    state.heroSlides,
    '.slider-item',
    renderSliderAdmin,
    async () => {
      await saveSlides();
      renderAll(); // Updates the actual public slider preview if it was loaded, but just in case
    }
  );
  
  const form = document.getElementById('add-slide-form');
  if (form) {
    const btn = form.querySelector('button[type="submit"]');
    if (state.heroSlides.length >= 10) {
      btn.disabled = true;
      btn.textContent = 'MAXIMUM SLIDES REACHED';
    } else {
      btn.disabled = false;
      btn.textContent = 'ADD SLIDE';
    }
  }

  const imgSelect = document.getElementById('slide-project-img-select');
  if (imgSelect) {
    let opts = '<option value="">Select from existing works...</option>';
    state.projects.forEach(p => {
      if (p.works && p.works.length > 0) {
        opts += `<optgroup label="${p.title}">`;
        p.works.forEach((w, idx) => {
          opts += `<option value="${p.id}::${idx}">${w.title || 'Image ' + (idx+1)}</option>`;
        });
        opts += `</optgroup>`;
      }
    });
    imgSelect.innerHTML = opts;
  }
  
  initDragAndDrop('admin-slider-list', state.heroSlides, '.cat-list-item', renderSliderAdmin, saveSlides);
}

async function saveSlides() {
  await dbPut({ id: 'hero_slides', slides: state.heroSlides });
}

// â”€â”€â”€ CATEGORY MANAGEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderCategoryList() {
  const ul = document.getElementById('admin-cat-list');
  if (!ul) return;
  
  ul.style.display = 'flex';
  ul.style.flexDirection = 'column';
  ul.style.gap = '0.5rem';

  ul.innerHTML = state.categories.map(cat => {
    const count = state.projects.filter(p => p.category === cat).length;
    return `
      <li class="cat-list-item" style="display:flex; justify-content:space-between; align-items:center; padding: 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--rad-sm);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <strong style="font-size:1.1rem; color: var(--text-main);">${cat}</strong>
          <span class="badge" style="background:var(--accent); color:var(--bg); font-size:0.7rem;">${count} Projects</span>
        </div>
        <div style="display:flex; gap: 0.5rem;">
          <button class="btn-secondary btn-sm edit-cat-btn" data-cat="${cat}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-danger btn-sm del-cat-btn" data-cat="${cat}"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </li>
    `;
  }).join('');

  ul.querySelectorAll('.del-cat-btn').forEach(btn =>
    btn.addEventListener('click', async () => {
      const cat = btn.dataset.cat;
      if (!confirm(`Delete category "${cat}"? Projects inside will lose this category.`)) return;
      state.categories = state.categories.filter(c => c !== cat);
      await saveCustomCategories();
      renderAll();
      showToast('Category Removed.', 'success');
    })
  );

  ul.querySelectorAll('.edit-cat-btn').forEach(btn =>
    btn.addEventListener('click', async () => {
      const oldCat = btn.dataset.cat;
      const newCat = prompt(`Rename category "${oldCat}" to:`, oldCat);
      if (!newCat || newCat.trim() === '' || newCat.trim() === oldCat) return;
      
      const trimmedNewCat = newCat.trim();
      if (state.categories.includes(trimmedNewCat)) {
        showToast('A category with that name already exists.', 'error');
        return;
      }

      // Update in categories list
      const idx = state.categories.indexOf(oldCat);
      if (idx !== -1) {
        state.categories[idx] = trimmedNewCat;
      }
      
      // Update in projects list
      state.projects.forEach(p => {
        if (p.category === oldCat) p.category = trimmedNewCat;
      });

      // Save categories
      await saveCustomCategories();
      
      // Save projects
      const db = await dbFetchFull();
      db.projects = state.projects;
      try {
        await fetch('http://localhost:3000/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(db)
        });
        renderAll();
        showToast(`Category renamed to "${trimmedNewCat}".`, 'success');
      } catch (err) {
        showToast('Failed to save project updates.', 'error');
      }
    })
  );
}

document.getElementById('add-category-form')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('new-cat-name');
  const name = input.value.trim();
  if (!name || state.categories.includes(name)) { showToast('Invalid or existing category.', 'error'); return; }
  state.categories.push(name);
  saveCustomCategories();
  input.value = '';
  renderAll();
  showToast('Category Added.', 'success');
});

// â”€â”€â”€ EXPORT / IMPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById('export-data-btn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.projects, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'Backup.json' });
  document.body.appendChild(a); a.click(); a.remove(); showToast('Backup Downloaded.', 'success');
});

document.getElementById('import-data-btn')?.addEventListener('click', () => document.getElementById('import-file-input').click());
document.getElementById('import-file-input')?.addEventListener('change', async e => {
  if (!e.target.files[0]) return;
  try {
    const imported = JSON.parse(await e.target.files[0].text());
    
    const importedIds = imported.map(i => i.id);
    let deleted = JSON.parse(localStorage.getItem('deleted_initials') || '[]');
    deleted = deleted.filter(id => !importedIds.includes(id));
    localStorage.setItem('deleted_initials', JSON.stringify(deleted));
    
    for (const item of imported) {
      await dbPut(item);
    }
    
    await loadProjects(); 
    renderAll(); 
    showToast('Backup Restored.', 'success');
  } catch { 
    showToast('Invalid backup file.', 'error'); 
  } finally {
    e.target.value = '';
  }
});

// â”€â”€â”€ EVENT BINDINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function bindEvents() {
  document.getElementById('pin-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if (document.getElementById('pin-input').value === state.securityPin) {
      sessionStorage.setItem('studio_logged_in', 'true');
      openAdminModal(); 
      showToast('System Unlocked.', 'success');
    } else { document.getElementById('pin-error').classList.remove('hidden'); }
  });

  document.getElementById('exit-studio-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem('studio_logged_in');
  });

  document.getElementById('upload-artwork-form')?.addEventListener('submit', handleUploadSubmit);
  document.getElementById('edit-project-form')?.addEventListener('submit', handleEditSubmit);

  document.getElementById('edit-preview-btn')?.addEventListener('click', () => {
    const id = document.getElementById('edit-project-id').value;
    const projectIndex = state.projects.findIndex(p => p.id === id);
    if (projectIndex === -1) return;
    
    // We create a temporary project object replicating exactly what would be saved
    const previewProject = {
      ...state.projects[projectIndex],
      title: document.getElementById('edit-title').value.trim(),
      category: document.getElementById('edit-category').value,
      status: document.getElementById('edit-status')?.value || 'live',
      coverImage: typeof currentEditCover === 'object' && currentEditCover !== null && currentEditCover.src ? currentEditCover.src : currentEditCover,
      date: document.getElementById('edit-date').value,
      tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      description: document.getElementById('edit-desc').value.trim(),
      // ensure we use image src for any new works instead of file object for preview
      works: currentEditWorks.map(w => ({ ...w, image: w.src || w.image }))
    };

    localStorage.setItem('preview_project_data', JSON.stringify(previewProject));
    window.open('index.html?preview=true', '_blank');
  });

  // Cover input change is now handled in setupDropzone()
  
  document.getElementById('slide-upload-btn')?.addEventListener('click', () => {
    document.getElementById('slide-img-input').click();
  });

  document.getElementById('slide-project-img-select')?.addEventListener('change', e => {
    const val = e.target.value;
    if (val) {
      const [pid, wIndex] = val.split('::');
      const proj = state.projects.find(p => p.id === pid);
      if (proj && proj.works[wIndex]) {
        state.tempSlideImg = proj.works[wIndex].image;
        document.getElementById('slide-img-preview').src = state.tempSlideImg;
        document.getElementById('slide-img-preview').classList.remove('hidden');
        document.getElementById('slide-img-input').removeAttribute('required');
      }
    } else {
      state.tempSlideImg = null;
      document.getElementById('slide-img-preview').classList.add('hidden');
      document.getElementById('slide-img-preview').src = '';
      document.getElementById('slide-img-input').setAttribute('required', 'true');
    }
  });

  document.getElementById('slide-img-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      state.tempSlideImg = { src: URL.createObjectURL(file), file: file };
      document.getElementById('slide-img-preview').src = state.tempSlideImg.src;
      document.getElementById('slide-img-preview').classList.remove('hidden');
      document.getElementById('slide-project-img-select').value = '';
      document.getElementById('slide-img-input').removeAttribute('required');
    }
  });

  document.getElementById('add-slide-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.tempSlideImg) { showToast('Image required.', 'error'); return; }
    if (state.heroSlides.length >= 10) { showToast('Maximum slides reached.', 'error'); return; }

    try {
      const imagePath = state.tempSlideImg.file ? await uploadImageFile(state.tempSlideImg.file, 'Slides', 'works') : state.tempSlideImg;

      const newSlide = {
        id: 's' + Date.now(),
        image: imagePath,
        title: document.getElementById('slide-title-input').value.trim(),
        desc: document.getElementById('slide-desc-input').value.trim()
      };
      
      state.heroSlides.push(newSlide);
      await saveSlides();
      
      e.target.reset();
      state.tempSlideImg = null;
      document.getElementById('slide-img-preview').classList.add('hidden');
      document.getElementById('slide-img-preview').src = '';
      document.getElementById('slide-img-input').setAttribute('required', 'true');
      document.getElementById('slide-project-img-select').value = '';
      
      renderAll();
      showToast('Slide Added.', 'success');
    } catch(err) {
      console.error(err);
      showToast('Upload Failed.', 'error');
    }
  });
  document.getElementById('edit-cover-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      currentEditCover = { src: URL.createObjectURL(file), file: file };
      document.getElementById('edit-cover-preview').src = currentEditCover.src;
    }
  });

  document.getElementById('edit-add-image-btn')?.addEventListener('click', () => document.getElementById('edit-file-input').click());
  document.getElementById('edit-file-input')?.addEventListener('change', e => {
    const files = e.target.files;
    for(let file of files) {
      if (!file || !file.type.startsWith('image/')) continue;
      currentEditWorks.push({
        id: `w-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        image: URL.createObjectURL(file),
        file: file,
        title: 'New Image',
        description: ''
      });
      renderEditWorksList();
    }
    e.target.value = '';
  });

  document.getElementById('admin-settings-btn')?.addEventListener('click', () => document.getElementById('change-pin-modal').classList.remove('hidden'));
  document.getElementById('close-change-pin')?.addEventListener('click', () => document.getElementById('change-pin-modal').classList.add('hidden'));
  document.getElementById('close-edit-modal')?.addEventListener('click', () => document.getElementById('edit-project-modal').classList.add('hidden'));
  
  document.getElementById('change-pin-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const oldP = document.getElementById('old-pin-input').value;
    const newP = document.getElementById('new-pin-input').value;
    if (oldP !== state.securityPin) { showToast('Incorrect current PIN.', 'error'); return; }
    if (newP.length < 4) { showToast('PIN must be 4-8 chars.', 'error'); return; }
    state.securityPin = newP; localStorage.setItem('portfolio_pin', newP);
    document.getElementById('change-pin-modal').classList.add('hidden'); document.getElementById('change-pin-form').reset();
    showToast('PIN Updated.', 'success');
  });

  ['change-pin-modal', 'edit-project-modal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => { if (e.target === e.currentTarget) e.target.classList.add('hidden'); });
  });

  document.getElementById('manage-select-all')?.addEventListener('change', e => {
    const checkboxes = document.querySelectorAll('.manage-item-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
    // trigger change on first one to update toolbar
    if(checkboxes.length) checkboxes[0].dispatchEvent(new Event('change'));
  });

  document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
    const checkboxes = Array.from(document.querySelectorAll('.manage-item-checkbox:checked'));
    if (!checkboxes.length) return;
    if (!confirm(`Are you sure you want to delete ${checkboxes.length} projects?`)) return;
    
    const idsToDelete = checkboxes.map(cb => cb.dataset.id);
    const projectsToDelete = state.projects.filter(p => idsToDelete.includes(p.id));
    state.projects = state.projects.filter(p => !idsToDelete.includes(p.id));
    
    // Save to DB
    const db = await dbFetchFull();
    db.projects = state.projects;
    let deletedInitials = JSON.parse(localStorage.getItem('deleted_initials') || '[]');
    idsToDelete.forEach(id => {
      if (id.startsWith('proj-') && id.split('-').length === 2 && !deletedInitials.includes(id)) {
          // This is a naive check for initials, better to just push to deleted initials if it doesn't exist in custom anymore
          deletedInitials.push(id); 
      }
    });
    localStorage.setItem('deleted_initials', JSON.stringify(deletedInitials));
    db.deletedInitials = deletedInitials;

    try {
      await fetch('http://localhost:3000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      
      for (const p of projectsToDelete) {
        try {
          await fetch('http://localhost:3000/api/images/' + encodeURIComponent(p.title), { method: 'DELETE' });
        } catch(e) { console.error('Failed to delete images for', p.title, e); }
      }
      
      renderAll();
      showToast(`${idsToDelete.length} Projects Deleted.`, 'success');
    } catch(err) {
      showToast('Bulk Delete Failed.', 'error');
    }
  });

  document.getElementById('bulk-move-btn')?.addEventListener('click', async () => {
    const checkboxes = Array.from(document.querySelectorAll('.manage-item-checkbox:checked'));
    if (!checkboxes.length) return;
    const newCat = document.getElementById('bulk-category-select').value;
    if (!newCat) { showToast('Select a category to move to.', 'error'); return; }

    const idsToMove = checkboxes.map(cb => cb.dataset.id);
    state.projects.forEach(p => {
      if (idsToMove.includes(p.id)) {
        p.category = newCat;
      }
    });

    const db = await dbFetchFull();
    db.projects = state.projects;
    try {
      await fetch('http://localhost:3000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      renderAll();
      showToast(`${idsToMove.length} Projects Moved to ${newCat}.`, 'success');
      document.getElementById('manage-select-all').checked = false;
    } catch(err) {
      showToast('Bulk Move Failed.', 'error');
    }
  });
}

function showToast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  t.innerHTML = `<i class="fa-solid fa-circle-${type === 'error' ? 'exclamation' : 'check'}"></i> <span>${message}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

function renderFooterAdmin() {
  const emailInput = document.getElementById('footer-email');
  const dribbbleInput = document.getElementById('footer-dribbble');
  const behanceInput = document.getElementById('footer-behance');
  const twitterInput = document.getElementById('footer-twitter');
  const linkedinInput = document.getElementById('footer-linkedin');
  const instagramInput = document.getElementById('footer-instagram');
  const form = document.getElementById('footer-settings-form');
  
  if (!form) return;

  // Load state
  const fSettings = state.settings?.footer || {};
  if (emailInput) emailInput.value = fSettings.email || '';
  if (dribbbleInput) dribbbleInput.value = fSettings.dribbble || '';
  if (behanceInput) behanceInput.value = fSettings.behance || '';
  if (twitterInput) twitterInput.value = fSettings.twitter || '';
  if (linkedinInput) linkedinInput.value = fSettings.linkedin || '';
  if (instagramInput) instagramInput.value = fSettings.instagram || '';

  // Prevent multiple bindings
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  newForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.settings) state.settings = {};
    state.settings.footer = {
      email: document.getElementById('footer-email').value.trim(),
      dribbble: document.getElementById('footer-dribbble').value.trim(),
      behance: document.getElementById('footer-behance').value.trim(),
      twitter: document.getElementById('footer-twitter').value.trim(),
      linkedin: document.getElementById('footer-linkedin').value.trim(),
      instagram: document.getElementById('footer-instagram').value.trim()
    };
    
    const db = await dbFetchFull();
    db.settings = state.settings;
    try {
      await fetch('http://localhost:3000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db)
      });
      showToast('Footer settings saved.', 'success');
    } catch (err) {
      showToast('Failed to save settings.', 'error');
    }
  });
}
