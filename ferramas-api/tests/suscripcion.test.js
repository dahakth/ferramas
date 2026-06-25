/**
 * TESTS DE SUSCRIPCIÓN — CA-07
 * Herramienta: Jest + Supertest
 * Tipo: Mock de servicio externo (Nodemailer)
 *
 * CA-07: POST /suscribirse → HTTP 200, correo de bienvenida enviado
 *
 * ¿Por qué mock?
 * Nodemailer usa Gmail SMTP real. En testing no queremos enviar correos
 * reales en cada ejecución. Con jest.mock simulamos que sendMail()
 * funciona correctamente sin salir a internet.
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

// ─────────────────────────────────────────────────────────────────────────────
describe("CA-07 — POST /suscribirse con Nodemailer (mock)", () => {
  describe("Con correo válido", () => {
    beforeEach(() => {
      // Simular que sendMail() resuelve exitosamente
      mockSendMail.mockResolvedValue({ messageId: "mock-id-123" });
    });

    test("Debe retornar HTTP 200", async () => {
      const res = await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });
      expect(res.statusCode).toBe(200);
    });

    test("Debe retornar mensaje de bienvenida", async () => {
      const res = await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });
      expect(res.body.mensaje).toContain("Bienvenido a Ferramas");
    });

    test("Debe llamar a sendMail con el correo correcto", async () => {
      await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });

      expect(mockSendMail).toHaveBeenCalled();
      const args = mockSendMail.mock.calls[0][0];
      expect(args.to).toBe("prueba@gmail.com");
      expect(args.subject).toBe("Bienvenido a Ferramas");
    });

    test("El correo enviado debe incluir contenido HTML", async () => {
      await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });

      const args = mockSendMail.mock.calls[0][0];
      expect(args.html).toBeDefined();
      expect(args.html).toContain("Ferramas");
    });
  });

  describe("Cuando el servidor de correo falla", () => {
    beforeEach(() => {
      // Simular que el envío de correo falla
      mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));
    });

    test("Debe retornar HTTP 500", async () => {
      const res = await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });
      expect(res.statusCode).toBe(500);
    });

    test("Debe retornar mensaje de error", async () => {
      const res = await request(app)
        .post("/suscribirse")
        .send({ correo: "prueba@gmail.com" });
      expect(res.body.mensaje).toBe("Error al enviar correo");
    });
  });
});
