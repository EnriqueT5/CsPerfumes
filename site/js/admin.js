const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const OPTION_STORAGE_KEY = 'csperfumes.catalog-options.v1';

const DEFAULT_CATEGORIES = [
  { value: 'disenador', label: 'Diseñador', order: 10 },
  { value: 'arabes', label: 'Árabe', order: 20 },
  { value: 'americanos', label: 'Americanos', order: 30 }
];

const DEFAULT_TYPES = [
  'Eau de Toilette',
  'Eau de Parfum',
  'Parfum',
  'Extrait de Parfum',
  'Elixir',
  'Cologne',
  'Body Mist',
  'Colección',
  'Varios modelos',
  'Luxury Collection · Eau de Parfum',
  'Otro'
];

const state = {
  products: [],
  editing: null,
  pendingImageFile: null,
  busy: false,
  optionsLoaded: false,
  optionsRemote: false,
  catalogOptions: {
    categories: [],
    brands: [],
    types: []
  }
};

const GENDER_LABELS = { hombre: 'Hombre', mujer: 'Mujer', unisex: 'Unisex' };
const STATUS_LABELS = { available: 'Disponible', sold_out: 'Sold out', hidden: 'Oculto' };


function resolveAdminImage(value = '') {
  const image = String(value || '').trim();
  if (!image) return '';

  // URL absoluta = Supabase Storage (o cualquier CDN actual).
  // Las referencias antiguas al repo borrado se convierten a assets locales.
  if (/^https?:\/\//i.test(image)) {
    const legacy = image.match(/\/site\/(assets\/images\/[^?#]+)/i);
    if (legacy) return `/${legacy[1]}`;
    return image;
  }

  if (image.startsWith('data:') || image.startsWith('blob:') || image.startsWith('/local-uploads/')) return image;

  const clean = image.replace(/^\.\//, '').replace(/^\//, '').replace(/^site\//, '');
  if (clean.startsWith('assets/')) return `/${clean}`;

  return image;
}
function adminImagePlaceholder(label = 'CSPERFUMES') {
  const text = String(label || 'CSPERFUMES').replace(/[<>&"']/g, '').slice(0, 28);
  const initials = text.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'CS';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700"><defs><radialGradient id="g"><stop offset="0" stop-color="#4a1025"/><stop offset="1" stop-color="#090607"/></radialGradient></defs><rect width="700" height="700" fill="url(#g)"/><circle cx="350" cy="310" r="170" fill="none" stroke="#d7aa55" stroke-opacity=".46" stroke-width="3"/><text x="350" y="370" text-anchor="middle" fill="#e8c878" font-family="Georgia,serif" font-size="160">${initials}</text><text x="350" y="590" text-anchor="middle" fill="#f8f1e7" fill-opacity=".68" font-family="Arial,sans-serif" font-size="24">${text}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}




const csSelectRegistry = new Map();
const CS_SELECT_IDS = ['brandInput', 'typeInput', 'categoryInput', 'genderInput', 'statusInput', 'categoryFilter', 'statusFilter'];

function closeCsSelects(except = null) {
  csSelectRegistry.forEach((root) => {
    if (root === except) return;
    root.classList.remove('open');
    root.querySelector('.cs-select-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function syncCsSelect(select) {
  const root = csSelectRegistry.get(select);
  if (!root) return;
  const trigger = root.querySelector('.cs-select-trigger');
  const menu = root.querySelector('.cs-select-menu');
  const selected = select.options[select.selectedIndex] || select.options[0];
  const label = selected?.textContent?.trim() || 'Seleccionar';
  trigger.querySelector('span').textContent = label;
  trigger.classList.toggle('is-placeholder', !selected?.value);
  menu.innerHTML = '';

  [...select.options].forEach(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cs-select-option${option.value ? '' : ' is-placeholder'}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(option.value === select.value));
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.addEventListener('click', event => {
      event.preventDefault();
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncCsSelect(select);
      closeCsSelects();
      trigger.focus();
    });
    menu.appendChild(button);
  });
}

function enhanceCsSelect(select) {
  if (!select || csSelectRegistry.has(select)) return;
  const wasRequired = select.required;
  select.required = false;
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  select.classList.remove('select-native-proxy');
  select.classList.add('cs-select-native');

  const root = document.createElement('div');
  root.className = 'cs-select';
  root.dataset.selectId = select.id;
  select.parentNode.insertBefore(root, select);
  root.appendChild(select);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cs-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<span>Seleccionar</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5"></path></svg>';

  const menu = document.createElement('div');
  menu.className = 'cs-select-menu';
  menu.setAttribute('role', 'listbox');
  root.append(trigger, menu);
  root.dataset.wasRequired = wasRequired ? 'true' : 'false';
  csSelectRegistry.set(select, root);

  trigger.addEventListener('click', event => {
    event.preventDefault();
    const opening = !root.classList.contains('open');
    closeCsSelects(root);
    root.classList.toggle('open', opening);
    trigger.setAttribute('aria-expanded', String(opening));
  });

  select.addEventListener('change', () => syncCsSelect(select));
  new MutationObserver(() => syncCsSelect(select)).observe(select, { childList: true, subtree: true });
  syncCsSelect(select);
}

function refreshCsSelects() {
  CS_SELECT_IDS.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    enhanceCsSelect(select);
    syncCsSelect(select);
  });
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  let payload = {};
  try { payload = await response.json(); } catch { /* empty */ }
  if (!response.ok) {
    const error = new Error(payload.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setLoginMessage(message = '') { $('#loginMessage').textContent = message; }
function setEditorMessage(message = '') { $('#editorMessage').textContent = message; }

function showBusy(title = 'Procesando…', detail = 'Espera un momento. No cierres esta ventana.') {
  const overlay = $('#busyOverlay');
  if (!overlay) return;
  $('#busyTitle').textContent = title;
  $('#busyDetail').textContent = detail;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-busy');
}

function updateBusy(title, detail) {
  if (title) $('#busyTitle').textContent = title;
  if (detail) $('#busyDetail').textContent = detail;
}

function hideBusy() {
  const overlay = $('#busyOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-busy');
}

function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2800);
}

function showLogin() {
  $('#loginPanel').hidden = false;
  $('#dashboard').hidden = true;
  setTimeout(() => $('#adminPassword').focus(), 60);
}

function showDashboard() {
  $('#loginPanel').hidden = true;
  $('#dashboard').hidden = false;
}

async function checkSession() {
  try {
    const payload = await request('/api/admin/session');
    if (payload.authenticated) {
      showDashboard();
      await loadProducts();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    setLoginMessage(error.message);
  }
}

async function login(event) {
  event.preventDefault();
  const password = $('#adminPassword').value;
  setLoginMessage('Verificando…');
  try {
    await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    $('#adminPassword').value = '';
    setLoginMessage('');
    showDashboard();
    await loadProducts();
  } catch (error) {
    setLoginMessage(error.message);
  }
}

async function logout() {
  try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); } catch { /* clear UI anyway */ }
  state.products = [];
  state.optionsLoaded = false;
  state.optionsRemote = false;
  showLogin();
}

async function loadProducts() {
  $('#loadingState').hidden = false;
  $('#productList').innerHTML = '';
  try {
    const payload = await request('/api/admin/products');
    state.products = payload.products || [];
    if (!state.optionsLoaded) await loadCatalogOptions();
    mergeOptionsFromProducts();
    refreshOptionControls();
    updateStats();
    renderProducts();
  } catch (error) {
    if (error.status === 401) return showLogin();
    toast(error.message, true);
  } finally {
    $('#loadingState').hidden = true;
  }
}

function updateStats() {
  $('#statTotal').textContent = state.products.length;
  $('#statAvailable').textContent = state.products.filter(p => p.status === 'available').length;
  $('#statSoldOut').textContent = state.products.filter(p => p.status === 'sold_out').length;
  $('#statHidden').textContent = state.products.filter(p => p.status === 'hidden').length;
}

function normalized(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(value = '') {
  return normalized(value)
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueStrings(values) {
  const map = new Map();
  values.forEach(value => {
    const clean = String(value || '').trim();
    if (!clean) return;
    const key = normalized(clean);
    if (!map.has(key)) map.set(key, clean);
  });
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function normalizeCategories(values = []) {
  const map = new Map();
  values.forEach((item, index) => {
    const label = String(item?.label || item?.name || '').trim();
    const value = String(item?.value || item?.slug || slugify(label)).trim();
    if (!label || !value) return;
    const key = normalized(value);
    if (!map.has(key)) {
      map.set(key, {
        value,
        label,
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : ((index + 1) * 10)
      });
    }
  });
  return [...map.values()].sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label, 'es'));
}

function normalizeOptions(raw = {}) {
  const categories = normalizeCategories([
    ...DEFAULT_CATEGORIES,
    ...(Array.isArray(raw.categories) ? raw.categories : [])
  ]);
  const brands = uniqueStrings(Array.isArray(raw.brands) ? raw.brands : []);
  const types = uniqueStrings([
    ...DEFAULT_TYPES,
    ...(Array.isArray(raw.types) ? raw.types : [])
  ]);
  return { categories, brands, types };
}

function readLocalOptions() {
  try {
    const raw = localStorage.getItem(OPTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalOptions() {
  try {
    localStorage.setItem(OPTION_STORAGE_KEY, JSON.stringify(state.catalogOptions));
  } catch { /* private mode or quota */ }
}

async function loadCatalogOptions() {
  let source = readLocalOptions();
  state.optionsRemote = false;

  try {
    const payload = await request('/api/admin/options');
    source = payload.options || payload;
    state.optionsRemote = true;
  } catch (error) {
    if (![404, 405].includes(error.status)) {
      console.warn('No se pudo cargar /api/admin/options; se usarán las listas locales.', error);
    }
  }

  state.catalogOptions = normalizeOptions(source);
  state.optionsLoaded = true;
  updateOptionsStorageNote();
}

async function persistCatalogOptions() {
  const payload = { options: state.catalogOptions };
  try {
    await request('/api/admin/options', { method: 'PUT', body: JSON.stringify(payload) });
    state.optionsRemote = true;
    writeLocalOptions();
    updateOptionsStorageNote();
    return { remote: true };
  } catch (error) {
    if (![404, 405].includes(error.status)) throw error;
    state.optionsRemote = false;
    writeLocalOptions();
    updateOptionsStorageNote();
    return { remote: false };
  }
}

async function deleteCatalogOptionRemote(kind, value) {
  try {
    await request('/api/admin/options', {
      method: 'DELETE',
      body: JSON.stringify({ kind, value })
    });
    state.optionsRemote = true;
    writeLocalOptions();
    updateOptionsStorageNote();
    return { remote: true };
  } catch (error) {
    if (![404, 405].includes(error.status)) throw error;
    state.optionsRemote = false;
    writeLocalOptions();
    updateOptionsStorageNote();
    return { remote: false };
  }
}

function updateOptionsStorageNote() {
  const node = $('#optionsStorageNote');
  if (!node) return;
  if (state.optionsRemote) {
    node.hidden = true;
    node.textContent = '';
    return;
  }
  node.hidden = false;
  node.textContent = 'Modo compatible: las listas nuevas se guardan en este navegador. Para compartirlas entre equipos y sincronizarlas con Excel, el backend debe implementar /api/admin/options.';
}

function mergeOptionsFromProducts() {
  const productCategories = state.products.map(p => ({
    value: p.category,
    label: p.category_label || getCategoryLabel(p.category) || p.category,
    order: Number(p.category_order || 9999)
  }));
  state.catalogOptions.categories = normalizeCategories([...state.catalogOptions.categories, ...productCategories]);
  state.catalogOptions.brands = uniqueStrings([...state.catalogOptions.brands, ...state.products.map(p => p.brand)]);
  state.catalogOptions.types = uniqueStrings([...state.catalogOptions.types, ...state.products.map(p => p.type)]);
}

function getCategoryLabel(value) {
  return state.catalogOptions.categories.find(item => item.value === value)?.label
    || DEFAULT_CATEGORIES.find(item => item.value === value)?.label
    || value;
}

function filteredProducts() {
  const query = normalized($('#adminSearch').value.trim());
  const category = $('#categoryFilter').value;
  const status = $('#statusFilter').value;
  return state.products.filter(product => {
    const matchesSearch = !query || normalized(`${product.brand} ${product.name} ${product.type}`).includes(query);
    const matchesCategory = category === 'all' || product.category === category;
    const matchesStatus = status === 'all' || product.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });
}

function makeText(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function actionButton(label, action, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['product-action-button', className].filter(Boolean).join(' ');

  const labelNode = document.createElement('span');
  labelNode.textContent = label;
  button.appendChild(labelNode);

  button.addEventListener('click', action);
  return button;
}

function renderProducts() {
  const list = $('#productList');
  list.innerHTML = '';
  const products = filteredProducts();
  $('#emptyState').hidden = products.length > 0;

  products.forEach(product => {
    const row = document.createElement('article');
    row.className = 'admin-product';

    const image = document.createElement('img');
    image.src = resolveAdminImage(product.image_url) || adminImagePlaceholder(`${product.brand} ${product.name}`);
    image.addEventListener('error', () => { if (image.dataset.fallbackApplied === 'true') return; image.dataset.fallbackApplied='true'; image.src=adminImagePlaceholder(`${product.brand} ${product.name}`); }, { once: false });
    image.alt = `${product.brand} ${product.name}`;
    image.loading = 'lazy';
    row.appendChild(image);

    const name = document.createElement('div');
    name.className = 'product-name';
    name.appendChild(makeText('strong', '', product.name));
    name.appendChild(makeText('span', '', `${product.brand} · ${product.type}`));
    if (product.featured) name.appendChild(makeText('div', 'featured-label', 'Destacado'));
    row.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'product-meta';
    meta.appendChild(makeText('strong', '', getCategoryLabel(product.category)));
    meta.appendChild(makeText('span', '', GENDER_LABELS[product.gender] || product.gender));
    row.appendChild(meta);

    const status = makeText('span', `status-pill status-${product.status}`, STATUS_LABELS[product.status] || product.status);
    row.appendChild(status);

    const secondary = document.createElement('div');
    secondary.className = 'product-meta secondary';
    secondary.appendChild(makeText('strong', '', `Orden ${product.sort_order}`));
    secondary.appendChild(makeText('span', '', product.slug));
    row.appendChild(secondary);

    const actions = document.createElement('div');
    actions.className = 'product-actions';
    actions.appendChild(actionButton('Editar', () => openEditor(product), 'action-edit'));
    if (product.status !== 'available') actions.appendChild(actionButton('Disponible', () => quickStatus(product, 'available'), 'action-available'));
    if (product.status !== 'sold_out') actions.appendChild(actionButton('Sold out', () => quickStatus(product, 'sold_out'), 'action-soldout'));
    if (product.status !== 'hidden') actions.appendChild(actionButton('Ocultar', () => quickStatus(product, 'hidden'), 'action-hide'));
    actions.appendChild(actionButton('Eliminar', () => deleteProduct(product), 'action-delete'));
    row.appendChild(actions);

    list.appendChild(row);
  });
}

async function quickStatus(product, status) {
  showBusy('Actualizando estado…', `${product.brand} ${product.name}`);
  try {
    await request('/api/admin/products', {
      method: 'PUT',
      body: JSON.stringify({ id: product.id, status })
    });
    product.status = status;
    updateStats();
    renderProducts();
    toast(`${product.name}: ${STATUS_LABELS[status]}.`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    hideBusy();
  }
}

function ensureSelectValue(select, value, label = value) {
  if (!value) return;
  if (![...select.options].some(option => option.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = value;
}

function fillStringSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = placeholder;
  blank.disabled = true;
  select.appendChild(blank);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if (values.includes(current)) select.value = current;
}

function refreshOptionControls() {
  const categoryFilterValue = $('#categoryFilter').value || 'all';
  const categoryInputValue = $('#categoryInput').value;
  const brandValue = $('#brandInput').value;
  const typeValue = $('#typeInput').value;

  const filter = $('#categoryFilter');
  filter.innerHTML = '<option value="all">Todas</option>';
  state.catalogOptions.categories.forEach(item => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    filter.appendChild(option);
  });
  filter.value = [...filter.options].some(o => o.value === categoryFilterValue) ? categoryFilterValue : 'all';

  const categoryInput = $('#categoryInput');
  categoryInput.innerHTML = '';
  state.catalogOptions.categories.forEach(item => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    categoryInput.appendChild(option);
  });
  if (categoryInputValue) ensureSelectValue(categoryInput, categoryInputValue, getCategoryLabel(categoryInputValue));

  fillStringSelect($('#brandInput'), state.catalogOptions.brands, 'Selecciona una marca');
  fillStringSelect($('#typeInput'), state.catalogOptions.types, 'Selecciona un tipo / concentración');
  if (brandValue) ensureSelectValue($('#brandInput'), brandValue);
  if (typeValue) ensureSelectValue($('#typeInput'), typeValue);

  renderOptionsManager();
  refreshCsSelects();
}

function nextSortOrder() {
  const max = Math.max(0, ...state.products.map(p => Number(p.sort_order || 0)).filter(Number.isFinite));
  return max + 1;
}

function resetForm() {
  $('#productForm').reset();
  $('#productId').value = '';
  $('#currentImageUrl').value = '';
  $('#currentImagePath').value = '';
  $('#sortOrderInput').value = String(nextSortOrder());
  state.pendingImageFile = null;
  state.editing = null;
  setEditorMessage('');
  $('#imageFileName').textContent = '';
  setPreview('');
  refreshOptionControls();
  if (state.catalogOptions.categories[0]) $('#categoryInput').value = state.catalogOptions.categories[0].value;
  if (state.catalogOptions.brands[0]) $('#brandInput').value = state.catalogOptions.brands[0];
  if (state.catalogOptions.types[0]) $('#typeInput').value = state.catalogOptions.types[0];
}

function setPreview(url) {
  const preview = $('#imagePreview');
  preview.innerHTML = '';
  if (!url) {
    preview.appendChild(makeText('span', '', 'Sin imagen'));
    return;
  }
  const img = document.createElement('img');
  img.src = resolveAdminImage(url) || adminImagePlaceholder('CSPERFUMES');
  img.addEventListener('error', () => { if (img.dataset.fallbackApplied === 'true') return; img.dataset.fallbackApplied='true'; img.src=adminImagePlaceholder('CSPERFUMES'); });
  img.alt = 'Vista previa';
  preview.appendChild(img);
}

function openEditor(product = null) {
  resetForm();
  if (product) {
    state.editing = product;
    $('#editorTitle').textContent = `Editar ${product.name}`;
    $('#productId').value = product.id;
    ensureSelectValue($('#brandInput'), product.brand);
    $('#nameInput').value = product.name;
    ensureSelectValue($('#typeInput'), product.type);
    ensureSelectValue($('#categoryInput'), product.category, getCategoryLabel(product.category));
    $('#genderInput').value = product.gender;
    $('#statusInput').value = product.status;
    $('#sortOrderInput').value = product.sort_order;
    $('#featuredInput').checked = Boolean(product.featured);
    $('#currentImageUrl').value = product.image_url || '';
    $('#currentImagePath').value = product.image_path || '';
    setPreview(product.image_url);
  } else {
    $('#editorTitle').textContent = 'Nuevo perfume';
  }
  $('#editorOverlay').classList.add('open');
  $('#editorOverlay').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  refreshCsSelects();
  setTimeout(() => csSelectRegistry.get($('#brandInput'))?.querySelector('.cs-select-trigger')?.focus() || $('#nameInput').focus(), 80);
}

function closeEditor() {
  if (state.busy) return;
  $('#editorOverlay').classList.remove('open');
  $('#editorOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openLists() {
  renderOptionsManager();
  updateOptionsStorageNote();
  $('#listsOverlay').classList.add('open');
  $('#listsOverlay').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLists() {
  $('#listsOverlay').classList.remove('open');
  $('#listsOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function optionUsageCount(kind, value) {
  if (kind === 'categories') return state.products.filter(p => p.category === value).length;
  if (kind === 'brands') return state.products.filter(p => p.brand === value).length;
  return state.products.filter(p => p.type === value).length;
}

function makeOptionRow(kind, item) {
  const isCategory = kind === 'categories';
  const value = isCategory ? item.value : item;
  const label = isCategory ? item.label : item;
  const usage = optionUsageCount(kind, value);
  const row = document.createElement('div');
  row.className = 'option-row';

  const copy = document.createElement('div');
  copy.className = 'option-row-copy';
  copy.appendChild(makeText('strong', '', label));
  copy.appendChild(makeText('span', '', isCategory ? `${value} · ${usage} producto${usage === 1 ? '' : 's'}` : `${usage} producto${usage === 1 ? '' : 's'}`));
  row.appendChild(copy);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'option-remove';
  remove.textContent = 'Eliminar';
  remove.disabled = usage > 0;
  remove.title = usage > 0 ? 'No se puede eliminar porque hay perfumes usando esta opción.' : 'Eliminar de la lista';
  remove.addEventListener('click', () => removeCatalogOption(kind, value));
  row.appendChild(remove);
  return row;
}

function renderOptionsManager() {
  if (!$('#categoriesList')) return;
  const config = [
    ['categories', '#categoriesList', '#categoryCount'],
    ['brands', '#brandsList', '#brandCount'],
    ['types', '#typesList', '#typeCount']
  ];
  config.forEach(([kind, listSelector, countSelector]) => {
    const list = $(listSelector);
    list.innerHTML = '';
    const values = state.catalogOptions[kind];
    $(countSelector).textContent = values.length;
    values.forEach(item => list.appendChild(makeOptionRow(kind, item)));
  });
}

async function addCatalogOption(kind, label) {
  const clean = String(label || '').trim();
  if (!clean) return;

  if (kind === 'categories') {
    const value = slugify(clean);
    if (!value) throw new Error('La categoría necesita al menos una letra o número.');
    if (state.catalogOptions.categories.some(item => normalized(item.value) === normalized(value) || normalized(item.label) === normalized(clean))) {
      throw new Error('Esa categoría ya existe.');
    }
    const maxOrder = Math.max(0, ...state.catalogOptions.categories.map(item => Number(item.order || 0)));
    state.catalogOptions.categories.push({ value, label: clean, order: maxOrder + 10 });
    state.catalogOptions.categories = normalizeCategories(state.catalogOptions.categories);
  } else {
    if (state.catalogOptions[kind].some(item => normalized(item) === normalized(clean))) throw new Error('Esa opción ya existe.');
    state.catalogOptions[kind] = uniqueStrings([...state.catalogOptions[kind], clean]);
  }

  showBusy('Actualizando listas…', 'Guardando la nueva opción del catálogo.');
  try {
    const saved = await persistCatalogOptions();
    refreshOptionControls();
    toast(saved.remote ? 'Lista actualizada.' : 'Lista actualizada en este navegador.');
  } finally {
    hideBusy();
  }
}

async function removeCatalogOption(kind, value) {
  const usage = optionUsageCount(kind, value);
  if (usage > 0) return toast(`No se puede eliminar: ${usage} producto${usage === 1 ? '' : 's'} usa${usage === 1 ? '' : 'n'} esta opción.`, true);

  const snapshot = kind === 'categories'
    ? state.catalogOptions.categories.map(item => ({ ...item }))
    : [...state.catalogOptions[kind]];

  if (kind === 'categories') {
    state.catalogOptions.categories = state.catalogOptions.categories.filter(item => item.value !== value);
  } else {
    state.catalogOptions[kind] = state.catalogOptions[kind].filter(item => item !== value);
  }

  showBusy('Actualizando listas…', 'Eliminando la opción del catálogo.');
  try {
    await deleteCatalogOptionRemote(kind, value);
    refreshOptionControls();
    toast('Opción eliminada.');
  } catch (error) {
    state.catalogOptions[kind] = snapshot;
    refreshOptionControls();
    toast(error.message, true);
  } finally {
    hideBusy();
  }
}

function openQuickOption(kind) {
  const labels = { categories: 'Nueva categoría', brands: 'Nueva marca', types: 'Nuevo tipo / concentración' };
  const value = prompt(`${labels[kind]}:`);
  if (!value) return;
  addCatalogOption(kind, value)
    .then(() => {
      if (kind === 'categories') $('#categoryInput').value = slugify(value);
      if (kind === 'brands') $('#brandInput').value = value.trim();
      if (kind === 'types') $('#typeInput').value = value.trim();
      refreshCsSelects();
    })
    .catch(error => toast(error.message, true));
}

async function imageFileToWebp(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const max = 1400;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .84));
  if (!blob) throw new Error('El navegador no pudo optimizar la imagen.');
  if (blob.size > 2 * 1024 * 1024) throw new Error('La imagen sigue superando 2 MB después de optimizarse. Usa una foto más pequeña.');

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { data: base64, contentType: 'image/webp', preview: URL.createObjectURL(blob), size: blob.size };
}

async function uploadImage(file) {
  updateBusy('Optimizando imagen…', 'Reduciendo tamaño y convirtiendo a WebP antes de subirla.');
  const optimized = await imageFileToWebp(file);
  updateBusy('Subiendo imagen…', `Enviando ${(optimized.size / 1024 / 1024).toFixed(2)} MB a Supabase Storage.`);
  const payload = await request('/api/admin/image', {
    method: 'POST',
    body: JSON.stringify({ data: optimized.data, contentType: optimized.contentType })
  });
  return payload;
}

async function saveProduct(event) {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  $('#saveProductButton').disabled = true;
  setEditorMessage('Guardando…');
  showBusy('Guardando perfume…', state.pendingImageFile ? 'Preparando la imagen y la información del producto.' : 'Actualizando la información del catálogo.');

  try {
    let imageUrl = $('#currentImageUrl').value;
    let imagePath = $('#currentImagePath').value || null;

    if (state.pendingImageFile) {
      setEditorMessage('Optimizando y subiendo imagen…');
      const uploaded = await uploadImage(state.pendingImageFile);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
    }

    if (!imageUrl) throw new Error('Selecciona una imagen para el perfume.');

    const sortOrder = Number($('#sortOrderInput').value || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new Error('El orden debe ser un número entero desde 0.');

    const data = {
      brand: $('#brandInput').value.trim(),
      name: $('#nameInput').value.trim(),
      type: $('#typeInput').value.trim(),
      category: $('#categoryInput').value,
      gender: $('#genderInput').value,
      status: $('#statusInput').value,
      sort_order: sortOrder,
      featured: $('#featuredInput').checked,
      image_url: imageUrl,
      image_path: imagePath
    };

    if (!data.brand || !data.type || !data.category || !data.name) throw new Error('Completa marca, nombre, tipo y categoría.');

    const id = $('#productId').value;
    if (id) data.id = id;
    updateBusy('Guardando perfume…', 'Actualizando la base de datos del catálogo.');
    await request('/api/admin/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });

    closeEditorAfterSave();
    await loadProducts();
    toast(id ? 'Perfume actualizado.' : 'Perfume creado.');
  } catch (error) {
    setEditorMessage(error.message);
  } finally {
    hideBusy();
    state.busy = false;
    $('#saveProductButton').disabled = false;
  }
}

function closeEditorAfterSave() {
  $('#editorOverlay').classList.remove('open');
  $('#editorOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function deleteProduct(product) {
  const first = confirm(`Vas a eliminar permanentemente “${product.brand} ${product.name}”.\n\nSi solo no quieres mostrarlo, usa OCULTAR.\n\n¿Continuar?`);
  if (!first) return;
  const word = prompt('Escribe ELIMINAR para confirmar:');
  if (word !== 'ELIMINAR') return toast('Eliminación cancelada.');

  showBusy('Eliminando perfume…', `${product.brand} ${product.name}`);
  try {
    await request('/api/admin/products', {
      method: 'DELETE',
      body: JSON.stringify({ id: product.id })
    });
    await loadProducts();
    toast('Perfume eliminado.');
  } catch (error) {
    toast(error.message, true);
  } finally {
    hideBusy();
  }
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', login);
  $('#logoutButton').addEventListener('click', logout);
  $('#newProductButton').addEventListener('click', () => openEditor());
  $('#manageListsButton').addEventListener('click', openLists);
  $('#productForm').addEventListener('submit', saveProduct);
  $('#closeEditorButton').addEventListener('click', closeEditor);
  $('#cancelEditorButton').addEventListener('click', closeEditor);
  $('#editorOverlay').addEventListener('click', event => { if (event.target === $('#editorOverlay')) closeEditor(); });
  $('#closeListsButton').addEventListener('click', closeLists);
  $('#listsOverlay').addEventListener('click', event => { if (event.target === $('#listsOverlay')) closeLists(); });
  $('#adminSearch').addEventListener('input', renderProducts);
  $('#categoryFilter').addEventListener('change', renderProducts);
  $('#statusFilter').addEventListener('change', renderProducts);

  $$('[data-add-option]').forEach(button => {
    button.addEventListener('click', () => openQuickOption(button.dataset.addOption));
  });

  $$('[data-option-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const input = form.elements.label;
      try {
        await addCatalogOption(form.dataset.optionForm, input.value);
        input.value = '';
        input.focus();
      } catch (error) {
        toast(error.message, true);
      }
    });
  });

  $('#imageInput').addEventListener('change', async event => {
    const [file] = event.target.files || [];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = '';
      return setEditorMessage('Selecciona JPG, PNG o WebP.');
    }
    state.pendingImageFile = file;
    $('#imageFileName').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB original`;
    setPreview(URL.createObjectURL(file));
    setEditorMessage('');
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#editorOverlay').classList.contains('open')) closeEditor();
    if ($('#listsOverlay').classList.contains('open')) closeLists();
  });
}

refreshCsSelects();
document.addEventListener('click', event => { if (![...csSelectRegistry.values()].some(root => root.contains(event.target))) closeCsSelects(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCsSelects(); });
bindEvents();
checkSession();
