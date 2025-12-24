/* eslint-disable @typescript-eslint/no-require-imports */
const { ServerClient } = require('postmark');

async function main() {
  const serverToken = process.env.POSTMARK_API_TOKEN || process.argv[2];

  if (!serverToken) {
    console.error('Error: Provide your Postmark server token via POSTMARK_API_TOKEN or as the first argument.');
    console.error('Example: POSTMARK_API_TOKEN=your-token node scripts/send-test-email.js');
    process.exit(1);
  }

  const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'nathan@chemirl.app';
  const toEmail = process.env.POSTMARK_TEST_TO || fromEmail;

  const client = new ServerClient(serverToken);

  try {
    const result = await client.sendEmail({
      From: fromEmail,
      To: toEmail,
      Subject: 'Hello from Postmark',
      HtmlBody: '<strong>Hello</strong> from Chem IRL via Postmark.',
      TextBody: 'Hello from Chem IRL via Postmark!',
      MessageStream: 'outbound',
    });

    console.log('Email sent successfully:', result.MessageID);
  } catch (error) {
    console.error('Postmark error:', error);
    process.exit(1);
  }
}

main();
