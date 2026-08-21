import { authenticator } from 'otplib';

try {
  const url = authenticator.keyuri('', 'QPlatform Admin', 'NB4DIFTPPZQHSMCF');
  console.log('Success:', url);
} catch (e) {
  console.error('Error:', e);
}

try {
  const url = authenticator.keyuri(' ', 'QPlatform Admin', 'NB4DIFTPPZQHSMCF');
  console.log('Success:', url);
} catch (e) {
  console.error('Error:', e);
}
