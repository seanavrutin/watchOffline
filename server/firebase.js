const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  const path = require('path');
  serviceAccount = require(path.resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore('watch-offline');

module.exports = { admin, db };
