/* ==========================================================================
   SIREC - Servicio de Correo Electrónico (emailService.js)
   Envío de correos con Nodemailer + Gmail
   ========================================================================== */

const nodemailer = require('nodemailer');

// Crear el transporter con Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

/**
 * Envía un correo con la contraseña provisional.
 * @param {string} destinatario - Email del destinatario
 * @param {string} nombre - Nombre del usuario
 * @param {string} claveProvisional - La clave generada
 * @returns {Promise<object>} - Info del envío
 */
async function enviarClaveProvisional(destinatario, nombre, claveProvisional) {
  const mailOptions = {
    from: `"Clínica San Rafael - SIREC" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: '🔐 Recuperación de Contraseña — SIREC Clínica San Rafael',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px 28px; text-align: center;">
          <h1 style="color: #fff; font-size: 22px; margin: 0 0 6px 0; font-weight: 700;">Clínica Médica San Rafael</h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">Sistema de Registro y Control de Citas (SIREC)</p>
        </div>
        <div style="padding: 32px 28px;">
          <p style="color: #334155; font-size: 15px; line-height: 1.7;">
            Hola <strong>${nombre}</strong>,
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            Hemos recibido una solicitud para restablecer tu contraseña. Tu nueva <strong>contraseña provisional</strong> es:
          </p>
          <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: 'Courier New', monospace; font-size: 28px; font-weight: 800; color: #fff; letter-spacing: 4px;">${claveProvisional}</span>
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.7;">
            Al iniciar sesión con esta clave, el sistema te pedirá que <strong>establezcas una nueva contraseña</strong> por seguridad.
          </p>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
            <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 600;">
              ⚠️ Si tú no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá funcionando solo si no usas esta clave provisional.
            </p>
          </div>
        </div>
        <div style="background: #f1f5f9; padding: 16px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © 2026 Clínica Médica San Rafael — San Pedro Sula, Honduras
          </p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SIREC EMAIL] Correo enviado a ${destinatario}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('[SIREC EMAIL] Error enviando correo:', error.message);
    throw error;
  }
}

/**
 * Genera una contraseña provisional aleatoria de 6 caracteres alfanuméricos.
 * @returns {string}
 */
function generarClaveProvisional() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let clave = '';
  for (let i = 0; i < 6; i++) {
    clave += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return clave;
}

module.exports = {
  enviarClaveProvisional,
  generarClaveProvisional
};
