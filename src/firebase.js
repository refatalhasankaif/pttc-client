import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web SDK config for pttc-57f20 project
const firebaseConfig = {
  apiKey: "AIzaSyB05grbr-aC38cIkar3B2eByfEIn02wQZA",
  authDomain: "pttc-57f20.firebaseapp.com",
  databaseURL: "https://pttc-57f20-default-rtdb.firebaseio.com",
  projectId: "pttc-57f20",
  storageBucket: "pttc-57f20.firebasestorage.app",
  messagingSenderId: "419940447752",
  appId: "1:419940447752:web:e8a9a3264e9cf7d717c3bd",
  measurementId: "G-JTY5GXXLDM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
