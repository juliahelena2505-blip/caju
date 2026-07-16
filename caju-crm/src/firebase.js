import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'

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

// Traz todos os leads do Firestore
export async function loadLeadsFromFirebase() {
  try {
    const leadsCol = collection(db, 'leads')
    const snapshot = await getDocs(leadsCol)
    const leads = []
    snapshot.forEach((doc) => {
      leads.push({ id: doc.id, ...doc.data() })
    })
    return leads
  } catch (e) {
    console.error('Erro ao carregar leads do Firebase:', e)
    return []
  }
}

// Salva um lead no Firestore
export async function saveLead(lead) {
  try {
    await setDoc(doc(db, 'leads', lead.id), lead)
  } catch (e) {
    console.error('Erro ao salvar lead:', e)
  }
}

// Salva todos os leads (batch)
export async function saveAllLeads(leads) {
  try {
    for (const lead of leads) {
      await setDoc(doc(db, 'leads', lead.id), lead)
    }
  } catch (e) {
    console.error('Erro ao salvar leads:', e)
  }
}
