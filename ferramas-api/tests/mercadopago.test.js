/**
 * TESTS DE MERCADOPAGO — CA-06
 * Herramienta: Jest + Supertest
 * Tipo: Mock de servicio externo (MercadoPago SDK)
 *
 * CA-06: POST /crear-pago → HTTP 200, retorna init_point
 *
 * ¿Por qué mock?
 * MercadoPago es un servicio externo de pago real. No podemos llamarlo
 * en cada test porque requiere credenciales y haría requests a internet.
 * Con jest.mock simulamos que Preference.create() responde exitosamente
 * sin salir de nuestro servidor.
 */

const request = require("supertest");

// ── Mock de MercadoPago ────────────────────────────────────────────────────────
// Creamos una función mock para preference.create()
const mockPreferenceCreate = jest.fn();

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockPreferenceCreate,
  })),
}));

// ── Mocks de otras dependencias ───────────────────────────────────────────────
jest.mock("mysql2", () => ({
  createConnection: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

const app = require("../src/app");

// ── Datos de prueba ───────────────────────────────────────────────────────────
const CARRITO_VALIDO = {
  productos: [
    { nombre: "Martillo de Garra 16oz", precio: 8990 },
    { nombre: "Taladro Percutor 700W", precio: 49990 },
  ],
};

const CARRITO_VACIO = {
  productos: [],
};

const MP_RESPONSE_MOCK = {
  init_point:
    "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=TEST-123456789",
  id: "TEST-123456789",
};

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-06 — POST /crear-pago con MercadoPago (mock)", () => {
  describe("Con carrito válido", () => {
    beforeEach(() => {
      // Simular que MercadoPago responde exitosamente
      mockPreferenceCreate.mockResolvedValue(MP_RESPONSE_MOCK);
    });

    test("Debe retornar HTTP 200", async () => {
      const res = await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      expect(res.statusCode).toBe(200);
    });

    test("Debe retornar un init_point en la respuesta", async () => {
      const res = await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      expect(res.body).toHaveProperty("init_point");
    });

    test("El init_point debe ser una URL de MercadoPago", async () => {
      const res = await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      expect(res.body.init_point).toContain("mercadopago");
    });

    test("Debe llamar a MercadoPago con los productos del carrito", async () => {
      await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      // Verificar que preference.create() fue llamado
      expect(mockPreferenceCreate).toHaveBeenCalled();
      // Verificar que los items enviados a MP son correctos
      const llamada = mockPreferenceCreate.mock.calls[0][0];
      expect(llamada.body.items).toHaveLength(2);
      expect(llamada.body.items[0].title).toBe("Martillo de Garra 16oz");
      expect(llamada.body.items[0].unit_price).toBe(8990);
    });
  });

  describe("Cuando MercadoPago falla (timeout, credenciales inválidas)", () => {
    beforeEach(() => {
      // Simular error de MercadoPago
      mockPreferenceCreate.mockRejectedValue(
        new Error("MP API Error: unauthorized"),
      );
    });

    test("Debe retornar HTTP 500", async () => {
      const res = await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      expect(res.statusCode).toBe(500);
    });

    test("Debe retornar mensaje de error", async () => {
      const res = await request(app).post("/crear-pago").send(CARRITO_VALIDO);
      expect(res.body.error).toBe("Error al crear pago");
    });
  });
});
