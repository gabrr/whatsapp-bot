import { config } from "../../utils/config";
import { logger } from "../../utils/logger";

export class WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.accessToken = config.whatsapp.accessToken;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
  }

  /**
   * Send text message via WhatsApp
   */
  async sendMessage(to: string, message: string): Promise<void> {
    const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: message,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        logger.error("Error sending WhatsApp message", null, {
          status: response.status,
          data,
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      logger.info("WhatsApp message sent", {
        to,
        messageId: data.messages?.[0]?.id,
      });
    } catch (error: any) {
      logger.error("Failed to send WhatsApp message", error, { to });
      throw error;
    }
  }

  /**
   * Parse incoming webhook message
   */
  parseWebhookMessage(
    body: any
  ): { from: string; message: string; messageId: string } | null {
    try {
      if (!body?.entry?.[0]?.changes?.[0]?.value?.messages) {
        return null;
      }

      const message = body.entry[0].changes[0].value.messages[0];

      if (message.type !== "text") {
        return null;
      }

      return {
        from: message.from,
        message: message.text.body,
        messageId: message.id,
      };
    } catch (error) {
      logger.error("Error parsing webhook message", error);
      return null;
    }
  }

  /**
   * Verify webhook token
   */
  verifyWebhook(
    mode: string,
    token: string,
    challenge: string
  ): { verified: boolean; challenge?: string } {
    if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
      logger.info("Webhook verified");
      return { verified: true, challenge };
    }

    logger.warn("Webhook verification failed", { mode, token });
    return { verified: false };
  }
}
