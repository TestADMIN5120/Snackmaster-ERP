// E2E test for the product-images API: spawns the backend, signs in as the
// seeded super admin, uploads a 1x1 PNG, verifies the static URL + Firestore,
// then deletes and verifies cleanup.
const cp = require('child_process');
const fs = require('fs');

const ROOT = 'C:/Users/Dell/OneDrive/Desktop/SnackMaster/Snackmaster-ERP-main';
const admin = require(ROOT + '/backend/node_modules/firebase-admin');
const sa = require(ROOT + '/backend/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const API = 'http://localhost:5099/api';
const API_KEY = 'AIzaSyALIjjrTfaBgW1zRp97wydMZbLP2rl3dV4';

(async () => {
  const server = cp.spawn(process.execPath, [ROOT + '/backend/index.js'], { stdio: "ignore", env: Object.assign({}, process.env, { PORT: "5099" }) });
  await new Promise(r => setTimeout(r, 3500));
  let failed = false;
  try {
    const login = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vdsplsuper@gmail.com', password: 'SuperMaster123', returnSecureToken: true })
    });
    const lj = await login.json();
    if (!lj.idToken) throw new Error('LOGIN FAILED: ' + JSON.stringify(lj.error || lj));
    console.log('1. LOGIN OK as super admin');

    const snap = await db.collection('master_products').limit(1).get();
    if (snap.empty) throw new Error('No master_products docs exist to test with');
    const pid = snap.docs[0].id;
    console.log('2. TEST PRODUCT:', pid, '-', snap.docs[0].data().name);

    const noauth = await fetch(API + '/product-images/' + pid, { method: 'POST' });
    console.log('3. NO-AUTH upload rejected with status', noauth.status, noauth.status === 401 ? 'OK' : 'FAIL');
    if (noauth.status !== 401) failed = true;

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('image', new Blob([png], { type: 'image/png' }), 'test.png');
    const up = await fetch(API + '/product-images/' + pid, {
      method: 'POST', headers: { Authorization: 'Bearer ' + lj.idToken }, body: fd
    });
    const uj = await up.json();
    console.log('4. UPLOAD status', up.status, JSON.stringify(uj));
    if (!uj.imageUrl) throw new Error('upload did not return imageUrl');

    const img = await fetch('http://localhost:5099' + uj.imageUrl);
    const bytes = (await img.arrayBuffer()).byteLength;
    console.log('5. STATIC URL GET status', img.status, img.headers.get('content-type'), bytes + ' bytes', (img.status === 200 && bytes === png.length) ? 'OK' : 'FAIL');
    if (img.status !== 200 || bytes !== png.length) failed = true;

    const doc1 = await db.collection('master_products').doc(pid).get();
    console.log('6. FIRESTORE imageUrl =', doc1.data().imageUrl, doc1.data().imageUrl === uj.imageUrl ? 'OK' : 'FAIL');
    if (doc1.data().imageUrl !== uj.imageUrl) failed = true;

    const del = await fetch(API + '/product-images/' + pid, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + lj.idToken }
    });
    console.log('7. DELETE status', del.status, JSON.stringify(await del.json()));

    const doc2 = await db.collection('master_products').doc(pid).get();
    const leftover = fs.readdirSync(ROOT + '/product_images').filter(f => f !== '.gitkeep');
    console.log('8. AFTER DELETE: firestore imageUrl =', doc2.data().imageUrl, '| files left:', leftover.length ? leftover.join(',') : '(none)',
      (doc2.data().imageUrl === undefined && leftover.length === 0) ? 'OK' : 'FAIL');
    if (doc2.data().imageUrl !== undefined || leftover.length !== 0) failed = true;

    console.log(failed ? 'RESULT: SOME CHECKS FAILED' : 'RESULT: ALL CHECKS PASSED');
  } catch (e) {
    console.error('TEST ERROR:', e.message);
    failed = true;
  } finally {
    server.kill();
    process.exit(failed ? 1 : 0);
  }
})();
