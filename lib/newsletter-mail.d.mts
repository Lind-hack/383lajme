export type EncryptedNewsletterMail = {iv: string; ciphertext: string; tag: string};
export function encryptNewsletterMail(message: unknown, secret: string, id: string): EncryptedNewsletterMail;
export function decryptNewsletterMail(payload: EncryptedNewsletterMail, secret: string, id: string): unknown;
