// Import Express.js
const express = require("express");

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const accessToken = process.env.ACCESS_TOKEN;

const body = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1827756148173612",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "5555936196535",
              phone_number_id: "729388853599569",
            },
            contacts: [
              {
                profile: {
                  name: "Gabriel Oliveira",
                },
                wa_id: "554891075278",
              },
            ],
            messages: [
              {
                from: "554891075278",
                id: "wamid.HBgMNTU0ODkxMDc1Mjc4FQIAEhgUM0EwQzlBOEFGMDFBRTUxNENCMTAA",
                timestamp: "1756780544",
                text: {
                  body: "Opa",
                },
                type: "text",
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

// Route for GET requests
app.get("/", (req, res) => {
  const {
    "hub.mode": mode,
    "hub.challenge": challenge,
    "hub.verify_token": token,
  } = req.query;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("WEBHOOK VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post("/", (req, res) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  console.log(`\n\nWebhook received ${timestamp}\n`);

  const phoneNumber = "5548991075278";

  fetch(`https://graph.facebook.com/v22.0/729388853599569/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    },
  })
    .then((res) => res.json())
    .then((data) => console.log(data));

  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
