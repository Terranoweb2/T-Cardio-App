// Patch script: Add Brevo API fallback to compiled email.service.js
const fs = require('fs');
const filePath = '/tmp/email.service.js.bak';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add axios import at the top (after "use strict")
if (!content.includes('axios_1')) {
  content = content.replace(
    '"use strict";',
    '"use strict";\nconst axios_1 = require("axios");'
  );
}

// 2. Add brevoApiKey, senderName, senderEmail to constructor
if (!content.includes('brevoApiKey')) {
  content = content.replace(
    'this.isConfigured = !!this.smtpHost;',
    `this.brevoApiKey = this.configService.get('BREVO_API_KEY') || '';
        this.senderName = this.configService.get('EMAIL_SENDER_NAME') || 'T-Cardio Pro';
        this.senderEmail = this.configService.get('EMAIL_SENDER_EMAIL') || 'noreply@t-cardio.com';
        this.isConfigured = !!this.smtpHost || !!this.brevoApiKey;`
  );
}

// 3. Add sendViaBrevoApi method and fallback logic
// Find the last "return false;" in sendEmailWithAttachment and add Brevo fallback before it
const marker = `this.logger.error(\`Email FAILED after`;
if (content.includes(marker) && !content.includes('sendViaBrevoApi')) {
  // Add fallback after the SMTP retry loop
  content = content.replace(
    /(\s+return false;\s+\})\s*(\/\*\*\s*\n\s+\* Send an email using an HTML template)/,
    `$1
    // ── Fallback: Brevo API (HTTPS port 443) ──
    async sendViaBrevoApi(to, subject, html, attachments) {
        try {
            const payload = {
                sender: { name: this.senderName, email: this.senderEmail },
                to: [{ email: to }],
                subject,
                htmlContent: html,
            };
            if (attachments && attachments.length > 0) {
                payload.attachment = attachments.map((a) => ({
                    name: a.filename,
                    content: a.content.toString('base64'),
                }));
            }
            const response = await axios_1.default.post('https://api.brevo.com/v3/smtp/email', payload, {
                headers: { 'api-key': this.brevoApiKey, 'Content-Type': 'application/json' },
                timeout: 30000,
            });
            this.logger.log(\`Email sent via Brevo API: to=\${to}, subject="\${subject}", messageId=\${(response.data && response.data.messageId) || 'ok'}\`);
            return true;
        } catch (err) {
            this.logger.error(\`Brevo API email FAILED: to=\${to} — \${err.message || err}\`);
            return false;
        }
    }
    $2`
  );

  // Add the Brevo fallback call before the final "return false" in sendEmailWithAttachment
  content = content.replace(
    `this.logger.error(\`Email FAILED after \${this.maxRetries} attempts: to=\${to}, subject="\${subject}"\`);`,
    `this.logger.error(\`Email SMTP FAILED after \${this.maxRetries} attempts: to=\${to}, subject="\${subject}"\`);`
  );

  // Find the return false right after the retry loop and add Brevo check
  const retryEnd = 'Email SMTP FAILED after';
  const idx = content.indexOf(retryEnd);
  if (idx > 0) {
    // Find the next "return false;" after the error log
    const afterError = content.indexOf('return false;', idx);
    if (afterError > 0) {
      content = content.substring(0, afterError) +
        `// Brevo API fallback
        if (this.brevoApiKey) {
            return this.sendViaBrevoApi(to, subject, html, attachments);
        }
        ` + content.substring(afterError);
    }
  }
}

fs.writeFileSync('/tmp/email.service.patched.js', content);
console.log('Patched successfully');
console.log('Has axios:', content.includes('axios_1'));
console.log('Has brevoApiKey:', content.includes('brevoApiKey'));
console.log('Has sendViaBrevoApi:', content.includes('sendViaBrevoApi'));
