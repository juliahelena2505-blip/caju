import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBYkhEXqSLXNx8-dwNPmDFnzUOKct6jS0I",
  authDomain: "caju-crm.firebaseapp.com",
  projectId: "caju-crm",
  storageBucket: "caju-crm.firebasestorage.app",
  messagingSenderId: "6465831387",
  appId: "1:6465831387:web:38aa5fff87c5f0e66da7fe",
  measurementId: "G-QT156PNW27"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
