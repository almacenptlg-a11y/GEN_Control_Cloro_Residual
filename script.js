import * as THREE from "https://unpkg.com/three@0.160.1/build/three.module.js";

/* ================================================================
   0. CONFIGURACIÓN GLOBAL Y ESTADO (Hub GenApps)
   ================================================================ */
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbzTsnqzu-i5fmznYdJMJqGHkCaPUWsuCWbIni0x4BeunvIGdl2mq419TdhtZaJI3x6v/exec";

// 1. Estado Centralizado de la Aplicación
const AppState = {
  user: null,
  isSessionVerified: false
};

// ⚠️ CORRECCIÓN CLAVE: Las matrices de datos deben ser globales para que las funciones de edición (fuera del DOMContentLoaded) puedan leerlas.
let historialGlobal = [];
let registrosFiltrados = []; 
const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// --- FUNCIÓN DE BLINDAJE DE ACCESO ---
function verificarAcceso(user) {
  if (!user) return false;
  const rolesPermitidos = ['JEFE', 'GERENTE', 'ADMINISTRADOR'];
  const userRol = (user.rol || '').toUpperCase();
  const userArea = (user.area || '').toUpperCase();
  
  return rolesPermitidos.includes(userRol) || userArea === 'CALIDAD';
}

function bloquearInterfaz() {
  Swal.fire({
    icon: "error",
    title: "Acceso Restringido",
    text: "Este módulo es exclusivo para el área de Calidad, Jefaturas y Gerencia.",
    background: "rgba(255, 255, 255, 0.95)",
    backdrop: "rgba(0,10,30,0.9)",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false
  });
  
  const appContainer = document.querySelector(".relative.z-10.flex.flex-col");
  if (appContainer) appContainer.style.display = "none";
}

// Seguridad y Comunicación con el Padre (Hub)
window.addEventListener('message', (event) => {
  const { type, user, theme } = event.data || {};
  
  if (type === 'THEME_UPDATE') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }

  if (type === 'SESSION_SYNC' && user) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    if (!verificarAcceso(user)) {
      bloquearInterfaz();
      return; 
    }
    
    AppState.user = user;
    AppState.isSessionVerified = true;
    sessionStorage.setItem('moduloCloroUser', JSON.stringify(user));
    
    const btn = document.getElementById("submitBtn");
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-50", "cursor-not-allowed", "bg-gray-500");
      btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span class="drop-shadow-sm">Registrar en Base de Datos</span><svg id="spinner" class="animate-spin h-5 w-5 text-white hidden absolute right-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    }
  }
});

/* ================================================================
   1. LÓGICA DE NEGOCIO Y FRONTEND (HACCP & FETCH)
   ================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  
  const savedUser = sessionStorage.getItem('moduloCloroUser');
  if (savedUser) {
    const userParseado = JSON.parse(savedUser);
    if (verificarAcceso(userParseado)) {
      AppState.user = userParseado;
      AppState.isSessionVerified = true;
    } else {
      sessionStorage.removeItem('moduloCloroUser');
      bloquearInterfaz();
    }
  }
  
  window.parent.postMessage({ type: 'MODULO_LISTO' }, '*');
  
  setTimeout(() => {
    if (!AppState.isSessionVerified) {
      const btn = document.getElementById("submitBtn");
      if(btn) {
        btn.disabled = true;
        btn.classList.add("opacity-50", "cursor-not-allowed", "bg-gray-500");
        btn.innerHTML = `<svg class="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg> Esperando autorización...`;
      }
    }
  }, 4000);

  // Lógica Tabs
  const btnTabRegistro = document.getElementById("btnTabRegistro");
  const btnTabHistorial = document.getElementById("btnTabHistorial");
  const tabRegistro = document.getElementById("tabRegistro");
  const tabHistorial = document.getElementById("tabHistorial");

  const classBtnActive = "px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-bold shadow-md transition-all border border-blue-400/50 w-32 text-center";
  const classBtnInactive = "px-6 py-2.5 rounded-full bg-transparent text-white/80 hover:text-white text-sm font-bold transition-all w-32 text-center";

  btnTabRegistro.addEventListener("click", () => {
    tabHistorial.classList.add("hidden");
    tabRegistro.classList.remove("hidden");
    btnTabRegistro.className = classBtnActive;
    btnTabHistorial.className = classBtnInactive;
  });

  btnTabHistorial.addEventListener("click", () => {
    tabRegistro.classList.add("hidden");
    tabHistorial.classList.remove("hidden");
    btnTabHistorial.className = classBtnActive;
    btnTabRegistro.className = classBtnInactive;
    cargarHistorial(); 
  });

  // Configuración Formulario
  document.getElementById("fecha").valueAsDate = new Date();
  const now = new Date();
  document.getElementById("hora").value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const toggleBtn = document.getElementById("toggleAccionesBtn");
  const toggleTrack = document.getElementById("toggleTrack");
  const toggleKnob = document.getElementById("toggleKnob");
  const accionesContainer = document.getElementById("accionesContainer");

  const dosificacionInput = document.getElementById("dosificacion");
  const medidasInput = document.getElementById("medidas");
  const observacionesInput = document.getElementById("observaciones");
  let isAccionesActive = false;

  toggleBtn.addEventListener("click", () => {
    isAccionesActive = !isAccionesActive;
    if (isAccionesActive) {
      toggleTrack.classList.replace("bg-slate-300/60", "bg-blue-500");
      toggleKnob.classList.add("translate-x-5");
      accionesContainer.classList.remove("hidden");
      setTimeout(() => dosificacionInput.focus(), 100);
    } else {
      toggleTrack.classList.replace("bg-blue-500", "bg-slate-300/60");
      toggleKnob.classList.remove("translate-x-5");
      accionesContainer.classList.add("hidden");
      dosificacionInput.value = "";
      medidasInput.value = "";
      observacionesInput.value = "";
    }
  });

  const validateInput = (id, min, max, alertId) => {
    const input = document.getElementById(id);
    const alert = document.getElementById(alertId);
    input.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      let isInvalid = max === null ? val >= min : val < min || val > max;
      if (isInvalid) {
        input.classList.add("text-red-600");
        alert.classList.remove("hidden");
      } else {
        input.classList.remove("text-red-600");
        alert.classList.add("hidden");
      }
    });
  };

  validateInput("cloro", 0.2, 2.0, "cloroAlert");
  validateInput("ph", 5.5, 7.5, "phAlert");
  validateInput("temperatura", 26, null, "tempAlert");

  // Intercepción Enter
  const form = document.getElementById("cloroForm");
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      const flujoBase = ['fecha', 'hora', 'puntoControl', 'cloro', 'ph', 'temperatura'];
      const flujoAnomalias = ['dosificacion', 'observaciones', 'medidas'];
      let flujoActivo = [...flujoBase];
      if (isAccionesActive) flujoActivo = flujoActivo.concat(flujoAnomalias);
      const currentId = e.target.id;
      const currentIndex = flujoActivo.indexOf(currentId);
      if (currentIndex > -1 && currentIndex < flujoActivo.length - 1) {
        const nextInput = document.getElementById(flujoActivo[currentIndex + 1]);
        if (nextInput) nextInput.focus();
      } else if (currentIndex === flujoActivo.length - 1) {
        e.target.blur(); 
      }
    }
  });

  // Submit
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if(!AppState.isSessionVerified || !AppState.user) {
      return Swal.fire({
        icon: "error", title: "Acceso Denegado", text: "No se ha validado una sesión activa desde el Hub.",
        background: "rgba(255, 255, 255, 0.95)", confirmButtonColor: "#dc2626"
      });
    }

    const payload = {
      action: 'create',
      fecha: document.getElementById("fecha").value,
      hora: document.getElementById("hora").value,
      puntoControl: document.getElementById("puntoControl").value,
      cloro: parseFloat(document.getElementById("cloro").value),
      ph: parseFloat(document.getElementById("ph").value),
      temperatura: parseFloat(document.getElementById("temperatura").value),
      dosificacion: isAccionesActive && dosificacionInput.value ? parseFloat(dosificacionInput.value) : "",
      observaciones: isAccionesActive ? observacionesInput.value : "",
      medidasCorrectivas: isAccionesActive ? medidasInput.value : "",
      usuario: AppState.user.nombre
    };

    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75", "cursor-not-allowed");
    const currentSpinner = submitBtn.querySelector("#spinner");
    if(currentSpinner) currentSpinner.classList.remove("hidden");

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST", mode: "cors", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) throw new Error("Google devolvió HTML. Verifica el despliegue en GAS.");
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const result = await response.json();
      if (result.status === "success") {
        Swal.fire({
          icon: result.data.alarma ? "warning" : "success",
          title: result.data.alarma ? "Registro con Alerta" : "Guardado Exitoso",
          text: result.data.alarma ? "Parámetros fuera de límite. Registrado en base de datos." : "Los parámetros han sido registrados correctamente.",
          background: "rgba(255, 255, 255, 0.95)", confirmButtonColor: "#2563eb"
        });
        
        form.reset();
        const camposAlertas = { "cloro": "cloroAlert", "ph": "phAlert", "temperatura": "tempAlert" };
        Object.entries(camposAlertas).forEach(([inputId, alertId]) => {
            const inputEl = document.getElementById(inputId);
            const alertEl = document.getElementById(alertId);
            if (inputEl) inputEl.classList.remove("text-red-600");
            if (alertEl) alertEl.classList.add("hidden");
        });

        document.getElementById("fecha").valueAsDate = new Date();
        const resetNow = new Date();
        document.getElementById("hora").value = `${String(resetNow.getHours()).padStart(2, "0")}:${String(resetNow.getMinutes()).padStart(2, "0")}`;

        cargarHistorial();
      } else {
        throw new Error(result.message);
      }
      if (isAccionesActive) toggleBtn.click();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Fallo de Conexión", text: `Error: ${error.message}`, background: "rgba(255, 255, 255, 0.95)", confirmButtonColor: "#dc2626" });
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75", "cursor-not-allowed");
      const endSpinner = submitBtn.querySelector("#spinner");
      if(endSpinner) endSpinner.classList.add("hidden");
    }
  });

  // ==============================================================
  // MOTOR DE HISTORIAL (LEER DATOS)
  // ==============================================================
  const filterMes = document.getElementById("filterMes");
  const filterFecha = document.getElementById("filterFecha");
  const filterPunto = document.getElementById("filterPunto");
  const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
  const btnImprimirReporte = document.getElementById("btnImprimirReporte"); 
  const btnDescargarPDF = document.getElementById('btnDescargarPDF');
  const historialGrid = document.getElementById("historialGrid");
  const btnActualizar = document.getElementById("btnActualizarHistorial");

  const cargarHistorial = async (forzarRefresh = false) => {
    historialGrid.innerHTML = '<div class="text-center py-10 text-white/70 font-medium animate-pulse">Consultando Base de Datos...</div>';
    try {
      const fetchUrl = forzarRefresh ? `${BACKEND_URL}?refresh=true` : BACKEND_URL;
      const response = await fetch(fetchUrl, { method: "GET", mode: "cors", redirect: "follow" });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) throw new Error("El servidor devolvió HTML.");
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const result = await response.json();
      if (result.status === "success") {
        historialGlobal = result.data;
        if (historialGlobal.length === 0) {
          historialGrid.innerHTML = '<div class="text-center py-10 text-white/70 font-medium">No hay registros en la base de datos.</div>';
          if(btnImprimirReporte) btnImprimirReporte.classList.add("hidden");
          if(btnDescargarPDF) btnDescargarPDF.classList.add("hidden");
          return;
        }
        extraerMesesDinamicos(historialGlobal);
        renderizarHistorial();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      historialGrid.innerHTML = `<div class="text-center p-6 text-red-300 font-bold bg-red-900/40 rounded-2xl border border-red-500/50 backdrop-blur-md"><p class="mb-2">⚠️ Error de Conexión</p><p class="text-xs font-normal">${error.message}</p></div>`;
    }
  };

  const extraerMesesDinamicos = (data) => {
    const mesesUnicos = [...new Set(data.map((item) => (item.fecha ? item.fecha.substring(0, 7) : null)).filter(Boolean))].sort().reverse();
    filterMes.innerHTML = '<option value="ALL" class="text-slate-800">Todos los Meses</option>';
    mesesUnicos.forEach((mesVal) => {
      const [year, month] = mesVal.split("-");
      const nombreMes = mesesNombres[parseInt(month) - 1];
      filterMes.innerHTML += `<option value="${mesVal}" class="text-slate-800">${nombreMes} ${year}</option>`;
    });
  };

  const renderizarHistorial = () => {
    const mes = filterMes.value;
    const fechaExacta = filterFecha.value;
    const punto = filterPunto.value;

    if (mes !== "ALL" || fechaExacta !== "" || punto !== "ALL") {
      if(btnLimpiarFiltros) btnLimpiarFiltros.classList.remove("hidden");
    } else {
      if(btnLimpiarFiltros) btnLimpiarFiltros.classList.add("hidden");
    }

    registrosFiltrados = historialGlobal.filter((item) => {
      let matchFecha = true;
      if (fechaExacta) matchFecha = item.fecha === fechaExacta;
      else if (mes !== "ALL") matchFecha = item.fecha && item.fecha.startsWith(mes);
      const matchPunto = punto === "ALL" || item.punto === punto;
      return matchFecha && matchPunto;
    });

    if (registrosFiltrados.length === 0) {
      historialGrid.innerHTML = '<div class="text-center py-10 text-white/70 font-medium">No hay registros para los filtros seleccionados.</div>';
      if(btnImprimirReporte) btnImprimirReporte.classList.add("hidden");
      if(btnDescargarPDF) btnDescargarPDF.classList.add("hidden");
      return;
    }

    if(btnImprimirReporte) btnImprimirReporte.classList.remove("hidden");
    if(btnDescargarPDF) btnDescargarPDF.classList.remove("hidden");

    let htmlContent = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">';
    
    const nombresPuntos = {
      "P1": "P1 - Mantenimiento",
      "P2": "P2 - Hielera",
      "P3": "P3 - Enfriamiento",
      "P4": "P4 - Pelado",
      "P5": "P5 - Desposte"
    };

    registrosFiltrados.forEach((item) => {
      const isAlerta = item.alarma === true || item.alarma === "TRUE" || item.alarma === true;
      const badgeClass = isAlerta ? "bg-red-500/80 text-white" : "bg-green-500/80 text-white";

      const nombrePuntoExtendido = nombresPuntos[item.punto] || item.punto;
      let usuarioCrudo = item.usuario || 'OPERARIO';
      if (usuarioCrudo.includes('@')) usuarioCrudo = usuarioCrudo.split('@')[0].replace('.', ' '); 
      const usuarioNombreCompleto = usuarioCrudo.toUpperCase();

      htmlContent += `
        <div class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border ${isAlerta ? "border-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-white/40"} text-slate-800 transition-transform hover:-translate-y-1">
          <div class="flex justify-between items-start mb-2 border-b border-slate-300/50 pb-2">
            <div>
              <span class="text-[10px] font-black uppercase text-blue-900 bg-blue-100/50 px-2 py-0.5 rounded-md">${item.id}</span>
              <span class="text-xs font-bold ml-1">${item.fecha} - ${item.hora}</span>
            </div>
            <div class="flex items-center gap-2">
               <button onclick="editarRegistro('${item.id}')" class="text-slate-500 hover:text-blue-600 transition-colors" title="Editar Registro"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
               <button onclick="eliminarRegistro('${item.id}')" class="text-slate-500 hover:text-red-600 transition-colors" title="Eliminar Registro"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
               <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ml-1 ${badgeClass}">${isAlerta ? "Alerta" : "Normal"}</span>
            </div>
          </div>
          
          <div class="flex justify-between items-center mb-3 mt-1">
            <span class="font-extrabold text-blue-900 flex items-center gap-1 text-[11px] md:text-xs tracking-tight">📍 ${nombrePuntoExtendido}</span>
            <span class="text-[9px] font-bold text-slate-600 bg-white/50 border border-slate-300/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              ${usuarioNombreCompleto} 
            </span>
          </div>

         <div class="grid grid-cols-3 gap-2 text-center bg-white/50 rounded-xl p-2 mb-2 shadow-inner">
            <div><p class="text-[9px] font-bold uppercase text-slate-500">Cloro</p><p class="font-black ${item.cloro < 0.2 || item.cloro > 2.0 ? "text-red-600" : ""}">${item.cloro}</p></div>
            <div><p class="text-[9px] font-bold uppercase text-slate-500">pH</p><p class="font-black ${item.ph < 5.5 || item.ph > 7.5 ? "text-red-600" : ""}">${item.ph}</p></div>
            <div><p class="text-[9px] font-bold uppercase text-slate-500">Temp</p><p class="font-black ${item.temp >= 26.0 ? "text-red-600" : ""}">${item.temp}°</p></div>
          </div>
          
          ${item.dosificacion || item.observaciones || item.medidas ? `
            <div class="bg-blue-50/50 rounded-xl p-2 text-xs border border-blue-200/50">
              ${item.dosificacion ? `<p><strong class="text-blue-900">Dosificación:</strong> ${item.dosificacion} L</p>` : ""}
              ${item.medidas ? `<p><strong class="text-blue-900">Acción:</strong> ${item.medidas}</p>` : ""}
              ${item.observaciones ? `<p><strong class="text-blue-900">Obs:</strong> ${item.observaciones}</p>` : ""}
            </div>
          ` : ""}
        </div>`;
    });
    htmlContent += "</div>";
    historialGrid.innerHTML = htmlContent;
  };

  const generarHTMLReporte = (isForPDF = false) => {
    const mesVal = filterMes.value;
    const fechaVal = filterFecha.value;
    let etiquetaTemporal = "REGISTRO HISTÓRICO";
    
    if (fechaVal) etiquetaTemporal = `FECHA: ${fechaVal.split('-').reverse().join('/')}`;
    else if (mesVal !== 'ALL') {
      const [y, m] = mesVal.split('-');
      etiquetaTemporal = `MES: ${mesesNombres[parseInt(m)-1].toUpperCase()} ${y}`;
    }

    const registrosAImprimir = [...registrosFiltrados].sort((a, b) => {
      const formatTime = (t) => {
        if (!t) return "00:00:00";
        const p = t.toString().split(':');
        const h = (p[0] || "00").padStart(2, '0');
        const m = (p[1] || "00").padStart(2, '0');
        const s = (p[2] || "00").padStart(2, '0');
        return `${h}:${m}:${s}`;
      };
      const dateTimeA = `${a.fecha || "1970-01-01"}T${formatTime(a.hora)}`;
      const dateTimeB = `${b.fecha || "1970-01-01"}T${formatTime(b.hora)}`;
      if (dateTimeA < dateTimeB) return -1;
      if (dateTimeA > dateTimeB) return 1;
      return 0;
    });

    const FILAS_POR_PAGINA = 28; 
    const totalPaginas = Math.ceil(registrosAImprimir.length / FILAS_POR_PAGINA) || 1;
    let paginasHTML = '';

    for (let i = 0; i < totalPaginas; i++) {
      const chunk = registrosAImprimir.slice(i * FILAS_POR_PAGINA, (i + 1) * FILAS_POR_PAGINA);
      let filasHTML = '';

      chunk.forEach(r => {
        const cantidadStr = String(r.dosificacion).trim();
        const tieneDosificacion = cantidadStr !== "" && cantidadStr !== "0" && parseFloat(cantidadStr) > 0;
        const siHtml = tieneDosificacion ? 'X' : '';
        const noHtml = !tieneDosificacion ? 'X' : '';
        
        const cantHtml = tieneDosificacion ? r.dosificacion : ''; 
        const cloroHtml = r.cloro; 
        
        let usuarioCrudo = r.usuario || 'OPERARIO';
        if (usuarioCrudo.includes('@')) usuarioCrudo = usuarioCrudo.split('@')[0].replace('.', ' ');
        const monitoreador = usuarioCrudo.toUpperCase();
        
        const fParts = r.fecha.split('-');
        const fechaLimpia = fParts.length === 3 ? `${fParts[2]}/${fParts[1]}/${fParts[0]}` : r.fecha;

        filasHTML += `
          <tr>
            <td>${fechaLimpia}</td>
            <td>${r.hora}</td>
            <td class="col-strong">${r.punto}</td>
            <td>${r.ph}</td>
            <td>${r.temp}</td>
            <td class="col-strong">${cloroHtml}</td>
            <td class="col-strong" style="color: #166534;">${siHtml}</td>
            <td class="col-strong" style="color: #b91c1c;">${noHtml}</td>
            <td class="col-strong">${cantHtml}</td>
            <td style="font-size: 7.5px; font-weight: bold;">${monitoreador}</td>
            <td class="col-obs">${r.observaciones || ''}</td>
            <td class="col-obs">${r.medidas || ''}</td>
          </tr>
        `;
      });

      paginasHTML += `
        <div class="page-container" ${i < totalPaginas - 1 ? 'style="page-break-after: always;"' : ''}>
            <div class="header-grid">
                <div class="logo-box"><div class="logo-text">LA<br>GENOVESA</div><div class="logo-sub">DESDE 1977</div></div>
                <div class="title-box">
                    <div class="title-main">PROGRAMA DE LIMPIEZA Y DESINFECCIÓN</div>
                    <div class="title-secondary">REGISTRO DE CONTROL DE CLORO RESIDUAL</div>
                    <table class="meta-table">
                        <tr><td><span class="meta-bold">Versión:</span> 4</td><td><span class="meta-bold">Fecha:</span> 08/2025</td><td><span class="meta-bold">Página:</span> ${i + 1} de ${totalPaginas}</td><td><span class="meta-bold">Código:</span> LGA-LYD-SAF6</td></tr>
                        <tr><td colspan="2"><span class="meta-bold">Elaborado:</span> Aseg. Calidad</td><td><span class="meta-bold">Revisado:</span> Sub Gerente</td><td><span class="meta-bold">Aprobado:</span> Gerente Gral.</td></tr>
                    </table>
                </div>
            </div>
            <div class="info-section">
                <div><span class="info-label">${etiquetaTemporal}</span></div>
                <div><span class="info-label">FRECUENCIA:</span> <span class="info-value">DIARIA</span></div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th colspan="3">MONITOREO</th>
                        <th colspan="3">DATOS</th>
                        <th colspan="3">DOSIFICACIÓN</th>
                        <th rowspan="2" style="width: 12%;">USER</th>
                        <th rowspan="2" style="width: 14%;">OBSERVACIONES</th>
                        <th rowspan="2" style="width: 14%;">ACCIÓN CORRECTIVA</th>
                    </tr>
                    <tr>
                        <th style="width: 7%;">FECHA</th><th style="width: 7%;">HORA</th><th style="width: 6%;">PTO</th>
                        <th style="width: 6%;">pH</th><th style="width: 6%;">T(°C)</th><th style="width: 7%;">CLR</th>
                        <th style="width: 4%;">SÍ</th><th style="width: 4%;">NO</th><th style="width: 5%;">L.</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasHTML}
                </tbody>
            </table>

               <div class="footer-grid">
                <div class="legend-box">
                    <div class="leyenda-title">LEYENDA Y RANGOS NORMATIVOS</div>
                    <p><strong>P1:</strong> DESPOSTE | <strong>P2:</strong> HIELERA | <strong>P3:</strong> ENFRIAMIENTO | <strong>P4:</strong> PELADO | <strong>P5:</strong> MANTENIMIENTO</p>
                    <p style="margin-top: 4px;">CLR = 0.20 - 2.00 ppm es <span class="conforme">✓ CONFORME</span> | CLR < 0.20 o > 2.00 ppm es <span class="no-conforme">✗ NO CONFORME</span></p>
                    <p style="margin-top: 4px;"><strong>pH:</strong> 5.5 - 7.5 | <strong>Temp. Max:</strong> 26.0 °C</p>
                </div>       
                <div class="firma-box">
                    <div class="linea-firma">JEFE DE ASEGURAMIENTO DE CALIDAD</div>
                </div>
            </div>
        </div>
      `;
    }

    const cssContent = `
      :root { --brand-red: #c62828; --border-dark: #000; --border-light: #666; --header-bg: #e5e7eb; --text-main: #000; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', -apple-system, sans-serif; font-size: 8.5px; color: var(--text-main); background: #fff; line-height: 1.2; }
      .pdf-master-container { width: 190mm; margin: 0 auto; background: #fff; }
      .page-container { padding: ${isForPDF ? '0' : '10mm'}; min-height: ${isForPDF ? '277mm' : '100vh'}; display: flex; flex-direction: column; box-sizing: border-box; }
      .header-grid { display: grid; grid-template-columns: 100px 1fr; border: 2px solid var(--border-dark); margin-bottom: 10px; }
      .logo-box { border-right: 2px solid var(--border-dark); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px; }
      .logo-text { color: var(--brand-red); font-weight: 900; font-size: 14px; text-align: center; }
      .logo-sub { font-size: 6px; font-weight: 600; color: #555; margin-top: 2px; }
      .title-box { display: flex; flex-direction: column; }
      .title-main { text-align: center; font-weight: 800; font-size: 12px; border-bottom: 1px solid var(--border-dark); padding: 5px; }
      .title-secondary { text-align: center; font-weight: 700; font-size: 10px; padding: 5px; background-color: var(--header-bg); border-bottom: 2px solid var(--border-dark); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .meta-table { width: 100%; border-collapse: collapse; font-size: 8px; }
      .meta-table td { border-right: 1px solid var(--border-light); border-bottom: 1px solid var(--border-light); padding: 3px 5px; }
      .meta-table tr:last-child td { border-bottom: none; }
      .meta-table td:last-child { border-right: none; }
      .meta-bold { font-weight: 800; }
      .info-section { display: flex; gap: 60px; margin: 10px 0; font-size: 10px; }
      .info-label { font-weight: 800; }
      .data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; border: 2px solid var(--border-dark); table-layout: fixed; }
      .data-table th, .data-table td { border: 1px solid var(--border-dark); padding: 3px 2px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .data-table th { background-color: var(--header-bg); font-weight: 800; font-size: 7.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .data-table tbody tr { height: 21px; }
      .data-table tbody tr:nth-child(even) { background-color: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .col-obs { text-align: left !important; padding-left: 4px !important; font-size: 7.5px; }
      .col-strong { font-weight: 800; }
      .footer-grid { display: grid; grid-template-columns: 1fr 200px; gap: 20px; margin-top: auto; font-size: 8.5px; }
      .legend-box { border: 1px solid var(--border-light); padding: 8px; border-radius: 4px; }
      .leyenda-title { font-weight: 800; text-decoration: underline; margin-bottom: 6px; }
      .conforme { color: #166534; font-weight: 800; }
      .no-conforme { color: #b91c1c; font-weight: 800; }
      .firma-box { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 5px; }
      .linea-firma { border-top: 1px solid var(--border-dark); width: 100%; text-align: center; padding-top: 4px; font-weight: 800; }
      @media print { @page { size: A4 portrait; margin: 10mm; } body { padding: 0; margin: 0; } }
    `;

    if (isForPDF) {
      return `<style>${cssContent}</style><div id="pdf-wrapper" class="pdf-master-container">${paginasHTML}</div>`;
    } else {
      return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte HACCP</title><style>${cssContent}</style></head><body>${paginasHTML}</body></html>`;
    }
  };

  if(btnImprimirReporte) {
    btnImprimirReporte.addEventListener("click", () => {
      if (registrosFiltrados.length === 0) return;
      const printWindow = window.open("", "_blank");
      printWindow.document.write(generarHTMLReporte(false));
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    });
  }

  if(btnDescargarPDF) {
    btnDescargarPDF.addEventListener("click", async () => {
      if (registrosFiltrados.length === 0) return;
      const originalText = btnDescargarPDF.innerHTML;
      btnDescargarPDF.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generando...`;
      btnDescargarPDF.disabled = true;

      let nombreArchivo = "HACCP_Cloro";
      const puntoVal = filterPunto.value;
      const mesVal = filterMes.value;
      const fechaVal = filterFecha.value;

      if (puntoVal !== "ALL") nombreArchivo += `_${puntoVal}`;
      if (fechaVal !== "") nombreArchivo += `_${fechaVal}`;
      else if (mesVal !== "ALL") { const [y, m] = mesVal.split("-"); nombreArchivo += `_${mesesNombres[parseInt(m) - 1]}_${y}`; } 
      else nombreArchivo += `_General`;
      nombreArchivo += ".pdf";

      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "0";
      tempDiv.innerHTML = generarHTMLReporte(true);
      document.body.appendChild(tempDiv);

      const elementToPrint = tempDiv.querySelector("#pdf-wrapper");
      const opt = { margin: [10, 10, 10, 10], filename: nombreArchivo, image: { type: "jpeg", quality: 1 }, html2canvas: { scale: 2, useCORS: true, letterRendering: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } };

      try { await html2pdf().set(opt).from(elementToPrint).save(); } 
      catch (err) { console.error("Error generando PDF", err); } 
      finally { document.body.removeChild(tempDiv); btnDescargarPDF.innerHTML = originalText; btnDescargarPDF.disabled = false; }
    });
  }

  if(filterMes) filterMes.addEventListener("change", () => { if (filterMes.value !== "ALL") filterFecha.value = ""; renderizarHistorial(); });
  if(filterFecha) filterFecha.addEventListener("change", () => { if (filterFecha.value !== "") filterMes.value = "ALL"; renderizarHistorial(); });
  if(filterPunto) filterPunto.addEventListener("change", renderizarHistorial);
  if(btnLimpiarFiltros) btnLimpiarFiltros.addEventListener("click", () => { filterMes.value = "ALL"; filterFecha.value = ""; filterPunto.value = "ALL"; renderizarHistorial(); });
  if(btnActualizar) btnActualizar.addEventListener("click", () => { cargarHistorial(true); });

  cargarHistorial();
});

// ==============================================================
// 3. CONTROLADORES CRUD (EDICIÓN Y ELIMINACIÓN)
// ==============================================================
window.editarRegistro = (id) => {
  const reg = historialGlobal.find(r => r.id === id);
  if (!reg) return;

  Swal.fire({
    title: `<span class="text-blue-900 font-bold">Editar ${id}</span>`,
    html: `
      <div class="grid grid-cols-2 gap-4 text-left px-2">
          <div><label class="text-xs font-bold text-slate-500 uppercase">Cloro (ppm)</label>
          <input id="swal-cloro" type="number" step="0.01" value="${reg.cloro}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
          
          <div><label class="text-xs font-bold text-slate-500 uppercase">pH</label>
          <input id="swal-ph" type="number" step="0.1" value="${reg.ph}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
          
          <div><label class="text-xs font-bold text-slate-500 uppercase">Temp (°C)</label>
          <input id="swal-temp" type="number" step="0.1" value="${reg.temp}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
          
          <div><label class="text-xs font-bold text-slate-500 uppercase">Dosific. (L)</label>
          <input id="swal-dosif" type="number" step="0.01" value="${reg.dosificacion}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
          
          <div class="col-span-2"><label class="text-xs font-bold text-slate-500 uppercase">Acción Correctiva</label>
          <input id="swal-medidas" type="text" value="${reg.medidas || ''}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
          
          <div class="col-span-2"><label class="text-xs font-bold text-slate-500 uppercase">Observaciones</label>
          <input id="swal-obs" type="text" value="${reg.observaciones || ''}" class="w-full p-2.5 border border-slate-300 bg-slate-50 rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"></div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const inputCloro = document.getElementById('swal-cloro');
      const inputPh = document.getElementById('swal-ph');
      const inputTemp = document.getElementById('swal-temp');
      const inputDosif = document.getElementById('swal-dosif');
      const inputMedidas = document.getElementById('swal-medidas');
      const inputObs = document.getElementById('swal-obs');

      if (!inputCloro || !inputPh || !inputTemp) {
        Swal.showValidationMessage('Error al leer los datos del formulario');
        return false;
      }

      return {
        action: 'update',
        id: reg.id,
        cloro: parseFloat(inputCloro.value) || 0,
        ph: parseFloat(inputPh.value) || 0,
        temperatura: parseFloat(inputTemp.value) || 0,
        dosificacion: parseFloat(inputDosif.value) || "",
        medidasCorrectivas: inputMedidas.value,
        observaciones: inputObs.value,
        usuario: AppState.user ? AppState.user.nombre : "Usuario"
      };
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      ejecutarAccionCRUD(result.value);
    }
  });
};

window.eliminarRegistro = (id) => {
  const rolesPermitidos = ['JEFE', 'GERENTE', 'ADMINISTRADOR'];
  if (!AppState.user || !rolesPermitidos.includes((AppState.user.rol || '').toUpperCase())) {
    return Swal.fire({ icon: 'error', title: 'Permiso Denegado', text: 'Solo Jefaturas y Gerencia pueden eliminar registros.' });
  }

  Swal.fire({
    title: '¿Estás seguro?',
    text: `Se eliminará permanentemente el registro ${id}. Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      ejecutarAccionCRUD({ action: 'delete', id: id });
    }
  });
};

async function ejecutarAccionCRUD(payload) {
  Swal.fire({ title: 'Procesando...', text: 'Sincronizando con base de datos.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  try {
    const response = await fetch(BACKEND_URL, { method: "POST", mode: "cors", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) throw new Error("Error del servidor (HTML devuelto).");
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const result = await response.json();
    if (result.status === "success") {
      Swal.fire({ icon: 'success', title: 'Completado', text: result.message, timer: 1500, showConfirmButton: false });
      const btnRefresh = document.getElementById("btnActualizarHistorial");
      if (btnRefresh) btnRefresh.click();
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    Swal.fire({ icon: "error", title: "Fallo de Servidor", text: error.message });
  }
}

/* ================================================================
   2. MOTOR GRÁFICO (THREE.JS - LIQUID GLASS)
   ================================================================ */
const MAX_DROPLETS = 40;
const FIXED_DT_MS = 8;
const MAX_FRAME_DT_MS = 100;
const MAX_CATCHUP = 6;

const app = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const bgCanvas = document.createElement("canvas");
const bgCtx = bgCanvas.getContext("2d");
const bgTexture = new THREE.CanvasTexture(bgCanvas);
bgTexture.minFilter = THREE.LinearFilter;
bgTexture.magFilter = THREE.LinearFilter;

function drawBackground() {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  bgCanvas.width = w;
  bgCanvas.height = h;

  const grd = bgCtx.createLinearGradient(0, 0, w * 0.6, h);
  grd.addColorStop(0, "#e8dbc8");
  grd.addColorStop(0.35, "#5b8cdb");
  grd.addColorStop(0.6, "#2d6fd4");
  grd.addColorStop(1, "#1a3fa0");
  bgCtx.fillStyle = grd;
  bgCtx.fillRect(0, 0, w, h);

  bgCtx.save();
  bgCtx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const cx = w * (0.2 + i * 0.18);
    const cy = h * (0.3 + Math.sin(i * 1.3) * 0.25);
    const rg = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.35);
    const hue = 200 + i * 25;
    rg.addColorStop(0, `hsla(${hue}, 80%, 65%, 0.6)`);
    rg.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`);
    bgCtx.fillStyle = rg;
    bgCtx.fillRect(0, 0, w, h);
  }
  bgCtx.restore();

  bgCtx.fillStyle = "#ffffff";
  bgCtx.textAlign = "center";
  bgCtx.textBaseline = "middle";

  const titleSize = Math.round(w * 0.13);
  bgCtx.font = `700 ${titleSize}px 'Space Grotesk', sans-serif`;
  bgCtx.fillText("Control", w * 0.5, h * 0.38);
  bgCtx.fillText("de Cloro", w * 0.5, h * 0.38 + titleSize * 1.05);

  const subSize = Math.round(w * 0.022);
  bgCtx.font = `500 ${subSize}px 'Space Grotesk', sans-serif`;
  bgCtx.globalAlpha = 0.55;
  bgCtx.fillText("Planta de Embutidos", w * 0.5, h * 0.38 + titleSize * 2.3);
  bgCtx.globalAlpha = 1;

  const words = [
    "planta", "produccion", "control", "cloro", "residual",
    "precisión", "calidad", "Agroindustrias", "Genovesa"
  ];
  bgCtx.globalAlpha = 0.08;
  const scatterSize = Math.round(w * 0.018);
  bgCtx.font = `500 ${scatterSize}px 'Space Grotesk', sans-serif`;
  for (let i = 0; i < words.length; i++) {
    bgCtx.fillText(
      words[i],
      w * (0.12 + (i % 4) * 0.25),
      h * (0.08 + Math.floor(i / 4) * 0.35 + (i % 3) * 0.12)
    );
  }
  bgCtx.globalAlpha = 1;
  bgTexture.needsUpdate = true;
}

document.fonts.ready.then(() => drawBackground());
drawBackground();

const MAX_ENTRIES = MAX_DROPLETS * 2;
const dropletBuf = new Float32Array(MAX_ENTRIES * 4);
const dropletTex = new THREE.DataTexture(
  dropletBuf, MAX_ENTRIES, 1, THREE.RGBAFormat, THREE.FloatType
);
dropletTex.minFilter = THREE.NearestFilter;
dropletTex.magFilter = THREE.NearestFilter;
dropletTex.needsUpdate = true;

let drops = [];
let uid = 0;

function spawn(x, y, r, vx = 0, vy = 0) {
  if (drops.length >= MAX_DROPLETS) return null;
  const area = Math.PI * r * r;
  const angle = Math.random() * Math.PI * 2;
  const spd = 0.0003 + Math.random() * 0.0008;
  const d = {
    id: uid++, x, y, r, area,
    vx: vx || Math.cos(angle) * spd,
    vy: vy || Math.sin(angle) * spd,
    alive: true,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderSpeed: 0.3 + Math.random() * 0.5,
    softPrevX: x, softPrevY: y, softOffX: 0, softOffY: 0,
    softVelX: 0, softVelY: 0
  };
  drops.push(d);
  return d;
}

for (let i = 0; i < 12; i++) {
  spawn((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5, 0.03 + Math.random() * 0.05);
}

const vertSrc = `void main(){ gl_Position = vec4(position, 1.0); }`;
const fragSrc = `
precision highp float;
#define MAX_N ${MAX_ENTRIES}
uniform vec2 uRes;
uniform sampler2D uData;
uniform sampler2D uBg;
uniform int uCount;
uniform float uTime;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float field = 0.0; vec2 grad = vec2(0.0); vec2 lens = vec2(0.0); float lensW = 0.0;
  for(int i = 0; i < MAX_N; i++){
    if(i >= uCount) break;
    vec4 d = texture2D(uData, vec2((float(i)+0.5)/float(MAX_N), 0.5));
    vec2 c = d.xy; float r = d.z;
    if(r < 0.001) continue;
    vec2 delta = p - c; float dSq = dot(delta, delta) + 1e-5; float contrib = r * r / dSq;
    field += contrib; grad += -2.0 * contrib / dSq * delta;
    float w = r * r / (dSq + r * r); lens += (c - p) * w; lensW += w;
  }
  lens /= (lensW + 0.001); float lensLen = length(lens);
  float thr = 1.0; float edge = smoothstep(thr - 0.08, thr + 0.03, field);
  float refractStrength = 0.035; float mappedLens = atan(lensLen * 6.0) * refractStrength;
  vec2 refractDir = (lensLen > 1e-5) ? lens / lensLen : vec2(0.0);
  float refractMask = smoothstep(thr - 0.2, thr + 1.5, field);
  vec2 refractedUV = clamp(uv + refractDir * mappedLens * refractMask, 0.001, 0.999);
  vec3 bgClean = texture2D(uBg, uv).rgb;
  float gradLen = length(grad); float nScale = atan(gradLen * 0.5) * 0.3;
  vec2 nGrad = (gradLen > 1e-4) ? (grad / gradLen) * nScale : vec2(0.0);
  vec3 N = normalize(vec3(-nGrad, 1.0)); vec3 L = normalize(vec3(0.3, 0.6, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0); vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0); float spec = pow(max(dot(N, H), 0.0), 180.0);
  float cosTheta = max(dot(N, V), 0.0); float fresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 4.0);
  float rim = smoothstep(thr + 0.6, thr, field) * edge;
  float caStr = 0.0018 * edge; vec3 bgCA;
  bgCA.r = texture2D(uBg, refractedUV + vec2(caStr, caStr * 0.5)).r;
  bgCA.g = texture2D(uBg, refractedUV).g;
  bgCA.b = texture2D(uBg, refractedUV - vec2(caStr, caStr * 0.5)).b;
  float depth = smoothstep(thr, thr + 3.0, field);
  vec3 tint = mix(vec3(1.0), vec3(0.93, 0.96, 1.0), depth * 0.45);
  vec3 glassColor = bgCA * tint * (0.92 + 0.08 * diff) + vec3(1.0) * spec * 0.85 + vec3(0.9, 0.95, 1.0) * rim * 0.22 + vec3(1.0) * fresnel * 0.10;
  float shadowField = smoothstep(thr - 0.35, thr - 0.05, field);
  vec3 bg = bgClean * (1.0 - shadowField * 0.06);
  float borderOuter = smoothstep(thr - 0.10, thr - 0.01, field);
  float borderInner = smoothstep(thr + 0.0, thr + 0.06, field);
  float border = borderOuter * (1.0 - borderInner) * 0.28;
  vec3 col = mix(bg, glassColor, edge); col += vec3(1.0) * border;
  gl_FragColor = vec4(col, 1.0);
}
`;

const mat = new THREE.ShaderMaterial({
  vertexShader: vertSrc,
  fragmentShader: fragSrc,
  uniforms: {
    uRes: { value: new THREE.Vector2(renderer.domElement.width, renderer.domElement.height) },
    uData: { value: dropletTex },
    uBg: { value: bgTexture },
    uCount: { value: 0 },
    uTime: { value: 0 }
  }
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

let aspect = innerWidth / innerHeight;
const mouse = { x: 999, y: 999, active: false, down: false };
let spawnCD = 0;

renderer.domElement.addEventListener("pointermove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width - 0.5) * aspect;
  mouse.y = 0.5 - (e.clientY - rect.top) / rect.height;
  mouse.active = true;
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width - 0.5) * aspect;
  mouse.y = 0.5 - (e.clientY - rect.top) / rect.height;
  mouse.active = true;
  mouse.down = true;

  for (let i = 0; i < 4; i++) {
    spawn(mouse.x + (Math.random() - 0.5) * 0.08, mouse.y + (Math.random() - 0.5) * 0.08, 0.02 + Math.random() * 0.03);
  }
});

renderer.domElement.addEventListener("pointerup", () => (mouse.down = false));
renderer.domElement.addEventListener("pointerleave", () => { mouse.active = false; mouse.down = false; });

window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  aspect = innerWidth / innerHeight;
  mat.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  drawBackground();
});

const DAMP = 0.993, MOUSE_R = 0.18, MOUSE_F = 0.004, TENSION_RANGE = 0.12, TENSION_F = 0.0004;
const MERGE_RATIO = 0.62, SPLIT_SPEED = 0.013, SPLIT_MIN_R = 0.04, MAX_SPEED = 0.015;
const BOUNCE = 0.4, WANDER_F = 0.00004, CENTER_PULL = 0.000008;

function applyForces(time) {
  for (const d of drops) {
    d.wanderAngle += (Math.random() - 0.5) * d.wanderSpeed;
    d.vx += Math.cos(d.wanderAngle) * WANDER_F;
    d.vy += Math.sin(d.wanderAngle) * WANDER_F;
    d.vx -= d.x * CENTER_PULL;
    d.vy -= d.y * CENTER_PULL;
    if (mouse.active) {
      const dx = d.x - mouse.x, dy = d.y - mouse.y;
      const dSq = dx * dx + dy * dy;
      const rr = MOUSE_R + d.r;
      if (dSq < rr * rr && dSq > 1e-5) {
        const dist = Math.sqrt(dSq);
        const s = 1 - dist / rr;
        const f = s * s * MOUSE_F;
        d.vx += (dx / dist) * f;
        d.vy += (dy / dist) * f;
      }
    }
  }
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dSq = dx * dx + dy * dy;
      const rng = TENSION_RANGE + a.r + b.r;
      if (dSq < rng * rng && dSq > 1e-5) {
        const dist = Math.sqrt(dSq);
        const s = 1 - dist / rng;
        const f = s * TENSION_F;
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
  }
}

function integrate() {
  for (const d of drops) {
    const sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
    if (sp > MAX_SPEED) { const s = MAX_SPEED / sp; d.vx *= s; d.vy *= s; }
    d.x += d.vx; d.y += d.vy; d.vx *= DAMP; d.vy *= DAMP;
    const wx = aspect * 0.5, wy = 0.5;
    if (d.x - d.r < -wx) { d.x = -wx + d.r; d.vx = Math.abs(d.vx) * BOUNCE; }
    if (d.x + d.r > wx) { d.x = wx - d.r; d.vx = -Math.abs(d.vx) * BOUNCE; }
    if (d.y - d.r < -wy) { d.y = -wy + d.r; d.vy = Math.abs(d.vy) * BOUNCE; }
    if (d.y + d.r > wy) { d.y = wy - d.r; d.vy = -Math.abs(d.vy) * BOUNCE; }
  }
}

function mergeDroplets() {
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < (a.r + b.r) * MERGE_RATIO) {
        const na = a.area + b.area;
        a.x = (a.x * a.area + b.x * b.area) / na;
        a.y = (a.y * a.area + b.y * b.area) / na;
        a.vx = (a.vx * a.area + b.vx * b.area) / na;
        a.vy = (a.vy * a.area + b.vy * b.area) / na;
        a.r = Math.sqrt(na / Math.PI);
        a.area = na;
        b.alive = false;
      }
    }
  }
  drops = drops.filter((d) => d.alive);
}

function splitDroplets() {
  const add = [];
  for (const d of drops) {
    if (d.r < SPLIT_MIN_R) continue;
    const sp = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
    if (sp < SPLIT_SPEED) continue;
    const ha = d.area * 0.5, nr = Math.sqrt(ha / Math.PI);
    const nx = -d.vy / sp, ny = d.vx / sp, off = nr * 0.7;
    d.r = nr; d.area = ha; d.x -= nx * off; d.y -= ny * off;
    add.push({
      id: uid++, x: d.x + nx * off * 2, y: d.y + ny * off * 2, r: nr, area: ha,
      vx: d.vx + nx * sp * 0.35, vy: d.vy + ny * sp * 0.35, alive: true,
      wanderAngle: Math.random() * Math.PI * 2, wanderSpeed: 0.3 + Math.random() * 0.5,
      softPrevX: d.x + nx * off * 2, softPrevY: d.y + ny * off * 2, softOffX: 0, softOffY: 0, softVelX: 0, softVelY: 0
    });
  }
  for (const a of add) if (drops.length < MAX_DROPLETS) drops.push(a);
}

let autoTimer = 0;
function autoSpawn() {
  autoTimer += FIXED_DT_MS;
  if (autoTimer > 2000 && drops.length < 10) {
    autoTimer = 0;
    spawn((Math.random() - 0.5) * aspect * 0.6, (Math.random() - 0.5) * 0.6, 0.025 + Math.random() * 0.03);
  }
}

function mouseSpawn() {
  if (!mouse.down || !mouse.active) return;
  spawnCD -= FIXED_DT_MS;
  if (spawnCD <= 0 && drops.length < MAX_DROPLETS) {
    spawnCD = 120;
    spawn(mouse.x + (Math.random() - 0.5) * 0.02, mouse.y + (Math.random() - 0.5) * 0.02, 0.02 + Math.random() * 0.015);
  }
}

const SOFT_STIFFNESS = 0.22, SOFT_DAMPING = 0.6;
function updateSoftBodies() {
  for (const d of drops) {
    const dx = d.x - d.softPrevX, dy = d.y - d.softPrevY;
    d.softVelX += (dx - d.softOffX) * SOFT_STIFFNESS;
    d.softVelY += (dy - d.softOffY) * SOFT_STIFFNESS;
    d.softVelX *= SOFT_DAMPING; d.softVelY *= SOFT_DAMPING;
    d.softOffX += d.softVelX; d.softOffY += d.softVelY;
    d.softPrevX = d.x; d.softPrevY = d.y;
  }
}

let simTime = 0;
function fixedUpdate() {
  simTime += FIXED_DT_MS;
  applyForces(simTime); integrate(); mergeDroplets(); splitDroplets(); updateSoftBodies(); autoSpawn(); mouseSpawn();
}

function sync() {
  dropletBuf.fill(0);
  const n = Math.min(drops.length, MAX_DROPLETS);
  for (let i = 0; i < n; i++) {
    const d = drops[i];
    dropletBuf[i * 4] = d.x; dropletBuf[i * 4 + 1] = d.y; dropletBuf[i * 4 + 2] = d.r; dropletBuf[i * 4 + 3] = 1;
    const ghostScale = 0.7, trailStr = 3.5, gi = (n + i) * 4;
    dropletBuf[gi] = d.x - d.softOffX * trailStr;
    dropletBuf[gi + 1] = d.y - d.softOffY * trailStr;
    dropletBuf[gi + 2] = d.r * ghostScale; dropletBuf[gi + 3] = 1;
  }
  dropletTex.needsUpdate = true;
  mat.uniforms.uCount.value = n * 2;
}

let last = performance.now(), acc = 0, paused = false;
document.addEventListener("visibilitychange", () => { paused = document.hidden; if (!paused) last = performance.now(); });

(function loop() {
  if (paused) { requestAnimationFrame(loop); return; }
  const now = performance.now(), dt = Math.min(now - last, MAX_FRAME_DT_MS);
  last = now; acc += dt; let g = 0;
  while (acc >= FIXED_DT_MS && g < MAX_CATCHUP) { fixedUpdate(); acc -= FIXED_DT_MS; g++; }
  if (g >= MAX_CATCHUP) acc = 0;
  mat.uniforms.uTime.value = now * 0.001; sync(); renderer.render(scene, camera); requestAnimationFrame(loop);
})();
