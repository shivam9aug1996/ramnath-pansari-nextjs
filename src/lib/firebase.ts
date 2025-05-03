import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDq_feRlxZrwc5L6EyetnWy7Cmk3356Lms",
  authDomain: "ramnath-pansari-6aea0.firebaseapp.com",
  projectId: "ramnath-pansari-6aea0",
  storageBucket: "ramnath-pansari-6aea0.firebasestorage.app",
  messagingSenderId: "930671228267",
  appId: "1:930671228267:web:bcb2200d2e6cf44a0b082e",
  measurementId: "G-Y1530HVENX",
  databaseURL: "https://ramnath-pansari-6aea0-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app); 