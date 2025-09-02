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

// Function to send WhatsApp message
async function sendWhatsAppMessage(
  phoneNumber,
  messageType = "template",
  templateData = null,
  textMessage = null
) {
  const phoneNumberId = "729388853599569"; // From your existing code
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  let messageBody;

  if (messageType === "template") {
    messageBody = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: templateData || {
        name: "hello_world",
        language: {
          code: "en_US",
        },
      },
    };
  } else if (messageType === "text") {
    messageBody = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: {
        body: textMessage,
      },
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error sending message:", data);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    throw error;
  }
}

// Route for POST requests
app.post("/", async (req, res) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  console.log(`\n\nWebhook received ${timestamp}\n`);

  const phoneNumber = "5548991075278";

  try {
    // Send a template message (like your curl example)
    await sendWhatsAppMessage(phoneNumber, "template");

    // Or send a text message instead:
    // await sendWhatsAppMessage(phoneNumber, 'text', null, 'Hello from your bot!');
  } catch (error) {
    console.error("Error in webhook handler:", error);
  }

  res.status(200).end();
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
