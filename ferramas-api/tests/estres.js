// ============================================================
//  PRUEBA DE ESTRÉS — Ferramas
//  Herramienta: k6
//  Objetivo: Llevar el sistema al límite y verificar que
//            falla de forma controlada (sin caerse)
//  Autor: Equipo Ferramas — Integración de Plataformas
//  Fecha: 26/06/2026
// ============================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ── Métricas personalizadas ───────────────────────────────────
const tiempoRespuesta  = new Trend("tiempo_respuesta_estres");
const erroresHttp      = new Rate("errores_http");
const respuestasOk     = new Counter("respuestas_ok");
const respuestasFallo  = new Counter("respuestas_fallo");

// ── URL base ──────────────────────────────────────────────────
const BASE_URL = "https://ferramas-yaig.onrender.com";

// ── Escenarios de estrés (según Plan de Pruebas sección 3.1.6) ─
export const options = {
  scenarios: {
    // Escenario 1: GET /productos — sobrecarga (500 VU, 120s)
    estres_productos: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 100 },  // subida rápida
        { duration: "20s", target: 300 },  // presión alta
        { duration: "40s", target: 500 },  // punto de quiebre
        { duration: "20s", target: 0   },  // bajada
        { duration: "20s", target: 0   },  // recuperación
      ],
      tags: { escenario: "estres_productos" },
    },

    // Escenario 2: POST /login — ataques simultáneos (300 VU, 90s)
    estres_login: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 100 },
        { duration: "30s", target: 300 },
        { duration: "30s", target: 300 },
        { duration: "15s", target: 0   },
      ],
      startTime: "125s",
      tags: { escenario: "estres_login" },
    },

    // Escenario 3: POST /crear-pago — estrés extremo (100 VU, 60s)
    estres_pago: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 50  },
        { duration: "30s", target: 100 },
        { duration: "15s", target: 0   },
      ],
      startTime: "225s",
      tags: { escenario: "estres_pago" },
    },
  },

  // Umbrales de estrés — más permisivos que carga porque el objetivo
  // es ver que el servidor DEGRADA pero NO CAE
  thresholds: {
    // El servidor debe responder aunque sea lento (< 5s en estrés)
    "http_req_duration": ["p(95)<5000"],
    // No se acepta que el servidor quede totalmente caído (> 30% errores)
    "http_req_failed":   ["rate<0.30"],
    // Métrica propia
    "errores_http":      ["rate<0.30"],
  },
};

// ── Función principal ─────────────────────────────────────────
export default function () {
  const escenario = __ENV.K6_SCENARIO || "estres_productos";

  // ── Estrés: GET /productos ────────────────────────────────
  if (escenario === "estres_productos") {
    const res = http.get(`${BASE_URL}/productos`, {
      timeout: "10s",
      tags:    { endpoint: "GET_productos_estres" },
    });

    tiempoRespuesta.add(res.timings.duration);

    const ok = check(res, {
      "Servidor responde (no 0)":         (r) => r.status !== 0,
      "No es error 500 no controlado":    (r) => r.status !== 500 || r.body.includes("error"),
      "Respuesta en < 5000ms":            (r) => r.timings.duration < 5000,
    });

    if (res.status === 200) {
      respuestasOk.add(1);
    } else {
      respuestasFallo.add(1);
      erroresHttp.add(1);
    }

    // Menos sleep en estrés para mantener presión
    sleep(0.5);
    return;
  }

  // ── Estrés: POST /login ───────────────────────────────────
  if (escenario === "estres_login") {
    const payload = JSON.stringify({
      correo:     "test@ferramas.cl",
      contrasena: "Test1234",
    });
    const params = {
      headers: { "Content-Type": "application/json" },
      timeout: "10s",
      tags:    { endpoint: "POST_login_estres" },
    };

    const res = http.post(`${BASE_URL}/login`, payload, params);
    tiempoRespuesta.add(res.timings.duration);

    const ok = check(res, {
      // En estrés el servidor puede retornar 200, 401 o 429 (too many requests)
      // Lo importante es que NO caiga (status 0 = servidor muerto)
      "Servidor no caído":             (r) => r.status !== 0,
      "Respuesta controlada":          (r) => [200, 401, 429, 503].includes(r.status),
      "Respuesta en < 5000ms":         (r) => r.timings.duration < 5000,
    });

    if (res.status === 200 || res.status === 401) {
      respuestasOk.add(1);
    } else {
      respuestasFallo.add(1);
      erroresHttp.add(1);
    }

    sleep(0.3);
    return;
  }

  // ── Estrés: POST /crear-pago ──────────────────────────────
  if (escenario === "estres_pago") {
    const payload = JSON.stringify({
      productos: [
        { nombre: "Martillo de Garra", precio: 5990 },
        { nombre: "Taladro Percutor",  precio: 45990 },
        { nombre: "Sierra Circular",   precio: 89990 },
      ],
    });
    const params = {
      headers: { "Content-Type": "application/json" },
      timeout: "15s",
      tags:    { endpoint: "POST_crear_pago_estres" },
    };

    const res = http.post(`${BASE_URL}/crear-pago`, payload, params);
    tiempoRespuesta.add(res.timings.duration);

    const ok = check(res, {
      // MercadoPago puede saturarse; lo que no se acepta es que el servidor explote
      "Servidor no caído en pago":      (r) => r.status !== 0,
      "Respuesta HTTP válida":          (r) => r.status >= 200 && r.status < 600,
      "Error manejado si falla MP":     (r) =>
        r.status === 200
          ? r.body.includes("init_point")
          : r.body.includes("error") || r.body.includes("mensaje"),
    });

    if (res.status === 200) {
      respuestasOk.add(1);
    } else {
      respuestasFallo.add(1);
      erroresHttp.add(1);
    }

    sleep(0.5);
  }
}

// ── Resumen al finalizar ──────────────────────────────────────
export function handleSummary(data) {
  const dur   = data.metrics.http_req_duration;
  const fallo = data.metrics.http_req_failed;

  const resumen = {
    "=== RESUMEN PRUEBA DE ESTRÉS — Ferramas ===": "",
    "Total requests":     data.metrics.http_reqs?.values?.count ?? "N/A",
    "Tiempo promedio":    `${(dur?.values?.avg ?? 0).toFixed(0)} ms`,
    "Percentil 95":       `${(dur?.values["p(95)"] ?? 0).toFixed(0)} ms`,
    "Percentil 99":       `${(dur?.values["p(99)"] ?? 0).toFixed(0)} ms`,
    "Tasa de errores":    `${(((fallo?.values?.rate ?? 0) * 100)).toFixed(2)} %`,
    "Veredicto": fallo?.values?.rate < 0.30
      ? "✅ SERVIDOR AGUANTÓ — Degradó pero no cayó"
      : "❌ SERVIDOR SOBREPASADO — Demasiados errores",
  };

  console.log("\n");
  for (const [k, v] of Object.entries(resumen)) {
    console.log(`${k}: ${v}`);
  }

  return {
    stdout: JSON.stringify(resumen, null, 2),
  };
}
