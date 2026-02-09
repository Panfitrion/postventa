// app.js - Consolidated TPV Logic

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://ftzatcexxzyvevpysdps.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0emF0Y2V4eHp5dmV2cHlzZHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NDE1NDksImV4cCI6MjA4NDUxNzU0OX0.ptIqy3GDqhF8BpV1BM4kHxG8qtbHA0ckGmnCS2K53BM';

/**
 * @IMPORTANT SECURITY NOTE
 * These keys are exposed in the client-side code. 
 * Ensure Row Level Security (RLS) is enabled in Supabase to restrict access.
 */
// Supabase client is assumed to be available globally via <script> tag if not using modules,
// but for the sake of consolidation, we will use the global createClient if it exists.
let sb = null;
if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// --- GLOBAL STATE ---
const store = {
    categorias: {},
    categoriasInfo: {},
    productos: [],
    carrito: [],
    metodoPago: null,
    estadisticas: {},
    ventasTotales: 0,
    ventasTarjeta: 0,
    ventasEfectivo: 0,
    numTransacciones: 0,
    fechaReporteVisualizando: new Date(),
    retiros: [],
    transacciones: [],
    categoriaActiva: null,
    modoReordenar: false,

    operacionesRetiro: [
        { id: 1, emoji: '🧹', nombre: 'Limpieza' },
        { id: 2, emoji: '🗑️', nombre: 'Basura' },
        { id: 3, emoji: '🧪', 'nombre': 'Bioproducts' },
        { id: 4, emoji: '🌐', nombre: 'Central en Linea' }
    ],
    operacionesIngreso: [
        { id: 1, emoji: '🌸', nombre: 'Blom' }
    ],
    denominacionesBilletes: [500, 200, 100, 50, 20],
    denominacionesMonedas: [10, 5, 2, 1]
};

// --- UTILITY FUNCTIONS ---
function obtenerLunesDeLaSemana(fecha) {
    const dia = fecha.getDay();
    const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1);
    return new Date(new Date(fecha).setDate(diff));
}

function obtenerSabadoDeLaSemana(lunes) {
    const sabado = new Date(lunes);
    sabado.setDate(sabado.getDate() + 5);
    return sabado;
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const container = document.getElementById('notificacion-container');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notificacion ${tipo}`;
    notif.textContent = mensaje;
    container.appendChild(notif);

    // Auto-remove after 3s
    setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => notif.remove(), 500);
    }, 3000);
}

// --- NUMPAD LOGIC ---
function numpadInput(inputId, value) {
    const input = document.getElementById(inputId);
    if (!input) return;

    let current = input.value;

    // If current is '0' and we type a number, replace it
    if (current === '0' && value !== '.') {
        current = value;
    } else {
        // Prevent multiple decimals
        if (value === '.' && current.includes('.')) return;
        current += value;
    }

    input.value = current;
}

function numpadClear(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.value = '0';
}

function renderOperacionesRapidas() {
    const containerRetiro = document.getElementById('quickOpsRetiro');
    const containerIngreso = document.getElementById('quickOpsIngreso');

    if (containerRetiro) {
        containerRetiro.innerHTML = '';
        store.operacionesRetiro.forEach(op => {
            const btn = document.createElement('button');
            btn.className = 'win-btn';
            btn.style.padding = '4px 8px';
            btn.style.fontSize = '0.85rem';
            btn.innerHTML = `${op.emoji} ${op.nombre}`;
            btn.onclick = () => setOperacionRapida('justificacionRetiro', op.nombre);
            containerRetiro.appendChild(btn);
        });
    }

    if (containerIngreso) {
        containerIngreso.innerHTML = '';
        store.operacionesIngreso.forEach(op => {
            const btn = document.createElement('button');
            btn.className = 'win-btn';
            btn.style.padding = '4px 8px';
            btn.style.fontSize = '0.85rem';
            btn.innerHTML = `${op.emoji} ${op.nombre}`;
            btn.onclick = () => setOperacionRapida('conceptoIngreso', op.nombre);
            containerIngreso.appendChild(btn);
        });
    }
}

function setOperacionRapida(inputId, value) {
    const input = document.getElementById(inputId);
    if (input) input.value = value;
}

// --- RENDERING LOGIC ---
function renderizarProductos() {
    const tabsContainer = document.getElementById('categoriasTabs');
    const grid = document.getElementById('productosGrid');
    if (!tabsContainer || !grid) return;

    tabsContainer.innerHTML = '';
    const categoriasConProductos = Object.keys(store.categorias).filter(key =>
        store.categorias[key] && store.categorias[key].length > 0
    );

    if (categoriasConProductos.length === 0) {
        grid.innerHTML = '<p class="text-center" style="padding: 40px; width: 100%;">No hay productos disponibles. Agrega productos desde el panel de administración.</p>';
        return;
    }

    if (!store.categoriaActiva || !store.categorias[store.categoriaActiva]) {
        store.categoriaActiva = categoriasConProductos[0];
    }

    categoriasConProductos.forEach(categoriaKey => {
        const tab = document.createElement('button');
        tab.className = `categoria-tab win-btn ${categoriaKey === store.categoriaActiva ? 'active' : ''}`;
        tab.textContent = store.categoriasInfo[categoriaKey]?.nombre || categoriaKey;
        tab.onclick = () => {
            store.categoriaActiva = categoriaKey;
            renderizarProductos();
        };
        tabsContainer.appendChild(tab);
    });

    grid.innerHTML = '';
    const productosAMostrar = store.categorias[store.categoriaActiva] || [];

    productosAMostrar.forEach((producto) => {
        const card = document.createElement('div');

        if (producto.esSubcategoria) {
            card.className = 'subcategoria-header';
            card.innerHTML = `${producto.nombre}`;
        } else {
            card.className = 'producto-card win-window';
            card.innerHTML = `<div class="win-content">${producto.nombre}</div>`;
            card.onclick = () => agregarAlCarrito(producto);
        }
        grid.appendChild(card);
    });
}

function actualizarVistaCarrito() {
    const carritoItems = document.getElementById('carritoItems');
    const totalCarrito = document.getElementById('totalCarrito');
    if (!carritoItems || !totalCarrito) return;

    if (store.carrito.length === 0) {
        carritoItems.innerHTML = '<p class="text-center" style="padding: 20px;">Carrito vacío</p>';
        totalCarrito.textContent = '0.00';
        return;
    }

    carritoItems.innerHTML = '';
    let total = 0;

    store.carrito.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'carrito-item';
        itemDiv.innerHTML = `
            <div>${item.nombre} x${item.cantidad}</div>
            <div>$${(item.precio * item.cantidad).toFixed(2)}</div>
        `;
        carritoItems.appendChild(itemDiv);
        total += item.precio * item.cantidad;
    });

    totalCarrito.textContent = total.toFixed(2);
}

function renderizarBilletesYMonedas() {
    const gridBilletes = document.querySelector('.billetes-grid');
    const rowMonedas = document.querySelector('.monedas-row');
    if (!gridBilletes || !rowMonedas) return;

    gridBilletes.innerHTML = '';
    store.denominacionesBilletes.forEach(valor => {
        const img = document.createElement('img');
        img.src = `DINERO/${valor} pesos.png`;
        img.className = 'billete';
        img.onclick = () => pantallaEfectivoAgregar(valor);
        gridBilletes.appendChild(img);
    });

    rowMonedas.innerHTML = '';
    store.denominacionesMonedas.forEach(valor => {
        const img = document.createElement('img');
        img.src = `DINERO/${valor} pesos.png`;
        img.className = 'moneda';
        img.onclick = () => pantallaEfectivoAgregar(valor);
        rowMonedas.appendChild(img);
    });
}

// --- CORE LOGIC ---
function agregarAlCarrito(producto) {
    const item = store.carrito.find(i => i.id === producto.id);
    if (item) {
        item.cantidad++;
    } else {
        store.carrito.push({ ...producto, cantidad: 1 });
    }
    actualizarVistaCarrito();
    mostrarNotificacion(`Agregado: ${producto.nombre}`);
}

function limpiarCarrito() {
    store.carrito = [];
    actualizarVistaCarrito();
}

function seleccionarMetodo(metodo) {
    if (store.carrito.length === 0) {
        mostrarNotificacion('El carrito está vacío', 'error');
        return;
    }

    store.metodoPago = metodo;
    const total = parseFloat(document.getElementById('totalCarrito').textContent);

    if (metodo === 'efectivo') {
        abrirPantallaEfectivo(total);
    } else {
        registrarVenta(total);
    }
}

function abrirPantallaEfectivo(total) {
    document.getElementById('pantallaEfectivoTotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('pantallaEfectivoRecibido').textContent = '0.00';
    document.getElementById('pantallaEfectivoCambio').textContent = '0.00';
    // FIX: Target .app-wrapper instead of mainContainer
    document.querySelector('.app-wrapper').classList.add('hidden');
    document.getElementById('pantallaEfectivo').classList.remove('hidden');
}

function pantallaEfectivoAgregar(valor) {
    const recibidoEl = document.getElementById('pantallaEfectivoRecibido');
    const cambioEl = document.getElementById('pantallaEfectivoCambio');
    const total = parseFloat(document.getElementById('pantallaEfectivoTotal').textContent.replace('$', ''));

    let recibido = parseFloat(recibidoEl.textContent) + valor;
    recibidoEl.textContent = recibido.toFixed(2);

    let cambio = recibido - total;
    cambioEl.textContent = cambio >= 0 ? cambio.toFixed(2) : '0.00';
}

function pantallaEfectivoReset() {
    document.getElementById('pantallaEfectivoRecibido').textContent = '0.00';
    document.getElementById('pantallaEfectivoCambio').textContent = '0.00';
}

function pantallaEfectivoCancelar() {
    document.getElementById('pantallaEfectivo').classList.add('hidden');
    document.querySelector('.app-wrapper').classList.remove('hidden');
}

function pantallaEfectivoConfirmar() {
    const recibido = parseFloat(document.getElementById('pantallaEfectivoRecibido').textContent);
    const total = parseFloat(document.getElementById('pantallaEfectivoTotal').textContent.replace('$', ''));

    if (recibido < total) {
        mostrarNotificacion('Monto insuficiente', 'error');
        return;
    }

    registrarVenta(total, recibido);
    pantallaEfectivoCancelar();
}

async function registrarVenta(total, montoRecibido = null) {
    const transaccion = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        items: [...store.carrito],
        total: total,
        metodoPago: store.metodoPago,
        montoRecibido: montoRecibido,
        cambio: montoRecibido ? (montoRecibido - total) : 0
    };

    store.transacciones.push(transaccion);
    store.ventasTotales += total;
    if (store.metodoPago === 'efectivo') store.ventasEfectivo += total;
    else store.ventasTarjeta += total;
    store.numTransacciones++;

    // Supabase Sync
    if (sb) {
        try {
            const { error } = await sb.from('ventas').insert([{ total, metodo_pago: store.metodoPago }]);
            if (error) console.error('Supabase Sync Error:', error.message);
        } catch (err) {
            console.error('Supabase Exception:', err);
        }
    }

    guardarDatosLocalStorage();
    limpiarCarrito();
    mostrarNotificacion('✓ Venta registrada correctamente');
}

// --- PERSISTENCE ---
function guardarDatosLocalStorage() {
    const fechaKey = new Date().toDateString();
    const datos = {
        estadisticas: store.estadisticas,
        ventasTotales: store.ventasTotales,
        ventasTarjeta: store.ventasTarjeta,
        ventasEfectivo: store.ventasEfectivo,
        numTransacciones: store.numTransacciones,
        fecha: fechaKey,
        categorias: store.categorias,
        categoriasInfo: store.categoriasInfo,
        retiros: store.retiros,
        transacciones: store.transacciones
    };

    try {
        localStorage.setItem('panaderiaDatos', JSON.stringify(datos));
        const historico = JSON.parse(localStorage.getItem('panaderiaHistorico') || '{}');
        historico[fechaKey] = datos;
        localStorage.setItem('panaderiaHistorico', JSON.stringify(historico));
    } catch (error) {
        console.error('Error saving LocalStorage:', error);
    }
}

function cargarDatosLocalStorage() {
    try {
        const datosGuardados = localStorage.getItem('panaderiaDatos');
        if (datosGuardados) {
            const datos = JSON.parse(datosGuardados);
            const fechaHoy = new Date().toDateString();

            if (datos.categorias) store.categorias = datos.categorias;
            if (datos.categoriasInfo) store.categoriasInfo = datos.categoriasInfo;

            if (datos.fecha === fechaHoy) {
                store.estadisticas = datos.estadisticas || {};
                store.ventasTotales = datos.ventasTotales || 0;
                store.ventasTarjeta = datos.ventasTarjeta || 0;
                store.ventasEfectivo = datos.ventasEfectivo || 0;
                store.numTransacciones = datos.numTransacciones || 0;
                store.retiros = datos.retiros || [];
                store.transacciones = datos.transacciones || [];
            }
        }
    } catch (error) {
        console.error('Error loading LocalStorage:', error);
    }
}

// --- VIEW SWITCHING ---
function mostrarSeccion(seccionId) {
    // For now, TPV is the only section, but we handle the menu active state
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(seccionId)) {
            btn.classList.add('active');
        }
    });
}

// --- ADMIN MODALS & LOGIC ---
function abrirModalVentaManual() {
    document.getElementById('modalVentaManual').classList.remove('hidden');
}

function cerrarModalVentaManual() {
    document.getElementById('modalVentaManual').classList.add('hidden');
}

function abrirModalRetiro() {
    renderOperacionesRapidas();
    document.getElementById('modalRetiro').classList.remove('hidden');
}

function cerrarModalRetiro() {
    document.getElementById('modalRetiro').classList.add('hidden');
}

function abrirModalIngreso() {
    renderOperacionesRapidas();
    document.getElementById('modalIngreso').classList.remove('hidden');
}

function cerrarModalIngreso() {
    document.getElementById('modalIngreso').classList.add('hidden');
}

function confirmarRetiro() {
    const monto = parseFloat(document.getElementById('montoRetiro').value);
    const jus = document.getElementById('justificacionRetiro').value;
    if (isNaN(monto)) return mostrarNotificacion('Monto inválido', 'error');
    store.retiros.push({ fecha: new Date().toISOString(), monto, justificacion: jus });
    store.ventasEfectivo -= monto;
    guardarDatosLocalStorage();
    cerrarModalRetiro();
    mostrarNotificacion('Retiro registrado');
}

function confirmarIngreso() {
    const monto = parseFloat(document.getElementById('montoIngreso').value);
    const con = document.getElementById('conceptoIngreso').value;
    if (isNaN(monto)) return mostrarNotificacion('Monto inválido', 'error');
    store.transacciones.push({ fecha: new Date().toISOString(), total: monto, metodoPago: 'ingreso', concepto: con });
    store.ventasEfectivo += monto;
    guardarDatosLocalStorage();
    cerrarModalIngreso();
    mostrarNotificacion('Ingreso registrado');
}

function seleccionarMetodoVentaManual(metodo) {
    const monto = parseFloat(document.getElementById('montoVentaManual').value);
    if (isNaN(monto) || monto <= 0) {
        mostrarNotificacion('Monto inválido', 'error');
        return;
    }
    store.metodoPago = metodo;
    registrarVenta(monto);
    cerrarModalVentaManual();
}

function abrirModalReporte() {
    store.fechaReporteVisualizando = new Date();
    actualizarVistaReporte();
    document.getElementById('modalReporte').classList.remove('hidden');
}

function cerrarModalReporte() {
    document.getElementById('modalReporte').classList.add('hidden');
}

function cambiarDiaReporte(dias) {
    store.fechaReporteVisualizando.setDate(store.fechaReporteVisualizando.getDate() + dias);
    actualizarVistaReporte();
}

function actualizarVistaReporte() {
    const fecha = store.fechaReporteVisualizando;
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('reporteFechaModal').textContent = fecha.toLocaleDateString('es-ES', opciones);

    const fechaStr = fecha.toDateString();
    const historico = JSON.parse(localStorage.getItem('panaderiaHistorico') || '{}');
    const datosDelDia = historico[fechaStr] || {
        ventasTotales: 0,
        ventasEfectivo: 0,
        ventasTarjeta: 0,
        numTransacciones: 0,
        retiros: [],
        transacciones: []
    };

    document.getElementById('reporteVentasTotales').textContent = `$${datosDelDia.ventasTotales.toFixed(2)}`;
    document.getElementById('reporteVentasEfectivo').textContent = `$${datosDelDia.ventasEfectivo.toFixed(2)}`;
    document.getElementById('reporteVentasTarjeta').textContent = `$${datosDelDia.ventasTarjeta.toFixed(2)}`;
    document.getElementById('reporteNumTransacciones').textContent = datosDelDia.numTransacciones;

    // Ticket promedio
    const ticketPromedio = datosDelDia.numTransacciones > 0 ? (datosDelDia.ventasTotales / datosDelDia.numTransacciones) : 0;
    document.getElementById('reporteTicketPromedio').textContent = `$${ticketPromedio.toFixed(2)}`;

    // Productos vendidos y top productos
    let productosVendidos = 0;
    const productosContador = {};
    let primeraVenta = null;
    let ultimaVenta = null;
    const ventasPorHora = Array(24).fill(0);
    (datosDelDia.transacciones || []).forEach(t => {
        if (t.metodoPago === 'ingreso') return;
        const fechaVenta = new Date(t.fecha);
        if (!primeraVenta || fechaVenta < primeraVenta) primeraVenta = fechaVenta;
        if (!ultimaVenta || fechaVenta > ultimaVenta) ultimaVenta = fechaVenta;
        const hora = fechaVenta.getHours();
        ventasPorHora[hora] += t.total;
        (t.items || []).forEach(item => {
            productosVendidos += item.cantidad || 1;
            if (!productosContador[item.nombre]) productosContador[item.nombre] = 0;
            productosContador[item.nombre] += item.cantidad || 1;
        });
    });
    document.getElementById('reporteProductosVendidos').textContent = productosVendidos;
    // Top productos
    const topProductos = Object.entries(productosContador).sort((a,b)=>b[1]-a[1]);
    document.getElementById('reporteProductoMasVendido').textContent = topProductos[0] ? `${topProductos[0][0]} (${topProductos[0][1]})` : '-';
    // Tabla Top 3
    const tablaTop = document.getElementById('tablaTopProductos').querySelector('tbody');
    tablaTop.innerHTML = '';
    topProductos.slice(0,3).forEach(([nombre, cantidad]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${nombre}</td><td style='text-align:right'>${cantidad}</td>`;
        tablaTop.appendChild(tr);
    });

    // Porcentaje métodos de pago
    const totalEfectivo = datosDelDia.ventasEfectivo || 0;
    const totalTarjeta = datosDelDia.ventasTarjeta || 0;
    const totalVentas = totalEfectivo + totalTarjeta;
    const pctEfectivo = totalVentas > 0 ? (totalEfectivo/totalVentas*100).toFixed(0) : 0;
    const pctTarjeta = totalVentas > 0 ? (totalTarjeta/totalVentas*100).toFixed(0) : 0;
    document.getElementById('reportePorcentajeMetodos').textContent = `${pctEfectivo}% / ${pctTarjeta}%`;

    // Primera y última venta
    document.getElementById('reportePrimeraVenta').textContent = primeraVenta ? primeraVenta.toLocaleTimeString('es-MX') : '-';
    document.getElementById('reporteUltimaVenta').textContent = ultimaVenta ? ultimaVenta.toLocaleTimeString('es-MX') : '-';

    // Tabla ventas por hora
    const tablaHora = document.getElementById('tablaVentasPorHora').querySelector('tbody');
    tablaHora.innerHTML = '';
    ventasPorHora.forEach((v, h) => {
        if (v > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${h}:00</td><td style='text-align:right'>$${v.toFixed(2)}</td>`;
            tablaHora.appendChild(tr);
        }
    });
    // Gráfica de barras simple
    let ventasPorHoraHtml = '<div style="display:flex; gap:2px; align-items:end; height:40px;">';
    const maxVentaHora = Math.max(...ventasPorHora);
    ventasPorHora.forEach((v, h) => {
        const altura = maxVentaHora > 0 ? Math.round((v/maxVentaHora)*35)+5 : 5;
        ventasPorHoraHtml += `<div title="${h}:00" style="width:8px; height:${altura}px; background:#1084d0; margin:0 1px;"></div>`;
    });
    ventasPorHoraHtml += '</div>';
    ventasPorHoraHtml += '<div style="font-size:10px; display:flex; justify-content:space-between;"><span>0h</span><span>12h</span><span>23h</span></div>';
    document.getElementById('reporteVentasPorHoraGrafica').innerHTML = ventasPorHoraHtml;

    // Detalle de retiros
    const totalRetiros = (datosDelDia.retiros||[]).reduce((sum, r) => sum + r.monto, 0);
    document.getElementById('reporteTotalRetiros').textContent = `$${totalRetiros.toFixed(2)}`;
    let detalleRetiros = '<ul style="margin:0; padding-left:18px;">';
    (datosDelDia.retiros||[]).forEach(r => {
        detalleRetiros += `<li>$${r.monto.toFixed(2)} - ${r.justificacion||''}</li>`;
    });
    detalleRetiros += '</ul>';
    document.getElementById('reporteDetalleRetiros').innerHTML = detalleRetiros;

    // Detalle de ingresos
    const totalIngresos = (datosDelDia.transacciones||[])
        .filter(t => t.metodoPago === 'ingreso')
        .reduce((sum, t) => sum + t.total, 0);
    document.getElementById('reporteTotalIngresos').textContent = `$${totalIngresos.toFixed(2)}`;
    let detalleIngresos = '<ul style="margin:0; padding-left:18px;">';
    (datosDelDia.transacciones||[]).filter(t=>t.metodoPago==='ingreso').forEach(t => {
        detalleIngresos += `<li>$${t.total.toFixed(2)} - ${t.concepto||''}</li>`;
    });
    detalleIngresos += '</ul>';
    document.getElementById('reporteDetalleIngresos').innerHTML = detalleIngresos;

    // Saldo en caja
    const saldoCaja = datosDelDia.ventasEfectivo - totalRetiros + totalIngresos;
    document.getElementById('reporteSaldoCaja').textContent = `$${saldoCaja.toFixed(2)}`;
}

function abrirModalProductos() {
    renderizarCategoriasSelect();
    renderizarListaProductos();
    document.getElementById('modalProductos').classList.remove('hidden');
}

function cerrarModalProductos() {
    document.getElementById('modalProductos').classList.add('hidden');
}

function renderizarCategoriasSelect() {
    const select = document.getElementById('productoCategoriaSelect');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(store.categorias).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = store.categoriasInfo[key]?.nombre || key;
        select.appendChild(opt);
    });
}

function renderizarListaProductos() {
    const lista = document.getElementById('productosLista');
    if (!lista) return;
    lista.innerHTML = '';

    Object.keys(store.categorias).forEach(catKey => {
        const catHeader = document.createElement('div');
        catHeader.style.display = 'flex';
        catHeader.style.justifyContent = 'space-between';
        catHeader.style.alignItems = 'center';
        catHeader.style.padding = '10px 0 5px 0';
        catHeader.innerHTML = `
            <h4 style="margin:0">${store.categoriasInfo[catKey]?.nombre || catKey}</h4>
            <div style="display:flex; gap:5px">
                <button class="win-btn" style="padding:2px 5px" onclick="abrirPromptSubcategoria('${catKey}')">+ Subcat</button>
                <button class="win-btn" style="padding:2px 5px" onclick="eliminarCategoria('${catKey}')">Eliminar Cat</button>
            </div>
        `;
        lista.appendChild(catHeader);

        store.categorias[catKey].forEach((p, index) => {
            const item = document.createElement('div');
            item.className = 'win-inset';
            item.style.padding = '8px';
            item.style.marginBottom = '5px';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            if (p.esSubcategoria) {
                item.style.background = '#eee';
                item.style.fontWeight = 'bold';
            }
            item.innerHTML = `
                <span>${p.esSubcategoria ? '📁 ' : ''}${p.nombre} ${p.precio ? `- $${p.precio.toFixed(2)}` : ''}</span>
                <div style="display:flex; gap:5px">
                    <button class="win-btn" style="padding:2px 5px" onclick="moverProducto('${catKey}', ${index}, -1)">↑</button>
                    <button class="win-btn" style="padding:2px 5px" onclick="moverProducto('${catKey}', ${index}, 1)">↓</button>
                    <button class="win-btn" style="padding:2px 5px" onclick="eliminarProducto('${catKey}', ${p.id})">Borrar</button>
                </div>
            `;
            lista.appendChild(item);
        });
    });
}

function abrirPromptSubcategoria(catKey) {
    const nombre = prompt('Nombre de la subcategoría:');
    if (nombre && nombre.trim()) {
        const subcat = {
            id: Date.now(),
            nombre: nombre.trim(),
            esSubcategoria: true
        };
        store.categorias[catKey].push(subcat);
        guardarDatosLocalStorage();
        renderizarListaProductos();
        renderizarProductos();
        mostrarNotificacion('Subcategoría añadida');
    }
}

function guardarCategoria() {
    const nombre = document.getElementById('categoriaNombre').value.trim();
    if (!nombre) return mostrarNotificacion('Nombre inválido', 'error');

    const key = nombre.toLowerCase().replace(/\s+/g, '_');
    if (store.categorias[key]) return mostrarNotificacion('La categoría ya existe', 'error');

    store.categorias[key] = [];
    store.categoriasInfo[key] = { nombre: nombre };

    document.getElementById('categoriaNombre').value = '';
    guardarDatosLocalStorage();
    renderizarCategoriasSelect();
    renderizarListaProductos();
    renderizarProductos();
    mostrarNotificacion('Categoría añadida');
}

function eliminarCategoria(key) {
    if (confirm(`¿Eliminar la categoría "${store.categoriasInfo[key]?.nombre || key}" y todos sus productos?`)) {
        delete store.categorias[key];
        delete store.categoriasInfo[key];
        guardarDatosLocalStorage();
        renderizarCategoriasSelect();
        renderizarListaProductos();
        renderizarProductos();
        mostrarNotificacion('Categoría eliminada');
    }
}

function moverProducto(catKey, index, direction) {
    const list = store.categorias[catKey];
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[newIdx];
    list[newIdx] = temp;

    guardarDatosLocalStorage();
    renderizarListaProductos();
    renderizarProductos();
}

function guardarProducto() {
    const nombre = document.getElementById('productoNombre').value.trim();
    const precio = parseFloat(document.getElementById('productoPrecio').value);
    const categoria = document.getElementById('productoCategoriaSelect').value;

    if (!nombre || isNaN(precio) || !categoria) {
        mostrarNotificacion('Datos inválidos', 'error');
        return;
    }

    const newId = Date.now();
    const prod = { id: newId, nombre, precio, categoria };
    if (!store.categorias[categoria]) store.categorias[categoria] = []; // Should not happen if select is populated
    store.categorias[categoria].push(prod);

    document.getElementById('productoNombre').value = '';
    document.getElementById('productoPrecio').value = '';

    guardarDatosLocalStorage();
    renderizarProductos();
    renderizarListaProductos();
    mostrarNotificacion('Producto guardado');
}

function eliminarProducto(catKey, id) {
    store.categorias[catKey] = store.categorias[catKey].filter(p => p.id !== id);
    guardarDatosLocalStorage();
    renderizarProductos();
    renderizarListaProductos();
    mostrarNotificacion('Producto eliminado');
}

// --- REPORT PDF (Simplified for merge) ---
function descargarReporte() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        mostrarNotificacion('Librería PDF no cargada', 'error');
        return;
    }
    const doc = new jsPDF();
    let y = 10;
    doc.setFontSize(16);
    doc.text('REPORTE DE VENTAS', 10, y);
    y += 8;
    doc.setFontSize(11);
    doc.text(`Fecha: ${store.fechaReporteVisualizando.toLocaleDateString('es-MX')}`, 10, y);
    y += 8;

    // Obtener datos del día
    const fechaStr = store.fechaReporteVisualizando.toDateString();
    const historico = JSON.parse(localStorage.getItem('panaderiaHistorico') || '{}');
    const datosDelDia = historico[fechaStr] || { ventasTotales: 0, ventasEfectivo: 0, ventasTarjeta: 0, numTransacciones: 0, retiros: [], transacciones: [] };

    // Métricas principales
    const ticketPromedio = datosDelDia.numTransacciones > 0 ? (datosDelDia.ventasTotales / datosDelDia.numTransacciones) : 0;
    let productosVendidos = 0;
    const productosContador = {};
    let primeraVenta = null;
    let ultimaVenta = null;
    const ventasPorHora = Array(24).fill(0);
    (datosDelDia.transacciones || []).forEach(t => {
        if (t.metodoPago === 'ingreso') return;
        const fechaVenta = new Date(t.fecha);
        if (!primeraVenta || fechaVenta < primeraVenta) primeraVenta = fechaVenta;
        if (!ultimaVenta || fechaVenta > ultimaVenta) ultimaVenta = fechaVenta;
        const hora = fechaVenta.getHours();
        ventasPorHora[hora] += t.total;
        (t.items || []).forEach(item => {
            productosVendidos += item.cantidad || 1;
            if (!productosContador[item.nombre]) productosContador[item.nombre] = 0;
            productosContador[item.nombre] += item.cantidad || 1;
        });
    });
    const topProductos = Object.entries(productosContador).sort((a,b)=>b[1]-a[1]);
    const totalEfectivo = datosDelDia.ventasEfectivo || 0;
    const totalTarjeta = datosDelDia.ventasTarjeta || 0;
    const totalVentas = totalEfectivo + totalTarjeta;
    const pctEfectivo = totalVentas > 0 ? (totalEfectivo/totalVentas*100).toFixed(0) : 0;
    const pctTarjeta = totalVentas > 0 ? (totalTarjeta/totalVentas*100).toFixed(0) : 0;
    const totalRetiros = (datosDelDia.retiros||[]).reduce((sum, r) => sum + r.monto, 0);
    const totalIngresos = (datosDelDia.transacciones||[]).filter(t => t.metodoPago === 'ingreso').reduce((sum, t) => sum + t.total, 0);
    const saldoCaja = datosDelDia.ventasEfectivo - totalRetiros + totalIngresos;

    // Imprimir métricas
    doc.setFontSize(11);
    const lines = [
        `Ventas Totales: $${datosDelDia.ventasTotales.toFixed(2)}`,
        `- Efectivo: $${datosDelDia.ventasEfectivo.toFixed(2)}`,
        `- Tarjeta: $${datosDelDia.ventasTarjeta.toFixed(2)}`,
        `Transacciones: ${datosDelDia.numTransacciones}`,
        `Ticket Promedio: $${ticketPromedio.toFixed(2)}`,
        `Productos Vendidos: ${productosVendidos}`,
        `Producto Más Vendido: ${topProductos[0] ? `${topProductos[0][0]} (${topProductos[0][1]})` : '-'}`,
        `Top 3 Productos: ${topProductos.slice(0,3).map(p=>`${p[0]} (${p[1]})`).join(', ') || '-'}`,
        `% Efectivo / Tarjeta: ${pctEfectivo}% / ${pctTarjeta}%`,
        `Primera Venta: ${primeraVenta ? primeraVenta.toLocaleTimeString('es-MX') : '-'}`,
        `Última Venta: ${ultimaVenta ? ultimaVenta.toLocaleTimeString('es-MX') : '-'}`,
        `Ingresos Extra: $${totalIngresos.toFixed(2)}`,
        `Retiros: $${totalRetiros.toFixed(2)}`,
        `Saldo en Caja: $${saldoCaja.toFixed(2)}`
    ];
    lines.forEach(line => { doc.text(line, 10, y); y += 7; });

    // Ventas por hora
    y += 2;
    doc.setFontSize(12);
    doc.text('Ventas por Hora:', 10, y); y += 6;
    doc.setFontSize(10);
    let ventasHoraStr = ventasPorHora.map((v, h) => v > 0 ? `${h}: $${v.toFixed(2)}` : null).filter(Boolean).join(' | ');
    if (!ventasHoraStr) ventasHoraStr = 'Sin ventas registradas';
    doc.text(ventasHoraStr, 10, y); y += 8;

    // Detalle de retiros
    doc.setFontSize(12);
    doc.text('Detalle de Retiros:', 10, y); y += 6;
    doc.setFontSize(10);
    if ((datosDelDia.retiros||[]).length === 0) {
        doc.text('Sin retiros.', 10, y); y += 6;
    } else {
        (datosDelDia.retiros||[]).forEach(r => {
            doc.text(`$${r.monto.toFixed(2)} - ${r.justificacion||''}`, 12, y); y += 6;
        });
    }

    // Detalle de ingresos
    doc.setFontSize(12);
    doc.text('Detalle de Ingresos:', 10, y); y += 6;
    doc.setFontSize(10);
    const ingresos = (datosDelDia.transacciones||[]).filter(t=>t.metodoPago==='ingreso');
    if (ingresos.length === 0) {
        doc.text('Sin ingresos.', 10, y); y += 6;
    } else {
        ingresos.forEach(t => {
            doc.text(`$${t.total.toFixed(2)} - ${t.concepto||''}`, 12, y); y += 6;
        });
    }

    doc.save(`Reporte_TPV_${Date.now()}.pdf`);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosLocalStorage();
    renderizarProductos();
    renderizarBilletesYMonedas();
    actualizarVistaCarrito();

    // Update main date
    const fechaEl = document.getElementById('fecha');
    if (fechaEl) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        fechaEl.textContent = new Date().toLocaleDateString('es-ES', opciones);
    }
});
