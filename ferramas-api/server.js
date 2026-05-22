const express = require("express");
const cors = require("cors");

const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 CONFIGURACIÓN CORRECTA
const client = new MercadoPagoConfig({
  accessToken: "TU_ACCESS_TOKEN_AQUI",
});

app.post("/crear-preferencia", async (req, res) => {
  const carrito = req.body.carrito;

  const items = carrito.map((p) => ({
    title: p.nombre,
    quantity: 1,
    unit_price: Number(p.precio),
  }));

  const preference = new Preference(client);

  try {
    const result = await preference.create({
      body: {
        items,
        back_urls: {
          success: "https://ferramas-yaig.onrender.com/success",
          failure: "https://ferramas-yaig.onrender.com/failure",
          pending: "https://ferramas-yaig.onrender.com/pending",
        },
        auto_return: "approved",
      },
    });

    res.json({ init_point: result.init_point });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en https://ferramas-yaig.onrender.com");
});
