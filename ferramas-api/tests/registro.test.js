/**
 * TESTS DE REGISTRO — CA-03 y CA-04
 * Herramienta: Jest + Supertest
 * Tipo: Integración con Mock de base de datos
 *
 * CA-03: Registro con correo nuevo → HTTP 200, usuario creado
 * CA-04: Registro con correo duplicado → HTTP 400, error claro
 */

const request = require("supertest");

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock("mysql2", () => {
  const mockQuery = jest.fn();
  return {
    createConnection: jest.fn(() => ({
      query: mockQuery,
      connect: jest.fn(),
    })),
    __mockQuery: mockQuery,
  };
});

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(),
}));

const app = require("../src/app");
const mysql = require("mysql2");

// ── Datos de prueba ───────────────────────────────────────────────────────────
const USUARIO_NUEVO = {
  nombre: "Usuario Prueba",
  correo: "nuevo@ferramas.cl",
  password: "NuevoPass123",
};

const USUARIO_DUPLICADO = {
  nombre: "Otro Usuario",
  correo: "yaexiste@ferramas.cl",
  password: "OtraPass456",
};

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-03 — POST /registro con correo nuevo", () => {
  beforeEach(() => {
    // Primera query (verificar si existe): retorna vacío = no existe
    // Segunda query (INSERT): retorna resultado exitoso
    mysql.__mockQuery
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, []); // SELECT → no encontrado
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, { insertId: 5, affectedRows: 1 }); // INSERT → exitoso
      });
  });

  test("Debe retornar HTTP 200", async () => {
    const res = await request(app).post("/registro").send(USUARIO_NUEVO);
    expect(res.statusCode).toBe(200);
  });

  test("Debe retornar mensaje de éxito", async () => {
    const res = await request(app).post("/registro").send(USUARIO_NUEVO);
    expect(res.body.mensaje).toBe("Usuario registrado correctamente");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-04 — POST /registro con correo ya registrado", () => {
  beforeEach(() => {
    // Query de verificación: retorna un usuario existente
    mysql.__mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, [{ id: 1, correo: "yaexiste@ferramas.cl" }]); // Ya existe
    });
  });

  test("Debe retornar HTTP 400", async () => {
    const res = await request(app).post("/registro").send(USUARIO_DUPLICADO);
    expect(res.statusCode).toBe(400);
  });

  test("Debe retornar mensaje de correo duplicado", async () => {
    const res = await request(app).post("/registro").send(USUARIO_DUPLICADO);
    expect(res.body.mensaje).toBe("El correo ya está registrado");
  });

  test("No debe retornar HTTP 200 con correo duplicado", async () => {
    const res = await request(app).post("/registro").send(USUARIO_DUPLICADO);
    expect(res.statusCode).not.toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-03b — POST /registro cuando la BD falla en el INSERT", () => {
  beforeEach(() => {
    mysql.__mockQuery
      .mockImplementationOnce((sql, params, callback) => {
        callback(null, []); // SELECT → no existe
      })
      .mockImplementationOnce((sql, params, callback) => {
        callback(new Error("DB insert error"), null); // INSERT → falla
      });
  });

  test("Debe retornar HTTP 500 si el INSERT falla", async () => {
    const res = await request(app).post("/registro").send(USUARIO_NUEVO);
    expect(res.statusCode).toBe(500);
  });
});
