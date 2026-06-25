/**
 * TESTS DE PRODUCTOS — CA-05
 * Herramienta: Jest + Supertest
 * Tipo: Integración con Mock de base de datos
 *
 * CA-05: GET /productos → HTTP 200, array de productos
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

// ── Datos simulados de productos (como vendrían de la BD) ─────────────────────
const PRODUCTOS_MOCK = [
  { id: 1, nombre: "Martillo de Garra 16oz", precio: 8990,  imagen: "martillo.jpg", categoria: "herramientas" },
  { id: 2, nombre: "Taladro Percutor 700W",  precio: 49990, imagen: "taladro.jpg",  categoria: "herramientas" },
  { id: 3, nombre: "Cemento 25kg",           precio: 5490,  imagen: "cemento.jpg",  categoria: "construccion" },
];

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-05 — GET /productos", () => {
  describe("Con productos en la base de datos", () => {
    beforeEach(() => {
      mysql.__mockQuery.mockImplementation((sql, callback) => {
        callback(null, PRODUCTOS_MOCK);
      });
    });

    test("Debe retornar HTTP 200", async () => {
      const res = await request(app).get("/productos");
      expect(res.statusCode).toBe(200);
    });

    test("Debe retornar un array", async () => {
      const res = await request(app).get("/productos");
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("Debe retornar 3 productos (los de la BD simulada)", async () => {
      const res = await request(app).get("/productos");
      expect(res.body.length).toBe(3);
    });

    test("Cada producto debe tener id, nombre y precio", async () => {
      const res = await request(app).get("/productos");
      res.body.forEach((producto) => {
        expect(producto).toHaveProperty("id");
        expect(producto).toHaveProperty("nombre");
        expect(producto).toHaveProperty("precio");
      });
    });

    test("El primer producto debe ser el Martillo de Garra", async () => {
      const res = await request(app).get("/productos");
      expect(res.body[0].nombre).toBe("Martillo de Garra 16oz");
      expect(res.body[0].precio).toBe(8990);
    });
  });

  describe("Con tabla vacía en la base de datos", () => {
    beforeEach(() => {
      // Simular BD vacía: retorna array vacío, no error
      mysql.__mockQuery.mockImplementation((sql, callback) => {
        callback(null, []);
      });
    });

    test("Debe retornar HTTP 200 aunque no haya productos", async () => {
      const res = await request(app).get("/productos");
      expect(res.statusCode).toBe(200);
    });

    test("Debe retornar un array vacío", async () => {
      const res = await request(app).get("/productos");
      expect(res.body).toEqual([]);
    });
  });

  describe("Cuando la base de datos falla", () => {
    beforeEach(() => {
      mysql.__mockQuery.mockImplementation((sql, callback) => {
        callback(new Error("Table not found"), null);
      });
    });

    test("Debe retornar HTTP 500", async () => {
      const res = await request(app).get("/productos");
      expect(res.statusCode).toBe(500);
    });
  });
});
