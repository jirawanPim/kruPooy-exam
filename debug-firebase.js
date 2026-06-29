// Debug script to check Firebase data structure
import { db } from './src/firebase.js';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

async function debugFirebase() {
  try {
    console.log('🔍 Debugging Firebase data structure...');
    
    // Check if we can access exam_results collection
    const examResultsQuery = collection(db, 'exam_results');
    const examResultsSnap = await getDocs(examResultsQuery);
    
    console.log('📊 exam_results collection:', {
      size: examResultsSnap.size,
      empty: examResultsSnap.empty
    });
    
    if (examResultsSnap.size > 0) {
      examResultsSnap.docs.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, {
          id: doc.id,
          data: doc.data(),
          exists: doc.exists()
        });
      });
    } else {
      console.log('❌ No documents found in exam_results collection');
    }
    
  } catch (error) {
    console.error('❌ Firebase debug error:', error);
  }
}

debugFirebase();
