/**
 * RIDWAN STUDIO — PROJECT-BASED AESTHETIC ENGINE
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
  settings: { publicViews: true }
};

// ─── API DATABASE ────────────────────────────────────────────────────────────
async function dbFetchFull() {
  try {
    // const res = await fetch('/api/data'); // <-- Revert to this if you switch back to a Node.js host
    const res = await fetch('/database.json'); // <-- Use this for static hosts like Netlify/Vercel
    if (!res.ok) return { projects: [] };
    return await res.json();
  } catch {
    return { projects: [] };
  }
}



// ─── BOOT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lenis Smooth Scroll
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });
    
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    // Make lenis globally available for modals
    window.lenis = lenis;
  }

  await loadCategories();
  await loadProjects();
  
  const urlParams = new URLSearchParams(window.location.search);
  const pid = urlParams.get('project');
  const isPreview = urlParams.get('preview') === 'true';

  if (isPreview) {
    try {
      const previewData = JSON.parse(localStorage.getItem('preview_project_data'));
      if (previewData) {
        state.activeProject = previewData;
        // Temporary banner to indicate preview mode
        const previewBanner = document.createElement('div');
        previewBanner.style.cssText = 'position:fixed; top:0; left:0; width:100%; background:var(--accent); color:var(--bg); text-align:center; padding:0.5rem; font-family:var(--font-display); font-weight:700; z-index:9999; letter-spacing:2px;';
        previewBanner.textContent = 'LIVE PREVIEW MODE — CHANGES NOT SAVED YET';
        document.body.appendChild(previewBanner);
        document.querySelector('.pill-nav').style.top = '3rem'; // Push nav down
      }
    } catch(e) {}
  } else if (pid) {
    state.activeProject = state.projects.find(p => p.id === pid) || null;
  }
  history.replaceState({ projectId: state.activeProject ? state.activeProject.id : null }, '', window.location.href);

  bindEvents();
  renderAll();
  initSlider();
});

// ─── DATA LOAD ────────────────────────────────────────────────────────────
async function loadProjects() {
  const db = await dbFetchFull();
  
  if (db.settings) {
    state.settings = { ...state.settings, ...db.settings };
  }
  
  const custom = db.projects || [];
  const deleted = db.deletedInitials || JSON.parse(localStorage.getItem('deleted_initials') || '[]');
  
  const customIds = custom.map(c => c.id);
  const initial = INITIAL_PROJECTS.filter(a => !deleted.includes(a.id) && !customIds.includes(a.id));
  const validCustom = custom.filter(c => c.id !== 'hero_slides' && c.status !== 'draft');
  state.projects = [...initial, ...validCustom];
  
  const slidesRec = custom.find(c => c.id === 'hero_slides');
  state.heroSlides = slidesRec ? slidesRec.slides : [...DEFAULT_SLIDES];
}

async function loadCategories() {
  const db = await dbFetchFull();
  const custom = db.customCategories || JSON.parse(localStorage.getItem('custom_categories') || '[]');
  state.categories = Array.from(new Set([...custom]));
}

function saveCustomCategories() {
  const custom = state.categories.filter(c => c !== 'Crypto / Finance' && c !== 'Education');
  localStorage.setItem('custom_categories', JSON.stringify(custom));
}

function getFilteredProjects() {
  return state.projects.filter(p => {
    const catOk = state.activeCategory === 'all' || p.category === state.activeCategory;
    const q = state.searchQuery.toLowerCase();
    const srcOk = !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q));
    return catOk && srcOk;
  });
}

// ─── RENDERING ────────────────────────────────────────────────────────────
function renderAll() {
  renderCategoryNav();
  renderCategorySelect();
  renderGrid();
  updateHero();
  renderFooter();
}

function updateHero() {
  const badge = document.getElementById('hero-badge');
  const title = document.getElementById('hero-title');
  const subtitle = document.getElementById('hero-subtitle');
  const backBtn = document.getElementById('back-to-projects-btn');
  const statLabel = document.getElementById('stat-total-label');
  const statsContainer = document.getElementById('hero-stats-container');
  const sliderContainer = document.getElementById('hero-slider-container');
  const gridTitle = document.querySelector('#grid-section-title h2');

  if (!state.activeProject) {
    badge.textContent = "GRAPHICS DESIGN PORTFOLIO";
    title.innerHTML = `PREMIUM<br>VISUALS THAT<br>
      <span class="word-carousel">
        <span class="word-carousel-inner">
          <span>MOVE.</span>
          <span>IMPRESS.</span>
          <span>CONVERT.</span>
          <span>INSPIRE.</span>
          <span>MOVE.</span>
        </span>
      </span>`;
    subtitle.textContent = 'High-impact infographics, editorial design, and data visualization crafted for forward-thinking brands.';
    if (statLabel) statLabel.textContent = 'TOTAL PROJECTS';
    if (gridTitle) gridTitle.textContent = 'MY PROJECTS';
    backBtn.classList.add('hidden');
    if (statsContainer) statsContainer.classList.add('hidden');
    if (sliderContainer) sliderContainer.classList.remove('hidden');
    
    const viewsBox = document.getElementById('stat-views-box');
    if (viewsBox) viewsBox.style.display = 'none';
  } else {
    badge.textContent = state.activeProject.category.toUpperCase();
    title.innerHTML = state.activeProject.title.toUpperCase();
    const rawDesc = state.activeProject.description || 'Project details.';
    subtitle.innerHTML = typeof marked !== 'undefined' ? marked.parse(rawDesc) : rawDesc;
    if (statLabel) statLabel.textContent = 'TOTAL WORKS';
    if (gridTitle) gridTitle.textContent = 'PROJECT WORKS';
    backBtn.classList.remove('hidden');
    if (statsContainer) statsContainer.classList.remove('hidden');
    if (sliderContainer) sliderContainer.classList.add('hidden');
    
    const viewsBox = document.getElementById('stat-views-box');
    const viewsBadge = document.getElementById('stat-views-badge');
    if (viewsBox && viewsBadge) {
      if (state.settings.publicViews !== false) {
        viewsBox.style.display = 'flex';
        viewsBadge.textContent = state.activeProject.views || 0;
      } else {
        viewsBox.style.display = 'none';
      }
    }
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

  container.innerHTML = `
    <select class="cat-dropdown" id="cat-dropdown">
      ${pillsData.map(p => `
        <option value="${p.cat}" ${state.activeCategory === p.cat ? 'selected' : ''}>
          ${p.label}
        </option>
      `).join('')}
    </select>
  `;

  document.getElementById('cat-dropdown').addEventListener('change', (e) => {
    state.activeCategory = e.target.value;
    renderAll();
  });
}

function renderCategorySelect() {
  const sel = document.getElementById('artwork-category');
  if (sel) sel.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function renderGrid() {
  const grid = document.getElementById('portfolio-grid');
  const empty = document.getElementById('empty-state');
  const badgeTotal = document.getElementById('stat-total-badge');
  
  grid.className = `portfolio-grid view-${state.activeView} ${state.activeProject ? 'works-grid' : 'projects-grid'}`;

  if (!state.activeProject) {
    // Render Projects
    const filtered = getFilteredProjects();
    badgeTotal.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) {
        const titleEl = empty.querySelector('#empty-title') || empty.querySelector('h2');
        const descEl = empty.querySelector('#empty-desc') || empty.querySelector('p');
        if (titleEl) titleEl.textContent = 'NO PROJECTS FOUND';
        if (descEl) descEl.textContent = 'Adjust your category filter or search query.';
        empty.classList.remove('hidden');
      }
      return;
    }

    if (empty) empty.classList.add('hidden');
    
    grid.innerHTML = filtered.map(item => `
      <article class="portfolio-card project-card reveal-on-scroll" data-id="${item.id}">
        <div class="card-media">
          <img src="${item.coverImage}" alt="${item.title}" loading="lazy" style="object-fit: contain; padding: 2rem; background: var(--bg);">
        </div>
        <div class="card-info">
          <div class="card-top">
            <span class="cat-badge">${item.category}</span>
            <div style="display: flex; gap: 0.8rem; align-items: center;">
              ${state.settings.publicViews !== false ? `<span class="card-date" style="display:flex; align-items:center; gap:0.3rem;"><i class="fa-regular fa-eye"></i> ${item.views || 0}</span>` : ''}
              <span class="card-date">${item.date || ''}</span>
            </div>
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
      card.addEventListener('click', async () => {
        const projectId = card.dataset.id;
        
        // View tracking logic
        const viewedKey = 'viewed_' + projectId;
        if (!localStorage.getItem(viewedKey)) {
          localStorage.setItem(viewedKey, 'true');
          try {
            await fetch('/api/view/' + projectId, { method: 'POST' });
          } catch(e) {}
        }
        
        transitionPage(() => {
          state.activeProject = state.projects.find(p => p.id === projectId);
          state.activeCategory = 'all'; // Reset category when entering a project
          history.pushState({ projectId: state.activeProject.id }, '', '?project=' + state.activeProject.id);
          renderAll();
        });
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
      if (empty) {
        const titleEl = empty.querySelector('#empty-title') || empty.querySelector('h2');
        const descEl = empty.querySelector('#empty-desc') || empty.querySelector('p');
        if (!state.activeProject.works || state.activeProject.works.length === 0) {
          if (titleEl) titleEl.textContent = 'NO IMAGES ADDED';
          if (descEl) descEl.textContent = 'This project currently has no works images.';
        } else {
          if (titleEl) titleEl.textContent = 'NO WORKS FOUND';
          if (descEl) descEl.textContent = 'Adjust your category filter.';
        }
        empty.classList.remove('hidden');
      }
      return;
    }

    if (empty) empty.classList.add('hidden');
    
    grid.innerHTML = works.map((item, idx) => `
      <article class="portfolio-card work-card reveal-on-scroll" data-idx="${idx}">
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
      
      // 3D Tilt Effect
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -10; // Max tilt 10 degrees
        const rotateY = ((x - centerX) / centerX) * 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        card.style.transition = 'none';
        card.style.zIndex = '10'; // Bring to front while tilting
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s var(--ease-spring)';
        card.style.zIndex = '1';
      });
    });
  }
  
  // Apply reveal animations to newly rendered cards
  initScrollReveal();
}

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────
function openLightbox(idx) {
  if (!state.activeProject) return;
  const works = state.activeProject.works || [];
  if (!works.length) return;

  state.lightboxIndex = Math.max(0, Math.min(idx, works.length - 1));
  populateLightbox(works[state.lightboxIndex]);
  
  const modal = document.getElementById('lightbox-modal');
  const lbImg = document.getElementById('lightbox-img');
  const thumb = document.querySelector(`.work-card[data-idx="${state.lightboxIndex}"] img`);
  
  if (thumb) {
    const startRect = thumb.getBoundingClientRect();
    
    // Temporarily show modal to calculate final positions
    modal.style.opacity = '0';
    modal.classList.remove('hidden');
    
    // Reset transform for accurate measurement
    lbImg.style.transition = 'none';
    lbImg.style.transform = 'translate(0px, 0px) scale(1)';
    
    // Measure final location
    const endRect = lbImg.getBoundingClientRect();
    
    // Calculate translation and scale
    const translateX = startRect.left + (startRect.width / 2) - (endRect.left + (endRect.width / 2));
    const translateY = startRect.top + (startRect.height / 2) - (endRect.top + (endRect.height / 2));
    const scale = Math.min(startRect.width / endRect.width, startRect.height / endRect.height);
    
    // Apply starting FLIP transform
    lbImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    
    // Force DOM layout
    lbImg.offsetHeight;
    
    // Reveal and animate to center
    modal.style.opacity = '';
    lbImg.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.15)';
    lbImg.style.transform = 'translate(0px, 0px) scale(1)';
  } else {
    modal.classList.remove('hidden');
  }
  
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const lbImg = document.getElementById('lightbox-img');
  const thumb = document.querySelector(`.work-card[data-idx="${state.lightboxIndex}"] img`);
  
  if (thumb) {
    const endRect = thumb.getBoundingClientRect();
    const startRect = lbImg.getBoundingClientRect();
    
    const translateX = endRect.left + (endRect.width / 2) - (startRect.left + (startRect.width / 2));
    const translateY = endRect.top + (endRect.height / 2) - (startRect.top + (startRect.height / 2));
    const scale = Math.min(endRect.width / startRect.width, endRect.height / startRect.height);
    
    lbImg.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    lbImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    
    modal.style.opacity = '0';
    
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.style.opacity = '';
      lbImg.style.transform = 'translate(0px, 0px) scale(1)';
    }, 400);
  } else {
    modal.classList.add('hidden');
  }
  
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
  const lbDesc = document.getElementById('lightbox-description');
  const rawLbDesc = work.description || '';
  lbDesc.innerHTML = typeof marked !== 'undefined' ? marked.parse(rawLbDesc) : rawLbDesc;
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



// ─── EVENT BINDINGS ───────────────────────────────────────────────────────
function transitionPage(callback) {
  const main = document.querySelector('main.main-content');
  if (!main) return callback();
  
  main.classList.add('page-transitioning');
  setTimeout(() => {
    callback();
    
    if (window.lenis) {
      window.lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    setTimeout(() => main.classList.remove('page-transitioning'), 50);
  }, 250);
}

function bindEvents() {
  window.addEventListener('popstate', (e) => {
    transitionPage(() => {
      if (e.state && e.state.projectId) {
        state.activeProject = state.projects.find(p => p.id === e.state.projectId) || null;
      } else {
        state.activeProject = null;
      }
      state.activeCategory = 'all';
      renderAll();
    });
  });

  document.getElementById('back-to-projects-btn')?.addEventListener('click', () => {
    transitionPage(() => {
      state.activeProject = null;
      state.activeCategory = 'all'; // Reset category when exiting a project
      history.pushState({ projectId: null }, '', window.location.pathname);
      renderAll();
    });
  });

  ['open-admin-btn', 'quick-pin-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', openPinModal));
  document.getElementById('close-pin-modal')?.addEventListener('click', closePinModal);
  document.getElementById('close-admin-modal')?.addEventListener('click', closeAdminModal);
  document.getElementById('close-lightbox')?.addEventListener('click', closeLightbox);

  document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
    state.activeCategory = 'all';
    renderAll();
  });

  document.querySelectorAll('.vtbtn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.vtbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeView = btn.dataset.view;
    renderGrid();
  }));

  document.getElementById('lb-prev')?.addEventListener('click', () => lightboxNav(-1));
  document.getElementById('lb-next')?.addEventListener('click', () => lightboxNav(1));
  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox-modal');
    if (lb && !lb.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft') lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(1);
      if (e.key === 'Escape') closeLightbox();
    }
  });

  document.getElementById('zoom-in-btn')?.addEventListener('click', () => setZoom(state.currentZoom + 0.25));
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => setZoom(state.currentZoom - 0.25));
  document.getElementById('reset-zoom-btn')?.addEventListener('click', () => setZoom(1));
  document.getElementById('lightbox-copy')?.addEventListener('click', () => { navigator.clipboard.writeText(document.getElementById('lightbox-title').textContent); showToast('Link Copied.', 'success'); });


}

function showToast(message, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  t.innerHTML = `<i class="fa-solid fa-circle-${type === 'error' ? 'exclamation' : 'check'}"></i> <span>${message}</span>`;
  c.appendChild(t);
}

// â”€â”€â”€ SLIDER LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initSlider() {
  const track = document.getElementById('hero-slider-track');
  const container = document.getElementById('hero-slider-container');
  if (!track || !container) return;

  if (state.heroSlides.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  track.innerHTML = state.heroSlides.map(s => `
    <div class="hero-slide">
      <div class="slide-image">
        <img src="${s.image}" alt="${s.title}">
      </div>
      <div class="slide-text">
        <h4>${s.title}</h4>
        <p>${s.desc}</p>
      </div>
    </div>
  `).join('');

  const slides = track.querySelectorAll('.hero-slide');
  if (slides.length === 0) return;

  let currentIndex = 0;

  function goToSlide(index) {
    currentIndex = index;
    slides.forEach((slide, i) => {
      slide.classList.remove('active', 'prev', 'next');
      
      if (i === currentIndex) {
        slide.classList.add('active');
      } else if (slides.length === 2) {
        slide.classList.add('next');
      } else if (slides.length > 2) {
        let isPrev = (i === currentIndex - 1) || (currentIndex === 0 && i === slides.length - 1);
        let isNext = (i === currentIndex + 1) || (currentIndex === slides.length - 1 && i === 0);
        if (isPrev) slide.classList.add('prev');
        if (isNext) slide.classList.add('next');
      }
    });
  }

  goToSlide(0);

  if (window.sliderInterval) clearInterval(window.sliderInterval);
  if (slides.length > 1) {
    window.sliderInterval = setInterval(() => {
      if (!container.classList.contains('hidden') && container.style.display !== 'none') {
        goToSlide((currentIndex + 1) % slides.length);
      }
    }, 4000);
  }
}

// ─── SCROLL REVEAL LOGIC ──────────────────────────────────────────────────
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal-on-scroll');
  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        // Add a slight staggered delay based on index for a cascading effect
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, idx * 75);
        obs.unobserve(entry.target); // Only animate once
      }
    });
  }, {
    root: null,
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  reveals.forEach(el => observer.observe(el));
}

function renderFooter() {
  const fSettings = state.settings?.footer || {};
  
  // Email block
  const emailBlock = document.getElementById('footer-email-block');
  const emailText = document.getElementById('footer-email-text');
  const copyBtn = document.getElementById('footer-copy-btn');
  
  if (emailBlock && emailText && copyBtn) {
    if (fSettings.email) {
      emailText.textContent = fSettings.email;
      emailBlock.classList.remove('hidden');
      
      // Prevent multiple listeners by cloning
      const newCopyBtn = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
      
      newCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(fSettings.email).then(() => {
          newCopyBtn.innerHTML = 'COPIED! <i class="fa-solid fa-check"></i>';
          setTimeout(() => {
            newCopyBtn.innerHTML = 'COPY <i class="fa-regular fa-copy"></i>';
          }, 2000);
        });
      });
    } else {
      emailBlock.classList.add('hidden');
    }
  }

  // Socials block
  const socialsBlock = document.getElementById('footer-socials');
  if (socialsBlock) {
    let hasSocials = false;
    
    const platforms = ['dribbble', 'behance', 'twitter', 'linkedin', 'instagram'];
    platforms.forEach(p => {
      const linkEl = document.getElementById(`link-${p}`);
      if (linkEl) {
        if (fSettings[p]) {
          linkEl.href = fSettings[p];
          linkEl.classList.remove('hidden');
          hasSocials = true;
        } else {
          linkEl.classList.add('hidden');
        }
      }
    });
    
    if (hasSocials) {
      socialsBlock.classList.remove('hidden');
    } else {
      socialsBlock.classList.add('hidden');
    }
  }
}
