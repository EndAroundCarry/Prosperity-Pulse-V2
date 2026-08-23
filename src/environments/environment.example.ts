// Copy this file to environment.ts (and environment.prod.ts) and fill in
// real values. The environment files are gitignored; only this example is
// committed so a fresh clone builds.
//
// The Alpha Vantage key ships in the client bundle and is readable in
// DevTools — rotate it if it has ever been committed or deployed.
export const environment = {
  production: false,
  alphaVantageKey: 'YOUR_ALPHA_VANTAGE_KEY',
  firebaseConfig: {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000000000'
  },
  disableAuth: false
};
