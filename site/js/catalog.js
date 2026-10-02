(() => {
  const $ = (s,c=document) => c.querySelector(s);
  const $$ = (s,c=document) => [...c.querySelectorAll(s)];
  const WHATSAPP_NUMBER = '593939159989';
  const IS_CATEGORY_PAGE = /\/pages\/categoria\.html$/.test(location.pathname);

  const FALLBACK_CATEGORIES = [
    {id:'disenador',nav:'Diseñador',eyebrow:'Casas de diseñador',title:'Perfumes de diseñador',line:'Firmas icónicas, composiciones reconocibles y presencia elegante.',description:'Una selección de firmas internacionales con acceso rápido al resto de la categoría.',word:'DESIGNER',theme:'noir'},
    {id:'arabes',nav:'Árabe',eyebrow:'Perfumería árabe',title:'Perfumes árabes',line:'Oud, ámbar, especias y composiciones con mucha presencia.',description:'Fragancias intensas y distintivas organizadas dentro de su propia colección.',word:'OUD',theme:'gold'},
    {id:'americanos',nav:'Americanos',eyebrow:'Colección Americanos',title:'Catálogo Americanos',line:'Una selección importada con perfiles frescos, elegantes y reconocibles.',description:'Una colección independiente con filtros para hombre y mujer.',word:'AMERICAN',theme:'noir-soft'}
  ];
  const FALLBACK_PRODUCTS = [];
  let categories = [...FALLBACK_CATEGORIES];
  let products = [...FALLBACK_PRODUCTS];

  const categoryUrl = id => IS_CATEGORY_PAGE ? `categoria.html?categoria=${encodeURIComponent(id)}` : `pages/categoria.html?categoria=${encodeURIComponent(id)}`;
  const adminUrl = IS_CATEGORY_PAGE ? '../admin.html' : 'admin.html';
  const homeUrl = IS_CATEGORY_PAGE ? '../index.html' : 'index.html';

  function esc(v='') { const d=document.createElement('div'); d.textContent=String(v); return d.innerHTML; }
  function norm(v='') { return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function whatsapp(name='',restock=false){
    const msg = name ? (restock ? `Hola, quiero consultar cuándo tendrán disponible nuevamente este perfume:\n\n${name}` : `Hola, quiero consultar por este perfume:\n\n${name}`) : 'Hola, quiero consultar por los perfumes disponibles.';
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  }
  async function getJSON(url){ const r=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'}); if(!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

  async function loadData(){
    const [p,c] = await Promise.allSettled([getJSON('/api/products'),getJSON('/api/catalog-meta')]);
    if(p.status==='fulfilled' && Array.isArray(p.value.products)) products=p.value.products;
    if(c.status==='fulfilled' && Array.isArray(c.value.categories) && c.value.categories.length) categories=c.value.categories;
    if(p.status==='rejected') console.warn('[CSPERFUMES] productos:',p.reason);
    if(c.status==='rejected') console.warn('[CSPERFUMES] categorías:',c.reason);
  }

  function resolveImage(value=''){
    const image=String(value||'').trim();
    if(!image) return '';

    // Las imágenes nuevas del admin viven en Supabase y llegan como URL absoluta.
    // Se dejan intactas.
    if(/^https?:\/\//i.test(image)){
      // Compatibilidad con los registros viejos que todavía apuntan al repo
      // eliminado. Conservamos únicamente la ruta /assets/... y la servimos
      // desde el repo actual de Netlify.
      const legacy=image.match(/\/site\/(assets\/images\/[^?#]+)/i);
      if(legacy) return `/${legacy[1]}`;
      return image;
    }

    if(image.startsWith('data:') || image.startsWith('blob:') || image.startsWith('/local-uploads/')) return image;

    // Assets históricos incluidos físicamente en GitHub/Netlify.
    const clean=image.replace(/^\.\//,'').replace(/^\//,'').replace(/^site\//,'');
    if(clean.startsWith('assets/')) return `/${clean}`;

    return image;
  }
  function placeholderImage(label='CSPERFUMES'){
    const text=String(label||'CSPERFUMES').replace(/[<>&\"']/g,'').slice(0,36);
    const initials=text.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'CS';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1050"><defs><radialGradient id="g"><stop offset="0" stop-color="#4a1025"/><stop offset="1" stop-color="#090607"/></radialGradient></defs><rect width="900" height="1050" fill="url(#g)"/><circle cx="450" cy="445" r="245" fill="none" stroke="#d7aa55" stroke-opacity=".45" stroke-width="3"/><text x="450" y="505" text-anchor="middle" fill="#e7c778" font-family="Georgia,serif" font-size="230">${initials}</text><text x="450" y="820" text-anchor="middle" fill="#f8f1e7" fill-opacity=".72" font-family="Arial,sans-serif" font-size="34">${text}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }
  function installImageFallback(){
    document.addEventListener('error',event=>{
      const img=event.target;
      if(!(img instanceof HTMLImageElement) || img.dataset.fallbackApplied==='true') return;
      img.dataset.fallbackApplied='true';
      img.src=placeholderImage(img.alt||'CSPERFUMES');
    },true);
  }
  function featured(cat){ return products.find(p=>p.category===cat.id && p.featured) || products.find(p=>p.category===cat.id) || null; }
  function renderNav(){
    const desktop=$('#desktopNav'); if(desktop) desktop.innerHTML=categories.map(c=>`<a href="${categoryUrl(c.id)}">${esc(c.nav)}</a>`).join('');
    const mobile=$('#mobileNav'); if(mobile) mobile.innerHTML=categories.map(c=>`<a href="${categoryUrl(c.id)}">${esc(c.nav)}</a>`).join('');
    const a=$('.admin-nav-link'); if(a) a.href=adminUrl;
  }
  function card(product){
    const sold=product.status==='sold_out';
    const el=document.createElement('article'); el.className=`product-card${sold?' is-sold-out':''}`; el.tabIndex=0;
    el.innerHTML=`<div class="product-card-visual"><img src="${esc(resolveImage(product.image))}" alt="${esc(product.brand)} ${esc(product.name)}" loading="lazy">${sold?'<span class="sold-out-badge">SOLD OUT</span>':''}</div><span class="product-arrow">↗</span><div class="product-card-info"><span>${esc(product.brand)}</span><h4>${esc(product.name)}</h4><small>${esc(product.type||'Perfume')}</small></div>`;
    const open=()=>openProduct(product); el.addEventListener('click',open); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}}); return el;
  }
  function openProduct(p){
    const modal=$('#productModal'); if(!modal) return;
    $('#modalImage').src=resolveImage(p.image)||placeholderImage(`${p.brand} ${p.name}`); $('#modalImage').alt=`${p.brand} ${p.name}`; $('#modalBrand').textContent=p.brand; $('#modalTitle').textContent=p.name; $('#modalType').textContent=`${p.type||'Perfume'}${p.status==='sold_out'?' · SOLD OUT':''}`; $('#modalWord').textContent=(p.brand||'PARFUM').toUpperCase(); $('#modalWhatsapp').href=whatsapp(`${p.brand} ${p.name}`,p.status==='sold_out'); $('#modalWhatsapp').textContent=p.status==='sold_out'?'Consultar reposición':'Consultar este perfume'; modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  }
  function closeProduct(){ const m=$('#productModal'); if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');} }

  function renderHome(){
    const dir=$('#categoryDirectoryGrid'); const secs=$('#categorySections'); const filterMenu=$('#categoryFilterMenu'); if(!dir||!secs||!filterMenu) return;
    dir.innerHTML=''; secs.innerHTML='';
    filterMenu.innerHTML='<button type="button" role="option" data-value="todos" aria-selected="true">Todos</button>';
    categories.forEach((c,i)=>{
      const f=featured(c); if(!f) return;
      const cover=resolveImage(c.coverImage||f.image);
      const a=document.createElement('a'); a.className='category-directory-card'; a.href=categoryUrl(c.id); a.innerHTML=`<div class="category-directory-image"><img src="${esc(cover)}" alt="${esc(c.nav)}"></div><div class="category-directory-overlay"></div><span class="category-directory-number">${String(i+1).padStart(2,'0')}</span><div class="category-directory-copy"><p>${esc(c.eyebrow||`Colección ${c.nav}`)}</p><h3>${esc(c.nav)}</h3><span>Ver catálogo ↗</span></div>`; dir.appendChild(a);
      const o=document.createElement('button'); o.type='button'; o.setAttribute('role','option'); o.dataset.value=c.id; o.setAttribute('aria-selected','false'); o.textContent=c.nav; filterMenu.appendChild(o);

      const second=products.filter(p=>p.category===c.id&&p.id!==f.id).slice(0,4);
      const s=document.createElement('section'); s.className=`category-feature theme-${c.theme||'noir'}`; s.innerHTML=`<div class="category-copy"><p class="section-eyebrow">${esc(c.eyebrow||c.nav)}</p><h2>${esc(c.title||c.nav)}</h2><p class="category-line">${esc(c.line||'Descubre la selección disponible.')}</p><p class="category-description">${esc(c.description||'Explora las fragancias disponibles dentro de esta colección.')}</p><div class="category-product-meta"><div><span>Destacado de la categoría</span><strong>${esc(f.brand)}<br>${esc(f.name)}</strong><span>${esc(f.type||'Perfume')}</span></div><a class="button button-dark" href="${categoryUrl(c.id)}">Ver catálogo</a></div></div><div class="category-visual"><img src="${esc(resolveImage(f.image))}" alt="${esc(f.brand)} ${esc(f.name)}"></div><div class="category-compact"><div class="category-compact-head"><span>Resto de la selección</span><a href="${categoryUrl(c.id)}">Ver catálogo ↗</a></div><div class="category-compact-list"></div></div>`;
      $('.category-visual',s).addEventListener('click',()=>openProduct(f)); const list=$('.category-compact-list',s); second.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='compact-product';b.innerHTML=`<img src="${esc(resolveImage(p.image))}" alt="${esc(p.brand)} ${esc(p.name)}"><span><small>${esc(p.brand)}</small><strong>${esc(p.name)}</strong></span><i>↗</i>`;b.onclick=()=>openProduct(p);list.appendChild(b);}); secs.appendChild(s);
    });
    renderAll('todos');
  }
  function renderAll(cat='todos'){ const g=$('#allProductsGrid'); if(!g)return;g.innerHTML='';const rows=cat==='todos'?products:products.filter(p=>p.category===cat);rows.forEach(p=>g.appendChild(card(p))); if(!rows.length)g.innerHTML='<p class="empty-catalog">No hay perfumes disponibles en esta categoría.</p>'; }

  function renderCategoryPage(){
    const slug=new URLSearchParams(location.search).get('categoria')||''; const cat=categories.find(c=>c.id===slug); const grid=$('#categoryPageGrid'); if(!grid)return;
    if(!cat){$('#categoryTitle').textContent='Categoría no encontrada';$('#categoryLine').textContent='La categoría solicitada no existe o está oculta.';grid.innerHTML=`<p class="empty-catalog"><a href="${homeUrl}">Volver al inicio</a></p>`;return;}
    document.title=`${cat.nav} | CSPERFUMES`;
    document.body.dataset.category=cat.id;
    document.body.dataset.theme=cat.theme||'noir';
    $('#categoryEyebrow').textContent=cat.eyebrow||`Colección ${cat.nav}`;
    $('#categoryTitle').textContent=cat.title||cat.nav;
    $('#categoryLine').textContent=cat.line||`Descubre la selección disponible de ${cat.nav}.`;
    if($('#categoryBackdropWord')) $('#categoryBackdropWord').textContent=cat.word||cat.nav.toUpperCase();
    const rows=products.filter(p=>p.category===slug).sort((a,b)=>{
      if(Boolean(a.featured)!==Boolean(b.featured)) return a.featured?-1:1;
      return Number(a.sortOrder||0)-Number(b.sortOrder||0);
    });
    if($('#categoryCount')) $('#categoryCount').textContent=rows.length;
    const draw=(gender='todos')=>{
      grid.innerHTML='';
      const rr=rows.filter(p=>gender==='todos'||p.gender===gender||p.gender==='unisex');
      rr.forEach(p=>grid.appendChild(card(p)));
      if($('#categoryResultCount')) $('#categoryResultCount').textContent=`${rr.length} ${rr.length===1?'fragancia':'fragancias'} en este filtro`;
      if(!rr.length)grid.innerHTML='<p class="empty-catalog">No hay perfumes disponibles en este filtro.</p>';
    }; draw();
    $$('#genderFilters button').forEach(b=>b.onclick=()=>{$$('#genderFilters button').forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.gender);});
  }

  function renderSearch(q=''){
    const mount=$('#searchResults'); if(!mount)return; const query=norm(q.trim()); const rows=products.filter(p=>!query||norm(`${p.brand} ${p.name} ${p.type}`).includes(query)); $('#searchCount').textContent=`${rows.length} ${rows.length===1?'resultado':'resultados'}`; mount.innerHTML='';rows.forEach(p=>{const e=document.createElement('article');e.className='search-result';e.innerHTML=`<img src="${esc(resolveImage(p.image))}" alt="${esc(p.brand)} ${esc(p.name)}"><div><h3>${esc(p.name)}</h3><p>${esc(p.brand)} · ${esc(p.type||'Perfume')}</p></div>`;e.onclick=()=>{closeSearch();openProduct(p);};mount.appendChild(e);});
  }
  function openSearch(){const s=$('#searchOverlay');if(!s)return;s.classList.add('open');s.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');renderSearch('');setTimeout(()=>$('#searchInput')?.focus(),80);}
  function closeSearch(){const s=$('#searchOverlay');if(!s)return;s.classList.remove('open');s.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
  function bind(){
    $('#modalClose')?.addEventListener('click',closeProduct); $('#productModal')?.addEventListener('click',e=>{if(e.target.id==='productModal')closeProduct();});
    ['searchButton','catalogSearchButton','mobileSearchButton'].forEach(id=>$('#'+id)?.addEventListener('click',openSearch)); $('#searchClose')?.addEventListener('click',closeSearch); $('#searchInput')?.addEventListener('input',e=>renderSearch(e.target.value));
    const categoryFilter=$('#catalogCategoryFilter'), categoryTrigger=$('#categoryFilterTrigger'), categoryMenu=$('#categoryFilterMenu'), categoryValue=$('#categoryFilterValue');
    if(categoryFilter&&categoryTrigger&&categoryMenu&&categoryValue){
      const closeCategoryFilter=()=>{categoryFilter.classList.remove('open');categoryTrigger.setAttribute('aria-expanded','false');};
      categoryTrigger.addEventListener('click',event=>{event.stopPropagation();const opening=!categoryFilter.classList.contains('open');categoryFilter.classList.toggle('open',opening);categoryTrigger.setAttribute('aria-expanded',String(opening));});
      categoryMenu.addEventListener('click',event=>{
        const option=event.target.closest('[data-value]'); if(!option)return;
        categoryValue.textContent=option.textContent.trim();
        $$('[data-value]',categoryMenu).forEach(item=>item.setAttribute('aria-selected',String(item===option)));
        renderAll(option.dataset.value); closeCategoryFilter();
      });
      document.addEventListener('click',event=>{if(!categoryFilter.contains(event.target))closeCategoryFilter();});
      document.addEventListener('keydown',event=>{if(event.key==='Escape')closeCategoryFilter();});
    }
    const mb=$('#menuButton'),mm=$('#mobileMenu'); if(mb&&mm)mb.onclick=()=>{const open=mm.classList.toggle('open');mb.setAttribute('aria-expanded',String(open));};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeProduct();closeSearch();}});
    const w=whatsapp(); ['landingWhatsapp','generalWhatsapp','floatingWhatsapp'].forEach(id=>{const n=$('#'+id);if(n)n.href=w;});
  }
  async function init(){installImageFallback();try{await loadData();renderNav();IS_CATEGORY_PAGE?renderCategoryPage():renderHome();bind();}finally{$('#catalogLoading')?.classList.add('hide');}}
  init();
})();
