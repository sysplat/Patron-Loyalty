import fetch from 'node-fetch';

async function main() {
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parsasamandizadeh@gmail.com', password: 'Password123!' }),
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);

  if (!loginData?.data?.accessToken) return;

  const impRes = await fetch('http://localhost:4000/api/v1/platform-admin/impersonation/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.data.accessToken}`,
    },
    body: JSON.stringify({ orgId: '00000000-0000-0000-0000-000000000000' }),
  });
  console.log('Impersonate:', await impRes.json());
}
main().catch(console.error);
