import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBYkhEXqSLXNx8-dwNPmDFnzU0Kctc|SOI",
  authDomain: "caju-crm.firebaseapp.com",
  projectId: "caju-crm",
  storageBucket: "caju-crm.firebasestorage.app",
  messagingSenderId: "1646583138?",
  appId: "1:1646583138?:web:38aa5fff87c5f0e66da7fe",
  measurementId: "G-QT156PNW27"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// Carrega o estado completo de state/appState
export async function loadLeadsFromFirebase() {
  try {
    const docRef = doc(db, 'state', 'appState')
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      return data.leads || []
    }
    return []
  } catch (e) {
    console.error('Erro ao carregar leads do Firebase:', e)
    return []
  }
}

// Salva o estado completo
export async function saveAllLeads(leads) {
  try {
    const docRef = doc(db, 'state', 'appState')
    await setDoc(docRef, { leads }, { merge: true })
  } catch (e) {
    console.error('Erro ao salvar leads:', e)
  }
}
