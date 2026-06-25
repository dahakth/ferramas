/**
 * TESTS DE CONTACTO — CA-08
 * Herramienta: Jest + Supertest
 * Tipo: Mock de servicio externo (Nodemailer)
 *
 * CA-08: POST /contacto → HTTP 200, correo enviado al administrador
 */

const request = require("supertest");

// ── Mock de Nodemailer ─────────────────────────────────────────────────────────
const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// ── Mocks de otras dependencias ───────────────────────────────────────────────
jest.mock("mysql2", () => ({
  createConnection: jest.fn(() => ({
    query: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock("mercadopago", () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn(),
}));

const app = require("../src/app");

// ── Datos de prueba ───────────────────────────────────────────────────────────
const MENSAJE_VALIDO = {
  nombre:  "Juan Prueba",
  correo:  "juan.prueba@gmail.com",
  mensaje: "Este es un mensaje de prueba para el formulario de contacto de Ferramas.",
};

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-08 — POST /contacto con Nodemailer (mock)", () => {
  describe("Con datos válidos", () => {
    beforeEach(() => {
      mockSendMail.mockResolvedValue({ messageId: "mock-contacto-id" });
    });

    test("Debe retornar HTTP 200", async () => {
      const res = await request(app).post("/contacto").send(MENSAJE_VALIDO);
      expect(res.statusCode).toBe(200);
    });

    test("Debe retornar mensaje de confirmación", async () => {
      const res = await request(app).post("/contacto").send(MENSAJE_VALIDO);
      expect(res.body.mensaje).toBe("Mensaje enviado correctamente");
    });

    test("Debe llamar a sendMail con el correo del administrador como destinatario", async () => {
      await request(app).post("/contacto").send(MENSAJE_VALIDO);
      const args = mockSendMail.mock.calls[0][0];
      // El correo debe ir al admin, no al remitente
      expect(args.to).toBe("alaneduardomolina15@gmail.com");
    });

    test("El asunto del correo debe mencionar Ferramas", async () => {
      await request(app).post("/contacto").send(MENSAJE_VALIDO);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.subject).toContain("Ferramas");
    });

    test("El cuerpo del correo debe incluir el nombre, correo y mensaje del remitente", async () => {
      await request(app).post("/contacto").send(MENSAJE_VALIDO);
      const args = mockSendMail.mock.calls[0][0];
      expect(args.html).toContain("Juan Prueba");
      expect(args.html).toContain("juan.prueba@gmail.com");
      expect(args.html).toContain("Este es un mensaje de prueba");
    });
  });

  describe("Cuando el servidor de correo falla", () => {
    beforeEach(() => {
      mockSendMail.mockRejectedValue(new Error("SMTP timeout"));
    });

    test("Debe retornar HTTP 500", async () => {
      const res = await request(app).post("/contacto").send(MENSAJE_VALIDO);
      expect(res.statusCode).toBe(500);
    });

    test("Debe retornar mensaje de error", async () => {
      const res = await request(app).post("/contacto").send(MENSAJE_VALIDO);
      expect(res.body.mensaje).toBe("Error al enviar mensaje");
    });
  });
});
