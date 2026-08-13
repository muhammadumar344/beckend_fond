// src/services/emailService.js — Brevo (Sendinblue) HTTP API orqali
const axios = require('axios')

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'

const brevoHeaders = {
  accept: 'application/json',
  'api-key': process.env.BREVO_API_KEY,
  'content-type': 'application/json',
}

const sendEmail = async ({ toEmail, toName, subject, htmlContent }) => {
  const payload = {
    sender: {
      name:  process.env.EMAIL_FROM_NAME || 'Lumo',
      email: process.env.EMAIL_FROM,
    },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    htmlContent,
  }

  const response = await axios.post(BREVO_URL, payload, { headers: brevoHeaders })
  return response.data
}

// ══ Ro'yxatdan o'tish — tasdiqlash kodi (YANGI) ══════════════════════════════
const sendVerificationCode = async ({ toEmail, name, code }) => {
  const subject = 'Lumo — Emailni tasdiqlash kodi'

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="uz">
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#111827;border-radius:12px;
                          border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

              <tr>
                <td style="background:linear-gradient(135deg,#f6ad55,#ed8936);
                            padding:28px 32px;">
                  <h1 style="margin:0;color:#0a0f1e;font-size:22px;font-weight:700;">
                    Lumo
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <h2 style="color:#f6ad55;margin:0 0 16px;font-size:20px;">
                    Salom, ${name}!
                  </h2>
                  <p style="color:#e2e8f0;line-height:1.6;margin:0 0 28px;">
                    Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting.
                    Kod <strong style="color:#a0aec0;">15 daqiqa</strong> amal qiladi.
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:8px 0 28px;">
                        <div style="background:#1a2035;border:1px solid rgba(246,173,85,0.3);
                                    border-radius:10px;padding:20px 32px;display:inline-block;">
                          <span style="font-family:monospace;font-size:34px;
                                       letter-spacing:10px;font-weight:800;color:#f6ad55;">
                            ${code}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#718096;font-size:13px;line-height:1.5;margin:0;text-align:center;">
                    Bu amalni siz boshlamagan bo'lsangiz, xabarni e'tiborsiz qoldiring.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.07);">
                  <p style="margin:0;color:#4a5568;font-size:12px;text-align:center;">
                    © Lumo &nbsp;•&nbsp; schoolfonds.uz
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({ toEmail, toName: name, subject, htmlContent })
}

// ══ Staff yaratilganda — kirish ma'lumotlari ═════════════════════════════════
const sendStaffWelcomeEmail = async ({
  toEmail,
  staffName,
  directorName,
  institutionName,
  tempPassword,
  verificationLink,
}) => {
  const subject = `${institutionName || 'Lumo'} — Xodim hisobi yaratildi`

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="uz">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0"
                   style="background:#111827;border-radius:12px;
                          border:1px solid rgba(255,255,255,0.07);
                          overflow:hidden;">

              <tr>
                <td style="background:linear-gradient(135deg,#f6ad55,#ed8936);
                            padding:28px 32px;">
                  <h1 style="margin:0;color:#0a0f1e;font-size:22px;font-weight:700;">
                    Lumo
                  </h1>
                  <p style="margin:6px 0 0;color:#0a0f1e;opacity:0.7;font-size:13px;">
                    O'quv markazi boshqaruv tizimi
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <h2 style="color:#f6ad55;margin:0 0 16px;font-size:20px;">
                    Xush kelibsiz, ${staffName}!
                  </h2>

                  <p style="color:#e2e8f0;line-height:1.6;margin:0 0 24px;">
                    <strong style="color:#f6ad55;">${directorName}</strong> tomonidan
                    <strong style="color:#f6ad55;">${institutionName}</strong>
                    platformasida sizga xodim hisobi yaratildi.
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0"
                         style="background:#1a2035;border-left:4px solid #4299e1;
                                border-radius:6px;margin:0 0 28px;">
                    <tr>
                      <td style="padding:20px 24px;">
                        <p style="margin:0 0 12px;color:#a0aec0;
                                  font-size:12px;letter-spacing:1px;
                                  text-transform:uppercase;font-weight:600;">
                          Kirish ma'lumotlari
                        </p>
                        <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px;">
                          📧 <strong>Email:</strong> ${toEmail}
                        </p>
                        <p style="margin:0;color:#e2e8f0;font-size:14px;">
                          🔑 <strong>Parol:</strong>
                          <span style="background:#2b6cb0;color:#ffffff;
                                       padding:6px 16px;border-radius:6px;
                                       font-family:monospace;font-size:16px;
                                       letter-spacing:3px;font-weight:700;
                                       display:inline-block;margin-left:8px;">
                            ${tempPassword}
                          </span>
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#a0aec0;font-size:14px;margin:0 0 20px;line-height:1.5;">
                    Hisobingizni faollashtirish va tizimga kirish uchun quyidagi
                    tugmani bosing:
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:4px 0 32px;">
                        <a href="${verificationLink}"
                           style="background:linear-gradient(135deg,#f6ad55,#ed8936);
                                  color:#0a0f1e;padding:14px 40px;
                                  text-decoration:none;border-radius:8px;
                                  font-weight:700;font-size:15px;
                                  display:inline-block;letter-spacing:0.3px;">
                          ✉️ &nbsp; Emailni Tasdiqlash
                        </a>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0"
                         style="background:#1a2035;border-radius:6px;
                                border:1px solid rgba(246,173,85,0.2);">
                    <tr>
                      <td style="padding:16px 20px;">
                        <p style="margin:0;color:#f6ad55;font-size:13px;font-weight:600;">
                          ⚠️ Muhim eslatma
                        </p>
                        <p style="margin:8px 0 0;color:#a0aec0;font-size:13px;line-height:1.5;">
                          Yuqoridagi parolni birinchi kirishda o'zgartirishingiz tavsiya qilinadi.
                          Havola <strong>24 soat</strong> amal qiladi.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.07);">
                  <p style="margin:0;color:#4a5568;font-size:12px;text-align:center;">
                    © Lumo &nbsp;•&nbsp;
                    <a href="${process.env.FRONTEND_URL}"
                       style="color:#718096;text-decoration:none;">
                      schoolfonds.uz
                    </a>
                    <br>
                    <span style="color:#2d3748;">
                      Bu xabar siz so'ramaganingizda yuborilgan bo'lsa, e'tiborsiz qoldiring.
                    </span>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({ toEmail, toName: staffName, subject, htmlContent })
}

// ══ Parol tiklash ═════════════════════════════════════════════════════════════
const sendPasswordResetEmail = async ({ toEmail, name, resetLink }) => {
  const subject = 'Lumo — Parolni tiklash'

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="uz">
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <table width="560" cellpadding="0" cellspacing="0"
                   style="background:#111827;border-radius:12px;
                          border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

              <tr>
                <td style="background:linear-gradient(135deg,#f6ad55,#ed8936);
                            padding:28px 32px;">
                  <h1 style="margin:0;color:#0a0f1e;font-size:22px;font-weight:700;">
                    Lumo
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">
                  <h2 style="color:#f6ad55;margin:0 0 16px;">Parolni tiklash</h2>
                  <p style="color:#e2e8f0;line-height:1.6;margin:0 0 24px;">
                    Salom, <strong>${name}</strong>!<br>
                    Parolni tiklash so'rovi qabul qilindi.
                    Quyidagi tugma orqali yangi parol o'rnating:
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:8px 0 32px;">
                        <a href="${resetLink}"
                           style="background:linear-gradient(135deg,#f6ad55,#ed8936);
                                  color:#0a0f1e;padding:14px 40px;
                                  text-decoration:none;border-radius:8px;
                                  font-weight:700;font-size:15px;display:inline-block;">
                          🔐 &nbsp; Parolni Tiklash
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color:#718096;font-size:13px;line-height:1.5;margin:0;">
                    Havola <strong style="color:#a0aec0;">24 soat</strong> amal qiladi.
                    Agar siz so'ramagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring —
                    parolingiz o'zgartirilmaydi.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.07);">
                  <p style="margin:0;color:#4a5568;font-size:12px;text-align:center;">
                    © Lumo &nbsp;•&nbsp; schoolfonds.uz
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  return sendEmail({ toEmail, toName: name, subject, htmlContent })
}

module.exports = {
  sendEmail,
  sendVerificationCode,
  sendStaffWelcomeEmail,
  sendPasswordResetEmail,
}