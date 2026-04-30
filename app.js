// ============================================
// GOOD PORK - APP.JS (V2 DINÁMICA)
// ============================================
// Cambios principales vs v1:
// - Productos cargados desde Google Sheets (no hardcodeados)
// - orderState es dinámico (clave = ID del producto)
// - Botones preset (×24 pequeña, ×12 grande)
// - Pedidos guardan detalle como JSON en Sheets
// - Admin: select para cambiar estado + estadísticas
// ============================================

const CONFIG = {
    WHATSAPP_NUMBER: '573005005306',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxyJNCyW7edJQEJASled8TOj_XQ2PSZEFcm9w_iGH1exZKm9CbWppH09wp6NQkgtYHm/exec',
    ADMIN_PASSWORD: 'goodpork2025',
    MONEDA: '$',
    PRESET_PEQUENA: 24,   // Unidades preset para presentación "Pequeña"
    PRESET_GRANDE: 12,    // Unidades preset para presentación "Grande"
    // Productos de respaldo si la API falla
    FALLBACK_PRODUCTS: [
        { id: 'P01', nombre: 'Manteca de Cerdo 500ml', categoria: 'Manteca', presentacion: 'Pequeña', precio: 14000, imagen: '', descripcion: 'Tarro 500ml' },
        { id: 'P02', nombre: 'Manteca de Cerdo 1000ml', categoria: 'Manteca', presentacion: 'Grande', precio: 20000, imagen: '', descripcion: 'Tarro 1000ml' },
    ],
};

let products = [];         // Array de productos desde Google Sheets
let orderState = {};       // { 'P01': 0, 'P02': 3, ... }
let activeFilter = 'Todos'; // Filtro de categoría activo


// ── Utilidades ──────────────────────────────────────────────

function fmt(n) {
    return CONFIG.MONEDA + n.toLocaleString('es-CO');
}

function genId() {
    return 'GP-' + Date.now().toString(36).toUpperCase();
}

/** Obtiene el valor preset según el tipo de presentación */
function getPreset(presentacion) {
    const p = String(presentacion || '').toLowerCase().trim();
    if (p === 'grande') return CONFIG.PRESET_GRANDE;
    return CONFIG.PRESET_PEQUENA; // Por defecto "Pequeña"
}


// ── Carga de productos ─────────────────────────────────────

async function loadProducts() {
    try {
        const url = CONFIG.APPS_SCRIPT_URL + '?action=getProducts&t=' + Date.now();
        const res = await fetch(url);
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
            products = data;
        } else {
            products = CONFIG.FALLBACK_PRODUCTS;
            showToast('No se encontraron productos en Google Sheets, usando productos de respaldo', 'warning');
        }
    } catch (e) {
        console.warn('Error cargando productos:', e);
        products = CONFIG.FALLBACK_PRODUCTS;
        showToast('Error de conexion. Mostrando productos de respaldo', 'warning');
    }

    // Inicializar orderState con todos los productos en 0
    products.forEach(p => { orderState[p.id] = 0; });

    renderCatalogFilters();
    renderCatalogCards();
    renderQtySelectors();
    updateSummary();
}


// ── Renderizado: Filtros de categoría ──────────────────────

function renderCatalogFilters() {
    const container = document.getElementById('catalogoFilters');
    if (!container) return;

    // Obtener categorías únicas
    const cats = ['Todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];

    container.innerHTML = cats.map(cat => {
        const isActive = cat === activeFilter ? 'active' : '';
        return '<button class="cat-filter ' + isActive + '" onclick="filterCatalog(\'' + cat + '\')">' + cat + '</button>';
    }).join('');
}

function filterCatalog(cat) {
    activeFilter = cat;
    renderCatalogFilters();
    renderCatalogCards();
}


// ── Renderizado: Tarjetas del catálogo ─────────────────────

function renderCatalogCards() {
    const container = document.getElementById('catalogoGrid');
    if (!container) return;

    const filtered = activeFilter === 'Todos'
        ? products
        : products.filter(p => p.categoria === activeFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-16"><i class="fas fa-box-open text-4xl text-gp-brown/10 mb-4"></i><p class="text-gp-brown/30 text-sm">No hay productos en esta categoria</p></div>';
        return;
    }

    // Agrupar por categoría para mostrar separadores
    const grouped = {};
    filtered.forEach(p => {
        const cat = p.categoria || 'Sin categoria';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    let html = '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">';

    Object.keys(grouped).forEach(cat => {
        // Separador de categoría (solo si hay más de una y filtro es "Todos")
        if (activeFilter === 'Todos' && Object.keys(grouped).length > 1) {
            html += '<div class="category-header"><span>' + cat + '</span></div>';
        }

        grouped[cat].forEach(p => {
            const preset = getPreset(p.presentacion);
            const presLabel = String(p.presentacion || 'Pequeña');
            const presColor = presLabel.toLowerCase() === 'grande' ? 'bg-gp-darkRed/10 text-gp-darkRed' : 'bg-gp-red/10 text-gp-red';

            html += '<div class="catalog-card">';
            // Imagen
            html += '<div class="catalog-card-img">';
            if (p.imagen) {
                html += '<img src="' + p.imagen + '" alt="' + p.nombre + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=\\\'flex items-center justify-center h-full text-gp-brown/15\\\'><i class=\\\'fas fa-image text-4xl\\\'></i></div>\'">';
            } else {
                html += '<div class="flex items-center justify-center h-full text-gp-brown/15"><i class="fas fa-image text-4xl"></i></div>';
            }
            html += '<span class="catalog-cat-badge">' + (p.categoria || 'General') + '</span>';
            html += '</div>';
            // Info
            html += '<div class="p-4">';
            html += '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase mb-2 ' + presColor + '">' + presLabel + '</span>';
            html += '<h3 class="font-display font-bold text-base text-gp-darkRed mb-1 leading-snug">' + p.nombre + '</h3>';
            if (p.descripcion) {
                html += '<p class="text-gp-brown/50 text-xs mb-3 line-clamp-2">' + p.descripcion + '</p>';
            }
            html += '<div class="flex items-center justify-between">';
            html += '<span class="font-display font-bold text-xl text-gp-red">' + fmt(p.precio) + '</span>';
            html += '<span class="text-[10px] text-gp-brown/30">Preset: x' + preset + '</span>';
            html += '</div>';
            html += '</div></div>';
        });
    });

    html += '</div>';
    container.innerHTML = html;
}


// ── Renderizado: Selectores de cantidad en formulario ─────

function renderQtySelectors() {
    const container = document.getElementById('qtySelectorsContainer');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<p class="text-gp-brown/30 text-xs text-center py-4">No hay productos disponibles</p>';
        return;
    }

    let html = '';
    products.forEach(p => {
        const preset = getPreset(p.presentacion);
        const qty = orderState[p.id] || 0;
        const hasQty = qty > 0 ? 'has-qty' : '';

        html += '<div class="qty-row ' + hasQty + '" id="qtyRow-' + p.id + '">';
        // Thumbnail
        if (p.imagen) {
            html += '<img src="' + p.imagen + '" alt="" class="qty-thumb" onerror="this.style.display=\'none\'">';
        } else {
            html += '<div class="qty-thumb flex items-center justify-center text-gp-brown/10"><i class="fas fa-image text-sm"></i></div>';
        }
        // Nombre + precio
        html += '<div class="flex-1 min-w-0">';
        html += '<p class="text-sm font-semibold text-gp-darkRed truncate">' + p.nombre + '</p>';
        html += '<p class="text-xs text-gp-red font-bold">' + fmt(p.precio) + ' c/u</p>';
        html += '</div>';
        // Botón preset
        html += '<button class="preset-btn" id="preset-' + p.id + '" onclick="setQtyPreset(\'' + p.id + '\')" title="Establecer x' + preset + '">x' + preset + '</button>';
        // Controles de cantidad
        html += '<div class="flex items-center gap-2">';
        html += '<button onclick="changeQty(\'' + p.id + '\',-1)" class="qty-btn w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold" aria-label="Menos">−</button>';
        html += '<span id="qty-' + p.id + '" class="text-xl font-bold w-8 text-center text-gp-darkRed tabular-nums">' + qty + '</span>';
        html += '<button onclick="changeQty(\'' + p.id + '\',1)" class="qty-btn w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold" aria-label="Mas">+</button>';
        html += '</div>';
        // Subtotal
        html += '<span id="sub-' + p.id + '" class="text-xs font-semibold text-gp-brown/60 w-20 text-right tabular-nums">' + fmt(qty * p.precio) + '</span>';
        html += '</div>';
    });

    container.innerHTML = html;
}


// ── Lógica de cantidades ───────────────────────────────────

function changeQty(id, delta) {
    const current = orderState[id] || 0;
    orderState[id] = Math.max(0, Math.min(999, current + delta));

    // Actualizar span visual
    const span = document.getElementById('qty-' + id);
    if (span) span.textContent = orderState[id];

    // Resaltar fila si tiene cantidad
    const row = document.getElementById('qtyRow-' + id);
    if (row) row.classList.toggle('has-qty', orderState[id] > 0);

    // Actualizar estado del botón preset
    updatePresetBtn(id);

    updateSummary();
}

function setQtyPreset(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const preset = getPreset(product.presentacion);
    const current = orderState[id] || 0;

    // Si ya está en el preset, quitar (toggle). Si no, poner el preset.
    if (current === preset) {
        orderState[id] = 0;
    } else {
        orderState[id] = preset;
    }

    // Actualizar span
    const span = document.getElementById('qty-' + id);
    if (span) span.textContent = orderState[id];

    // Resaltar fila
    const row = document.getElementById('qtyRow-' + id);
    if (row) row.classList.toggle('has-qty', orderState[id] > 0);

    updatePresetBtn(id);
    updateSummary();
}

function updatePresetBtn(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const preset = getPreset(product.presentacion);
    const btn = document.getElementById('preset-' + id);
    if (btn) btn.classList.toggle('active', orderState[id] === preset);
}


// ── Resumen dinámico ───────────────────────────────────────

function updateSummary() {
    const container = document.getElementById('summaryContainer');
    if (!container) return;

    // Filtrar productos con cantidad > 0
    const items = products.filter(p => (orderState[p.id] || 0) > 0);
    let total = 0;

    if (items.length === 0) {
        container.innerHTML = '<p class="text-gp-brown/40 text-xs text-center py-4">Selecciona productos arriba para ver el resumen</p>';
        document.getElementById('submitOrder').disabled = true;
        return;
    }

    let html = '';
    items.forEach(p => {
        const qty = orderState[p.id];
        const sub = qty * p.precio;
        total += sub;
        html += '<div class="flex justify-between text-gp-brown">';
        html += '<span>' + p.nombre + ' x' + qty + '</span>';
        html += '<span>' + fmt(sub) + '</span>';
        html += '</div>';
    });

    html += '<div class="separator my-3"></div>';
    html += '<div class="flex justify-between items-center">';
    html += '<span class="font-semibold text-gp-darkRed">Total a pagar</span>';
    html += '<span class="font-display font-bold text-2xl text-gp-red">' + fmt(total) + '</span>';
    html += '</div>';

    container.innerHTML = html;
    document.getElementById('submitOrder').disabled = false;
}


// ── Validación del formulario ──────────────────────────────

function validateForm() {
    const fields = [
        { id: 'nombre', msg: 'Campo obligatorio' },
        { id: 'direccion', msg: 'Campo obligatorio' },
        { id: 'barrio', msg: 'Campo obligatorio' },
    ];
    let valid = true;

    fields.forEach(f => {
        const el = document.getElementById(f.id);
        const err = document.getElementById(f.id + 'Error');
        if (!el.value.trim()) {
            el.classList.add('border-red-500');
            err.innerHTML = '<i class="fas fa-circle-exclamation mr-1"></i>' + f.msg;
            err.classList.remove('hidden');
            valid = false;
        } else {
            el.classList.remove('border-red-500');
            err.classList.add('hidden');
        }
    });

    const tel = document.getElementById('telefono').value.trim();
    const telErr = document.getElementById('telefonoError');
    if (!tel) {
        document.getElementById('telefono').classList.add('border-red-500');
        telErr.innerHTML = '<i class="fas fa-circle-exclamation mr-1"></i>Campo obligatorio';
        telErr.classList.remove('hidden');
        valid = false;
    } else if (!/^\d{10,13}$/.test(tel)) {
        document.getElementById('telefono').classList.add('border-red-500');
        telErr.innerHTML = '<i class="fas fa-circle-exclamation mr-1"></i>Telefono invalido (10-13 digitos)';
        telErr.classList.remove('hidden');
        valid = false;
    } else {
        document.getElementById('telefono').classList.remove('border-red-500');
        telErr.classList.add('hidden');
    }

    const hasItems = products.some(p => (orderState[p.id] || 0) > 0);
    if (!hasItems) {
        showToast('Selecciona al menos un producto', 'warning');
        valid = false;
    }

    return valid;
}


// ── Envío de pedido ────────────────────────────────────────

async function submitOrder() {
    if (!validateForm()) return;

    const btn = document.getElementById('submitOrder');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner mr-2"></span> Procesando...';
    btn.disabled = true;

    const orderId = genId();
    const now = new Date();

    // Construir array de items del pedido
    const items = products
        .filter(p => (orderState[p.id] || 0) > 0)
        .map(p => ({
            id: p.id,
            nombre: p.nombre,
            cant: orderState[p.id],
            precioUnitario: p.precio,
            subtotal: orderState[p.id] * p.precio,
        }));

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);

    const orderData = {
        id: orderId,
        fecha: now.toLocaleDateString('es-CO'),
        hora: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        nombre: document.getElementById('nombre').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        barrio: document.getElementById('barrio').value.trim(),
        notas: document.getElementById('notas').value.trim(),
        detalle: JSON.stringify(items),
        total: total,
    };

    // Guardar en Google Sheets
    if (CONFIG.APPS_SCRIPT_URL) {
        try {
            await fetch(CONFIG.APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveOrder', order: orderData }),
            });
        } catch (e) {
            console.warn('No se pudo guardar en Google Sheets:', e);
        }
    }

    generatePDF(orderData, items);
    setTimeout(() => sendToWhatsApp(orderData, items), 600);
    showSuccessOverlay();

    // Reset
    setTimeout(() => {
        btn.innerHTML = origHTML;
        products.forEach(p => { orderState[p.id] = 0; });
        renderQtySelectors();
        updateSummary();
        ['nombre', 'telefono', 'direccion', 'barrio', 'notas'].forEach(id => {
            document.getElementById(id).value = '';
        });
    }, 4500);
}


// ── Generación de PDF (dinámico) ───────────────────────────

function generatePDF(order, items) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado
    doc.setFillColor(198, 40, 40);
    doc.rect(0, 0, 210, 48, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('GOOD PORK', 105, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Distribuidora de Productos de Cerdo', 105, 31, { align: 'center' });
    doc.setFontSize(8);
    doc.text('COMPROBANTE DE PEDIDO', 105, 41, { align: 'center' });

    let y = 58;
    doc.setTextColor(26, 26, 26);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Pedido: ' + order.id, 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('Fecha: ' + order.fecha + ' - ' + order.hora, 120, y);

    y += 12;
    doc.setDrawColor(198, 40, 40);
    doc.setLineWidth(0.5);
    doc.line(20, y, 190, y);

    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(198, 40, 40);
    doc.text('DATOS DEL CLIENTE', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    [
        ['Nombre:', order.nombre],
        ['Telefono:', order.telefono],
        ['Direccion:', order.direccion],
        ['Barrio:', order.barrio],
    ].forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 55, y);
        y += 7;
    });

    y += 8;
    doc.setDrawColor(198, 40, 40);
    doc.line(20, y, 190, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(198, 40, 40);
    doc.text('DETALLE DEL PEDIDO', 20, y);
    y += 8;

    // Encabezado de tabla
    doc.setFillColor(245, 235, 224);
    doc.rect(20, y - 5, 170, 9, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('PRODUCTO', 25, y);
    doc.text('CANT', 120, y, { align: 'center' });
    doc.text('P. UNITARIO', 150, y, { align: 'center' });
    doc.text('SUBTOTAL', 183, y, { align: 'center' });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);

    // Filas dinámicas de productos
    items.forEach(item => {
        doc.text(item.nombre, 25, y);
        doc.text(String(item.cant), 120, y, { align: 'center' });
        doc.text(fmt(item.precioUnitario), 150, y, { align: 'center' });
        doc.text(fmt(item.subtotal), 183, y, { align: 'center' });
        y += 9;
    });

    // Total
    y += 6;
    doc.setDrawColor(198, 40, 40);
    doc.setLineWidth(0.8);
    doc.line(125, y, 190, y);
    y += 9;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(198, 40, 40);
    doc.text('TOTAL:', 145, y, { align: 'right' });
    doc.text(fmt(order.total), 188, y, { align: 'right' });

    if (order.notas) {
        y += 16;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(198, 40, 40);
        doc.text('NOTAS:', 20, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(order.notas, 50, y);
    }

    // Pie
    doc.setFillColor(198, 40, 40);
    doc.rect(0, 278, 210, 19, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('Si es natural es saludable', 105, 286, { align: 'center' });
    doc.text('Good Pork - Distribuidora de Productos de Cerdo', 105, 292, { align: 'center' });

    doc.save('pedido-' + order.id + '.pdf');
}


// ── Envío por WhatsApp (dinámico) ─────────────────────────

function sendToWhatsApp(order, items) {
    let m = '*NUEVO PEDIDO - GOOD PORK*\n';
    m += '━━━━━━━━━━━━━━━━━━\n\n';
    m += '*Pedido:* ' + order.id + '\n';
    m += '*Fecha:* ' + order.fecha + ' - ' + order.hora + '\n\n';
    m += '*Datos del Cliente:*\n';
    m += '  Nombre: ' + order.nombre + '\n';
    m += '  Telefono: ' + order.telefono + '\n';
    m += '  Direccion: ' + order.direccion + '\n';
    m += '  Barrio: ' + order.barrio + '\n\n';
    m += '*Detalle del Pedido:*\n';
    items.forEach(item => {
        m += '  ' + item.nombre + ' x' + item.cant + ' = ' + fmt(item.subtotal) + '\n';
    });
    m += '\n*TOTAL: ' + fmt(order.total) + '*\n';
    if (order.notas) {
        m += '\n*Notas:* ' + order.notas + '\n';
    }
    m += '\n_Se adjunta comprobante PDF_';

    window.open('https://wa.me/' + CONFIG.WHATSAPP_NUMBER + '?text=' + encodeURIComponent(m), '_blank');
}


// ── Toasts ─────────────────────────────────────────────────

function showToast(msg, type) {
    type = type || 'info';
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    const colors = {
        info: 'border-gp-red bg-white/95',
        success: 'border-green-500 bg-white/95',
        warning: 'border-yellow-500 bg-white/95',
        error: 'border-red-500 bg-white/95',
    };
    const icons = {
        info: 'fa-circle-info text-gp-red',
        success: 'fa-circle-check text-green-500',
        warning: 'fa-triangle-exclamation text-yellow-500',
        error: 'fa-circle-xmark text-red-500',
    };
    t.className = 'toast pointer-events-auto border-l-4 ' + colors[type] + ' rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-gp-darkRed shadow-xl backdrop-blur-lg';
    t.innerHTML = '<i class="fas ' + icons[type] + '"></i><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(() => {
        t.classList.add('toast-exit');
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

function showSuccessOverlay() {
    const o = document.getElementById('successOverlay');
    o.classList.remove('hidden');
    o.style.animation = 'fadeIn .4s ease-out';
    setTimeout(() => {
        o.classList.add('hidden');
        o.style.animation = '';
    }, 4000);
}


// ── Panel Admin ────────────────────────────────────────────

function toggleAdmin() {
    const p = document.getElementById('adminPanel');
    p.classList.toggle('hidden');
    document.body.style.overflow = p.classList.contains('hidden') ? '' : 'hidden';
}

function adminLogin() {
    if (document.getElementById('adminPass').value === CONFIG.ADMIN_PASSWORD) {
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminContent').classList.remove('hidden');
        loadOrders();
    } else {
        showToast('Contrasena incorrecta', 'error');
    }
}

function showSetupGuide() {
    document.getElementById('setupGuide').classList.toggle('hidden');
}


// ── Carga y renderizado de pedidos (admin) ─────────────────

async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    const statsContainer = document.getElementById('statsContainer');

    if (!CONFIG.APPS_SCRIPT_URL) {
        container.innerHTML = '<div class="text-center py-16"><i class="fas fa-database text-4xl text-gp-brown/10 mb-4"></i><p class="text-gp-brown/40 text-sm mb-2">Google Sheets no configurado</p></div>';
        statsContainer.innerHTML = '';
        document.getElementById('orderCount').textContent = '';
        return;
    }

    container.innerHTML = '<div class="text-center py-16"><span class="spinner" style="width:32px;height:32px;border-width:3px"></span><p class="text-gp-brown/30 text-sm mt-4">Cargando pedidos...</p></div>';
    statsContainer.innerHTML = '<div class="text-center py-4"><span class="spinner" style="width:20px;height:20px;border-width:2px"></span></div>';

    try {
        const url = CONFIG.APPS_SCRIPT_URL + '?action=getOrders&t=' + Date.now();
        const res = await fetch(url);
        const orders = await res.json();
        renderStatistics(orders);
        renderOrders(orders);
    } catch (e) {
        console.error('Error cargando pedidos:', e);
        container.innerHTML = '<div class="text-center py-16"><i class="fas fa-exclamation-triangle text-4xl text-gp-brown/10 mb-4"></i><p class="text-gp-brown/40 text-sm mb-2">Error al cargar pedidos</p><p class="text-gp-brown/25 text-xs">Verifica la URL de Apps Script</p></div>';
        statsContainer.innerHTML = '';
        document.getElementById('orderCount').textContent = '';
    }
}


// ── Renderizado de tabla de pedidos ────────────────────────

function renderOrders(orders) {
    const container = document.getElementById('ordersContainer');
    const countEl = document.getElementById('orderCount');

    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="text-center py-16"><i class="fas fa-inbox text-4xl text-gp-brown/10 mb-4"></i><p class="text-gp-brown/30 text-sm">No hay pedidos registrados</p></div>';
        countEl.textContent = '';
        return;
    }

    countEl.textContent = orders.length + ' pedido' + (orders.length !== 1 ? 's' : '');
    const sorted = [...orders].reverse();

    const estados = ['Pendiente', 'En Progreso', 'Entregado', 'Pagado', 'Cancelado'];

    let html = '<div class="overflow-x-auto"><table class="orders-table w-full text-left"><thead><tr>';
    html += '<th class="px-3 py-3 rounded-tl-lg">ID</th>';
    html += '<th class="px-3 py-3">Fecha</th>';
    html += '<th class="px-3 py-3">Cliente</th>';
    html += '<th class="px-3 py-3 hidden sm:table-cell">Telefono</th>';
    html += '<th class="px-3 py-3 hidden lg:table-cell">Productos</th>';
    html += '<th class="px-3 py-3">Total</th>';
    html += '<th class="px-3 py-3 rounded-tr-lg">Estado</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(o => {
        const id = o.id || '-';
        const fecha = o.fecha || '-';
        const hora = o.hora || '';
        const nombre = o.nombre || '-';
        const tel = o.telefono || '-';
        const totalNum = typeof o.total === 'number' ? o.total : parseInt(String(o.total || '0').replace(/\D/g, '')) || 0;
        const estado = o.estado || 'Pendiente';

        // Parsear detalle JSON para mostrar productos
        let detailHTML = '-';
        try {
            const detailArr = JSON.parse(o.detalle || '[]');
            if (detailArr.length > 0) {
                detailHTML = '<div class="detail-chips">';
                detailArr.forEach(d => {
                    detailHTML += '<span class="detail-chip">' + (d.nombre || '?') + ' <strong>x' + (d.cant || 0) + '</strong></span>';
                });
                detailHTML += '</div>';
            }
        } catch (e) {
            detailHTML = '<span class="text-gp-brown/30 text-xs">Error al leer</span>';
        }

        // Generar opciones del select de estado
        let selectHTML = '<select class="status-select" onchange="updateOrderStatus(\'' + id + '\', this.value)" style="color:' + getStatusColor(estado) + '">';
        estados.forEach(est => {
            const selected = est === estado ? ' selected' : '';
            selectHTML += '<option value="' + est + '"' + selected + '>' + est + '</option>';
        });
        selectHTML += '</select>';

        html += '<tr class="text-gp-brown">';
        html += '<td class="px-3 py-2.5 font-mono text-xs text-gp-red whitespace-nowrap">' + id + '</td>';
        html += '<td class="px-3 py-2.5 whitespace-nowrap text-xs">' + fecha + (hora ? ' ' + hora : '') + '</td>';
        html += '<td class="px-3 py-2.5 font-medium text-gp-darkRed text-sm">' + nombre + '</td>';
        html += '<td class="px-3 py-2.5 hidden sm:table-cell text-xs">' + tel + '</td>';
        html += '<td class="px-3 py-2.5 hidden lg:table-cell">' + detailHTML + '</td>';
        html += '<td class="px-3 py-2.5 font-semibold text-gp-red whitespace-nowrap text-sm">' + fmt(totalNum) + '</td>';
        html += '<td class="px-3 py-2.5">' + selectHTML + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/** Color del texto según estado */
function getStatusColor(estado) {
    const e = (estado || '').toLowerCase();
    if (e === 'pagado' || e === 'entregado') return '#16a34a';
    if (e === 'cancelado') return '#dc2626';
    if (e === 'en progreso') return '#d97706';
    return '#5d4037'; // Pendiente
}


// ── Cambiar estado de pedido ───────────────────────────────

async function updateOrderStatus(orderId, newStatus) {
    try {
        await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateStatus', id: orderId, status: newStatus }),
        });
        showToast('Estado actualizado a: ' + newStatus, 'success');
    } catch (e) {
        console.error('Error actualizando estado:', e);
        showToast('Error al actualizar estado', 'error');
    }
}


// ── Estadísticas ───────────────────────────────────────────

function renderStatistics(orders) {
    const container = document.getElementById('statsContainer');
    if (!orders || orders.length === 0) {
        container.innerHTML = '';
        return;
    }

    // ── Métricas generales ──
    const totalPedidos = orders.length;
    const totalIngresos = orders.reduce((s, o) => {
        const n = typeof o.total === 'number' ? o.total : parseInt(String(o.total || '0').replace(/\D/g, '')) || 0;
        return s + n;
    }, 0);
    const promedio = totalPedidos > 0 ? Math.round(totalIngresos / totalPedidos) : 0;

    // ── Pedidos por día de la semana ──
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Dom=0, Lun=1, ..., Sab=6

    orders.forEach(o => {
        const fechaStr = o.fecha || '';
        // Intentar parsear la fecha (formato es-CO: dd/mm/aaaa)
        const parts = fechaStr.split('/');
        if (parts.length === 3) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(d.getDay())) counts[d.getDay()]++;
        }
    });

    const maxCount = Math.max(...counts, 1);
    const peakDay = dias[counts.indexOf(maxCount)];
    const peakCount = maxCount;

    // ── Renderizar métricas ──
    let html = '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">';
    html += statCard(totalPedidos, 'Total Pedidos', 'fa-receipt');
    html += statCard(fmt(totalIngresos), 'Ingresos Totales', 'fa-coins');
    html += statCard(fmt(promedio), 'Promedio / Pedido', 'fa-chart-line');
    html += statCard(peakDay + ' (' + peakCount + ')', 'Dia Mas Activo', 'fa-calendar-star');
    html += '</div>';

    // ── Renderizar gráfico de barras ──
    html += '<div class="bg-white border border-gp-brown/[.08] rounded-xl p-5">';
    html += '<h4 class="font-semibold text-gp-darkRed text-sm mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-gp-red text-xs"></i> Pedidos por Dia de la Semana</h4>';
    html += '<div class="bar-chart">';
    dias.forEach((dia, i) => {
        const pct = (counts[i] / maxCount) * 100;
        const isPeak = counts[i] === maxCount && maxCount > 0;
        html += '<div class="bar-col">';
        html += '<div class="bar-fill ' + (isPeak ? 'peak' : '') + '" style="height:' + Math.max(pct, 3) + '%">';
        if (counts[i] > 0) html += '<span class="bar-count">' + counts[i] + '</span>';
        html += '</div>';
        html += '<span class="bar-label">' + dia.substring(0, 3) + '</span>';
        html += '</div>';
    });
    html += '</div></div>';

    container.innerHTML = html;
}

function statCard(value, label, icon) {
    return '<div class="stat-card">' +
        '<div class="w-8 h-8 rounded-lg bg-gp-red/10 flex items-center justify-center mx-auto mb-2">' +
        '<i class="fas ' + icon + ' text-gp-red text-xs"></i></div>' +
        '<div class="stat-value">' + value + '</div>' +
        '<div class="stat-label">' + label + '</div></div>';
}


// ── Header scroll ──────────────────────────────────────────

window.addEventListener('scroll', () => {
    document.getElementById('mainHeader').classList.toggle('header-scrolled', window.scrollY > 40);
});


// ── IntersectionObserver para animaciones ──────────────────

const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('active'); });
}, { threshold: 0.08 });


// ── Inicialización ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Observar elementos .reveal
    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

    // Cargar productos desde Google Sheets
    loadProducts();

    // Configurar botón flotante de WhatsApp
    const waBtn = document.getElementById('waFloatBtn');
    if (waBtn) waBtn.href = 'https://wa.me/' + CONFIG.WHATSAPP_NUMBER;

    // Limpiar errores al escribir
    ['nombre', 'telefono', 'direccion', 'barrio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            el.classList.remove('border-red-500');
            const err = document.getElementById(id + 'Error');
            if (err) err.classList.add('hidden');
        });
    });

    // Filtrar teléfono: solo dígitos
    const telEl = document.getElementById('telefono');
    if (telEl) telEl.addEventListener('input', () => {
        telEl.value = telEl.value.replace(/\D/g, '');
    });
});