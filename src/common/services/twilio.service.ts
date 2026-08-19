import twilio from 'twilio';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

export class TwilioService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;
  private messagingServiceSid: string | null = null;

  constructor() {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && !accountSid.startsWith('your_')) {
      try {
        this.client = twilio(accountSid, authToken);
        this.fromNumber = env.TWILIO_PHONE_NUMBER || null;
        this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID || null;
        logger.info({ msg: 'Twilio SMS client initialized successfully' });
      } catch (err) {
        logger.error({ msg: 'Failed to initialize Twilio client', error: err });
      }
    } else {
      logger.info({ msg: 'Twilio credentials not set or in test mode. SMS will be logged to console/logger.' });
    }
  }

  /**
   * Send an OTP SMS to a customer
   */
  async sendServiceOtpSms(params: {
    toPhone: string;
    customerName: string;
    barberName: string;
    otp: string;
    serviceName: string;
    bookingNumber: string;
  }): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> {
    const { toPhone, customerName, barberName, otp, serviceName, bookingNumber } = params;

    const body = `[AURA STUDIO] Hello ${customerName}, your barber ${barberName} has arrived for your booking #${bookingNumber} (${serviceName}). Your Service Verification OTP is: ${otp}. Please provide this OTP to your barber to start the service. Valid for 30 mins.`;

    if (this.client && (this.fromNumber || this.messagingServiceSid)) {
      try {
        const message = await this.client.messages.create({
          body,
          to: toPhone,
          ...(this.messagingServiceSid
            ? { messagingServiceSid: this.messagingServiceSid }
            : { from: this.fromNumber! }),
        });

        logger.info({
          msg: 'Twilio SMS sent successfully',
          sid: message.sid,
          to: toPhone,
          bookingNumber,
        });

        return { success: true, messageId: message.sid };
      } catch (err: any) {
        logger.error({
          msg: 'Twilio SMS failed to dispatch',
          error: err?.message || err,
          to: toPhone,
        });
        // Return simulated success so the flow does not break if Twilio balance/number is test
        return { success: false, simulated: true };
      }
    } else {
      // Development / Mock mode
      logger.info({
        msg: '📱 [TWILIO INFORM FLOW SIMULATION]',
        recipient: toPhone,
        customer: customerName,
        barber: barberName,
        otp,
        smsBody: body,
      });
      console.log(`\n======================================================`);
      console.log(`📱 [TWILIO SMS OUTBOUND DISPATCH]`);
      console.log(`To: ${toPhone} (${customerName})`);
      console.log(`Message: ${body}`);
      console.log(`======================================================\n`);
      return { success: true, simulated: true };
    }
  }

  /**
   * Send service started confirmation SMS
   */
  async sendServiceStartedSms(params: {
    toPhone: string;
    customerName: string;
    barberName: string;
    serviceName: string;
    bookingNumber: string;
  }): Promise<void> {
    const { toPhone, customerName, barberName, serviceName, bookingNumber } = params;
    const body = `[AURA STUDIO] Hi ${customerName}, OTP verified! Your ${serviceName} service with ${barberName} for booking #${bookingNumber} is now IN PROGRESS. Enjoy your session!`;

    if (this.client && (this.fromNumber || this.messagingServiceSid)) {
      try {
        await this.client.messages.create({
          body,
          to: toPhone,
          ...(this.messagingServiceSid
            ? { messagingServiceSid: this.messagingServiceSid }
            : { from: this.fromNumber! }),
        });
      } catch (err) {
        logger.warn({ msg: 'Twilio service started notification failed', error: err });
      }
    } else {
      logger.info({ msg: '📱 [TWILIO SERVICE STARTED SMS]', recipient: toPhone, body });
    }
  }
}

export const twilioService = new TwilioService();
