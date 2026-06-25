/**
 * TESTS DE LOGIN — CA-01 y CA-02
 * Herramienta: Jest + Supertest
 * Tipo: Integración con Mock de base de datos
 *
 * CA-01: Login con credenciales válidas → HTTP 200, success: true
 * CA-02: Login con credenciales inválidas → HTTP 401, success: false
 */

const request = require("supertest");

// ── Mock de la base de datos ──────────────────────────────────────────────────
// Simulamos mysql2 para no depender de una BD real durante los tests.
// jest.mock intercepta el require("mysql2") en app.js y lo reemplaza
// por nuestro objeto simulado.
jest.mock("mysql2", () => {
  const mockQuery = jest.fn();
  const mockConnection = {
    query: mockQuery,
    connect: jest.fn(),
  };
  return {
    createConnection: jest.fn(() => mockConnection),
    // Guardamos referencia al mockQuery para poder configurarlo en cada test
    __mockQuery: mockQuery,
  };
});

// Mock de nodemailer (no se usa en login, pero app.js lo inicializa)
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(),
  })),
}));

// Mock de mercadopago (no se usa en login, pero app.js lo inicializa)
jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(),
}));

// Importar la app DESPUÉS de los mocks
const app = require("../src/app");
const mysql = require("mysql2");

// ── Datos de prueba ───────────────────────────────────────────────────────────
const USUARIO_VALIDO = {
  correo: "test@ferramas.cl",
  password: "Test1234",
};

const USUARIO_INVALIDO = {
  correo: "noexiste@ferramas.cl",
  password: "passwordincorrecto",
};

const USUARIO_EN_BD = {
  id: 1,
  nombre: "Usuario Test",
  correo: "test@ferramas.cl",
  password: "Test1234",
};

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-01 — POST /login con credenciales válidas", () => {
  beforeEach(() => {
    // Configurar el mock para simular que la BD encuentra el usuario
    mysql.__mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, [USUARIO_EN_BD]); // null = sin error, array con 1 resultado
    });
  });

  test("Debe retornar HTTP 200", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.statusCode).toBe(200);
  });

  test("Debe retornar success: true", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.body.success).toBe(true);
  });

  test("Debe retornar el mensaje 'Login correcto'", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.body.mensaje).toBe("Login correcto");
  });

  test("Debe retornar los datos del usuario (id, nombre, correo, descuento)", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.body.usuario).toBeDefined();
    expect(res.body.usuario.id).toBe(1);
    expect(res.body.usuario.nombre).toBe("Usuario Test");
    expect(res.body.usuario.correo).toBe("test@ferramas.cl");
    expect(res.body.usuario.descuento).toBe(10);
  });

  test("No debe retornar la contraseña del usuario en la respuesta", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.body.usuario.password).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-02 — POST /login con credenciales inválidas", () => {
  beforeEach(() => {
    // Configurar el mock para simular que la BD NO encuentra el usuario
    mysql.__mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, []); // null = sin error, array VACÍO = usuario no encontrado
    });
  });

  test("Debe retornar HTTP 401", async () => {
    const res = await request(app).post("/login").send(USUARIO_INVALIDO);
    expect(res.statusCode).toBe(401);
  });

  test("Debe retornar success: false", async () => {
    const res = await request(app).post("/login").send(USUARIO_INVALIDO);
    expect(res.body.success).toBe(false);
  });

  test("Debe retornar mensaje de error apropiado", async () => {
    const res = await request(app).post("/login").send(USUARIO_INVALIDO);
    expect(res.body.mensaje).toBe("Credenciales incorrectas");
  });

  test("No debe retornar datos de usuario", async () => {
    const res = await request(app).post("/login").send(USUARIO_INVALIDO);
    expect(res.body.usuario).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-02b — POST /login cuando la BD falla", () => {
  beforeEach(() => {
    // Simular error de base de datos
    mysql.__mockQuery.mockImplementation((sql, params, callback) => {
      callback(new Error("Connection refused"), null);
    });
  });

  test("Debe retornar HTTP 500 si la BD falla", async () => {
    const res = await request(app).post("/login").send(USUARIO_VALIDO);
    expect(res.statusCode).toBe(500);
  });
});
