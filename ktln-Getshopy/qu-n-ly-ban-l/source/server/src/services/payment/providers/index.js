/**
 * Sổ đăng ký nhà cung cấp thanh toán.
 *
 * Mỗi adapter phải có:
 *   name    : string
 *   verify(req)  -> { ok: boolean, reason?: string }
 *   parse(body)  -> { providerTxnId, amount, content, bankAccount, isIncoming, occurredAt }
 *
 * Thêm Casso/PayOS sau chỉ cần viết thêm một file và đăng ký ở đây — logic đối
 * soát trong webhookService không phải đổi.
 */
const sepay = require('./sepay');
const simulator = require('./simulator');

const PROVIDERS = { sepay, simulator };

function getProvider(name) {
  return PROVIDERS[String(name || '').toLowerCase()] || null;
}

module.exports = { getProvider, PROVIDERS };
