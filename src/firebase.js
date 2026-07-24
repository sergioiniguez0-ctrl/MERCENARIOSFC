import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKwEgg6yIaY0hutMBL7iqGnUuKW8sC9dQ",
  authDomain: "mercenariosfc.firebaseapp.com",
  projectId: "mercenariosfc",
  storageBucket: "mercenariosfc.firebasestorage.app",
  messagingSenderId: "608919791470",
  appId: "1:608919791470:web:689767162d45a0557bc37f"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);