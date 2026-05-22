require("dotenv").config();
const db = require("./config/db");

const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const express = require("express");

const cors = require("cors");

const app = express();

const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    mensaje: "API Ferramas funcionando",
  });
});
app.post("/suscribirse", async (req, res) => {
  const { correo } = req.body;

  try {
    await transporter.sendMail({
      from: "Ferramas <alaneduardomolina15@gmail.com>",
      to: correo,

      subject: "Bienvenido a Ferramas",

      html: `
        <h1>¡Gracias por suscribirte a Ferramas!</h1>

        <p>
          Ahora recibirás ofertas,
          descuentos y novedades.
        </p>
      `,
    });

    res.json({
      mensaje:
        "¡Bienvenido a Ferramas! Ya estás suscrito a nuestras ofertas y novedades.",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      mensaje: "Error al enviar correo",
    });
  }
});
app.post("/contacto", async (req, res) => {
  const { nombre, correo, mensaje } = req.body;

  try {
    await transporter.sendMail({
      from: "Ferramas <alaneduardomolina15@gmail.com>",

      to: "alaneduardomolina15@gmail.com",

      subject: "Nuevo mensaje de contacto - Ferramas",

      html: `
        <h2>Nuevo mensaje recibido</h2>

        <p>
          <strong>Nombre:</strong>
          ${nombre}
        </p>

        <p>
          <strong>Correo:</strong>
          ${correo}
        </p>

        <p>
          <strong>Mensaje:</strong>
        </p>

        <p>
          ${mensaje}
        </p>
      `,
    });

    res.json({
      mensaje: "Mensaje enviado correctamente",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      mensaje: "Error al enviar mensaje",
    });
  }
});
app.get("/productos", (req, res) => {
  const sql = "SELECT * FROM productos";

  db.query(sql, (error, results) => {
    if (error) {
      res.status(500).json({
        error: error,
      });
    } else {
      res.json(results);
    }
  });
});

app.post("/registro", (req, res) => {
  const { nombre, correo, password } = req.body;

  const verificarSql = `
        SELECT * FROM usuarios
        WHERE correo = ?
    `;

  db.query(verificarSql, [correo], (error, results) => {
    if (error) {
      return res.status(500).json({
        mensaje: "Error del servidor",
      });
    }

    if (results.length > 0) {
      return res.status(400).json({
        mensaje: "El correo ya está registrado",
      });
    }

    const insertSql = `
                INSERT INTO usuarios
                (nombre, correo, password)
                VALUES (?, ?, ?)
            `;

    db.query(insertSql, [nombre, correo, password], (error, resultado) => {
      if (error) {
        return res.status(500).json({
          mensaje: "Error al registrar usuario",
        });
      }

      res.json({
        mensaje: "Usuario registrado correctamente",
      });
    });
  });
});

app.post("/login", (req, res) => {
  const { correo, password } = req.body;

  const sql = `
    SELECT * FROM usuarios
    WHERE correo = ? AND password = ?
  `;

  db.query(sql, [correo, password], (error, results) => {
    if (error) {
      return res.status(500).json({
        success: false,
        mensaje: "Error del servidor",
      });
    }

    if (results.length > 0) {
      res.json({
        success: true,

        mensaje: "Login correcto",

        usuario: {
          id: results[0].id,
          nombre: results[0].nombre,
          correo: results[0].correo,
          descuento: 10,
        },
      });
    } else {
      res.status(401).json({
        success: false,
        mensaje: "Credenciales incorrectas",
      });
    }
  });
});
app.post("/crear-pago", async (req, res) => {
  try {
    const { productos } = req.body;

    const items = productos.map((producto) => ({
      title: producto.nombre,
      quantity: 1,
      unit_price: Number(producto.precio),
      currency_id: "CLP",
    }));

    const preference = new Preference(client);

    const response = await preference.create({
      body: {
        items: items,

        back_urls: {
          success: "http://localhost:5500/pago-exitoso.html",
          failure: "http://localhost:5500/pago-fallido.html",
          pending: "http://localhost:5500/pago-fallido.html",
        },
      },
    });
    console.log(response);

    res.json({
      init_point: response.init_point,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Error al crear pago",
    });
  }
});
app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
