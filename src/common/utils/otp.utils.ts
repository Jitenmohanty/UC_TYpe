import crypto from 'crypto';

/**
 * Generate a cryptographically random 6-digit OTP
 */
export function generateOtp(): string {
  // Generate a random integer between 100000 and 999999
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
}

/**
 * Hash an OTP using SHA-256 for secure storage
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify a plaintext OTP against a SHA-256 hash using constant-time comparison
 */
export function verifyOtp(plainOtp: string, hashedOtp: string): boolean {
  const inputHash = hashOtp(plainOtp);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(hashedOtp, 'hex'),
    );
  } catch {
    return false;
  }
}
