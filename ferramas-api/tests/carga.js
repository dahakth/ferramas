// ============================================================
//  PRUEBA DE CARGA — Ferramas
//  Herramienta: k6
//  Objetivo: Verificar comportamiento bajo carga normal y alta
//  Autor: Equipo Ferramas — Integración de Plataformas
//  Fecha: 26/06/2026
// ============================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Métricas personalizadas ───────────────────────────────────
const tiempoProductos = new Trend("tiempo_productos");
const tiempoLogin     = new Trend("tiempo_login");
const tiempoPago      = new Trend("tiempo_pago");
const tasaErrores     = new Rate("tasa_errores");

// ── URL base (apunta al backend en Render) ────────────────────
const BASE_URL = "https://ferramas-yaig.onrender.com";

// ── Escenarios de carga (según Plan de Pruebas sección 3.1.5) ─
export const options = {
  scenarios: {
    // Escenario 1: GET /productos — carga normal (50 VU, 60s)
    carga_productos_normal: {
      executor: "constant-vus",
      vus: 50,
      duration: "60s",
      tags: { escenario: "productos_normal" },
    },
    // Escenario 2: POST /login — carga normal (30 VU, 60s)
    carga_login_normal: {
      executor: "constant-vus",
      vus: 30,
      duration: "60s",
      startTime: "65s",   // empieza después del primer escenario
      tags: { escenario: "login_normal" },
    },
    // Escenario 3: GET /productos — carga alta (200 VU, 120s)
    carga_productos_alta: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },  // rampa de subida
        { duration: "60s", target: 200 },  // carga máxima
        { duration: "30s", target: 0   },  // rampa de bajada
      ],
      startTime: "130s",
      tags: { escenario: "productos_alta" },
    },
    // Escenario 4: POST /crear-pago — carga media (20 VU, 60s)
    carga_pago_media: {
      executor: "constant-vus",
      vus: 20,
      duration: "60s",
      startTime: "260s",
      tags: { escenario: "pago_medio" },
    },
  },

  // Umbrales de aceptación (según Plan de Pruebas)
  thresholds: {
    // GET /productos normal: < 800ms, 0% errores
    "tiempo_productos{escenario:productos_normal}": ["p(95)<800"],
    // GET /productos alta: < 2000ms, < 1% errores
    "tiempo_productos{escenario:productos_alta}":   ["p(95)<2000"],
    // POST /login: < 1000ms, 0% errores
    "tiempo_login{escenario:login_normal}":         ["p(95)<1000"],
    // POST /crear-pago: < 2000ms, 0% errores
    "tiempo_pago{escenario:pago_medio}":            ["p(95)<2000"],
    // Tasa de errores global
    "tasa_errores": ["rate<0.01"],
    // HTTP general
    "http_req_duration": ["p(95)<2000"],
    "http_req_failed":   ["rate<0.01"],
  },
};

// ── Función principal ─────────────────────────────────────────
export default function () {
  const escenario = __ENV.K6_SCENARIO || "";

  // ── Escenario: productos (normal y alta) ──────────────────
  if (
    escenario === "carga_productos_normal" ||
    escenario === "carga_productos_alta"   ||
    escenario === ""
  ) {
    const res = http.get(`${BASE_URL}/productos`, {
      tags: { endpoint: "GET_productos" },
    });

    tiempoProductos.add(res.timings.duration);

    const ok = check(res, {
      "GET /productos → HTTP 200":           (r) => r.status === 200,
      "GET /productos → respuesta es array": (r) => {
        try {
          return Array.isArray(JSON.parse(r.body));
        } catch {
          return false;
        }
      },
      "GET /productos → tiempo < 2000ms":    (r) => r.timings.duration < 2000,
    });

    tasaErrores.add(!ok);
    sleep(1);
    return;
  }

  // ── Escenario: login ──────────────────────────────────────
  if (escenario === "carga_login_normal") {
    const payload = JSON.stringify({
      correo:     "test@ferramas.cl",
      contrasena: "Test1234",
    });
    const params = {
      headers: { "Content-Type": "application/json" },
      tags:    { endpoint: "POST_login" },
    };

    const res = http.post(`${BASE_URL}/login`, payload, params);
    tiempoLogin.add(res.timings.duration);

    const ok = check(res, {
      "POST /login → HTTP 200 o 401":      (r) => r.status === 200 || r.status === 401,
      "POST /login → body tiene 'success'":(r) => r.body.includes("success"),
      "POST /login → tiempo < 1000ms":     (r) => r.timings.duration < 1000,
    });

    tasaErrores.add(!ok);
    sleep(1);
    return;
  }

  // ── Escenario: crear-pago ─────────────────────────────────
  if (escenario === "carga_pago_media") {
    const payload = JSON.stringify({
      productos: [
        { nombre: "Martillo de Garra", precio: 5990 },
        { nombre: "Destornillador",    precio: 2490 },
      ],
    });
    const params = {
      headers: { "Content-Type": "application/json" },
      tags:    { endpoint: "POST_crear_pago" },
    };

    const res = http.post(`${BASE_URL}/crear-pago`, payload, params);
    tiempoPago.add(res.timings.duration);

    const ok = check(res, {
      "POST /crear-pago → HTTP 200":          (r) => r.status === 200,
      "POST /crear-pago → tiene init_point":  (r) => r.body.includes("init_point"),
      "POST /crear-pago → tiempo < 2000ms":   (r) => r.timings.duration < 2000,
    });

    tasaErrores.add(!ok);
    sleep(1);
    return;
  }

  // ── Default: ejecuta GET /productos (cuando no hay escenario) ─
  const res = http.get(`${BASE_URL}/productos`);
  tiempoProductos.add(res.timings.duration);
  check(res, { "HTTP 200": (r) => r.status === 200 });
  sleep(1);
}
