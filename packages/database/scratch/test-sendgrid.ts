import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const apiKey = process.env.TWILIO_SENDGRID_API_KEY;
const from = process.env.TWILIO_SENDGRID_FROM_EMAIL || 'parsasamandizadeh@gmail.com';

async function main() {
  if (!apiKey) {
    console.error('No API key found in .env');
    return;
  }

  console.log(`Using API key: ${apiKey.substring(0, 5)}...`);
  sgMail.setApiKey(apiKey);

  const msg = {
    to: 'parsa.barcaa@gmail.com',
    from,
    subject: 'Test Email from Antigravity',
    text: 'If you receive this, the SendGrid API key in your .env file is working!',
  };

  try {
    const [response] = await sgMail.send(msg);
    console.log('Response status:', response.statusCode);
    console.log('Response headers:', response.headers);
    console.log('Test email sent successfully!');
  } catch (error: any) {
    console.error('Error sending test email:');
    if (error.response) {
      console.error(JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

main();
