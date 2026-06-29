import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  LayoutDashboard, BookOpen, Users, Edit3, FolderOpen, 
  LogOut, ChevronLeft, Sparkles, Loader2, CheckCircle2,
  AlertCircle, Zap, Heart, Activity
} from 'lucide-react';
import Groq from 'groq-sdk';

const GradingQueue = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [room, setRoom] = useState(null);
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [currentProcessing, setCurrentProcessing] = useState(null);
  const [progressLog, setProgressLog] = useState([]);

  const BATCH_SIZE = 10;
  const MODELS = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (สมาร์ท)', speed: 'ช้า' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (เร็ว)', speed: 'รวดเร็ว' }
  ];

  // Groq client safety initialization
  const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
  let groq = null;
  if (groqApiKey && groqApiKey.trim() !== '') {
    try {
      groq = new Groq({ 
        apiKey: groqApiKey, 
        dangerouslyAllowBrowser: true 
      });
    } catch (e) {
      console.warn("❌ Groq client failed to initialize:", e);
    }
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/');
    });

    if (!roomId) return;
    
    // Fetch room
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), async (snap) => {
      if (!snap.exists()) { navigate('/dashboard'); return; }
      const roomData = snap.data();
      setRoom({ id: snap.id, ...roomData });
      
      // Fetch exam
      if (roomData.examId) {
        const examSnap = await getDoc(doc(db, 'exams', roomData.examId));
        if (examSnap.exists()) setExam(examSnap.data());
      }
      setLoading(false);
    });

    // Fetch students (using attendance subcollection)
    const unsubStudents = onSnapshot(collection(db, 'rooms', roomId, 'attendance'), (snap) => {
      const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => parseInt(a.studentNumber) - parseInt(b.studentNumber));
      
      // Filter: students who submitted and not yet graded (no subjectiveScores)
      const pendingGrading = allStudents.filter(s => 
        s.status === 'submitted' && (!s.subjectiveScores || Object.keys(s.subjectiveScores).length === 0)
      );
      
      setStudents(allStudents);
      setTotalToProcess(pendingGrading.length);
    });

    return () => { unsubAuth(); unsubRoom(); unsubStudents(); };
  }, [roomId, navigate]);

  // Grade a single student
  const gradeStudent = async (student, exam) => {
    if (!exam) return null;
    
    if (!groq) {
      addLog(`❌ ไม่พบ Groq API Key, ไม่สามารถตรวจของ ${student.name} ได้`);
      return null;
    }
    
    const subjectiveQuestions = exam.questions.filter(q => q.type === 'subjective');
    if (subjectiveQuestions.length === 0) {
      addLog(`ℹ️ ไม่มีข้ออัตนัยสำหรับ ${student.name}`);
      return {};
    }
    
    const scores = {};
    
    for (let i = 0; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      
      if (q.type === 'subjective') {
        const studentAnswer = student.answers?.[i] || '(ไม่มีคำตอบ)';
        
        // Build rubric text from criteria
        const rubricText = (q.rubrics || [])
          .map(r => `- ${r.criteria}: ${r.points} คะแนน`)
          .join('\n');
        
        const maxScore = q.maxScore || q.points || 10;
        const prompt = `โจทย์: "${q.question}"
คำตอบนักเรียน: "${studentAnswer}"

เกณฑ์การให้คะแนน:
${rubricText}

ให้คะแนนคำตอบนี้ตามเกณฑ์ (ระหว่าง 0 ถึง ${maxScore})
ตอบเป็นตัวเลขจำนวนเต็มเท่านั้น โดยไม่มีคำอธิบายหรือข้อความเพิ่มเติม`;
        
        try {
          console.log(`[Groq] Sending request for Q${i + 1} with model: ${selectedModel}`);
          addLog(`⏳ เรียก Groq API สำหรับข้อที่ ${i + 1}...`);
          
          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: selectedModel,
            temperature: 0.3,
            max_tokens: 50
          });
          
          const rawScore = completion.choices[0].message.content.trim();
          console.log(`[Groq] Response: "${rawScore}"`);
          
          const score = Math.min(parseInt(rawScore) || 0, maxScore);
          scores[i] = Math.max(0, score); // Ensure non-negative
          
          addLog(`✓ ข้อที่ ${i + 1}: ${scores[i]} คะแนน (ตัวเลข: "${rawScore}")`);
        } catch (err) {
          console.error(`[Groq Error] Q${i + 1}:`, err.message || err);
          addLog(`✗ ข้อที่ ${i + 1}: ${err.message || 'เกิดข้อผิดพลาด'}`);
          scores[i] = 0;
        }
      }
    }
    
    return scores;
  };

  const addLog = (message) => {
    setProgressLog(prev => [...prev, { msg: message, time: new Date().toLocaleTimeString() }]);
  };

  // Process batch (10 students at a time)
  const processBatch = async () => {
    if (!exam || !room) return;
    
    setIsProcessing(true);
    setProgressLog([]);
    addLog(`🚀 เริ่มตรวจ... (Model: ${MODELS.find(m => m.id === selectedModel)?.name})`);
    addLog(`📋 API Key: ${import.meta.env.VITE_GROQ_API_KEY ? '✅ มี' : '❌ ไม่มี'}`);
    
    // Get pending students
    const pendingStudents = students.filter(s => {
      const isPending = s.status === 'submitted' && (!s.subjectiveScores || Object.keys(s.subjectiveScores).length === 0);
      console.log(`[Filter] ${s.name}: status=${s.status}, pending=${isPending}`);
      return isPending;
    });
    
    addLog(`📋 พบนักเรียนรอตรวจ: ${pendingStudents.length} คน`);
    if (pendingStudents.length === 0) {
      addLog(`⚠️ ไม่มีนักเรียนที่รอตรวจ`);
      setIsProcessing(false);
      return;
    }
    
    // Process in batches of 10
    for (let batchIdx = 0; batchIdx < pendingStudents.length; batchIdx += BATCH_SIZE) {
      const batch = pendingStudents.slice(batchIdx, batchIdx + BATCH_SIZE);
      addLog(`\n📦 แบทช์ที่ ${Math.floor(batchIdx / BATCH_SIZE) + 1} (${batch.length} คน)`);
      
      for (const student of batch) {
        setCurrentProcessing(student);
        addLog(`👤 ตรวจ: ${student.name}`);
        
        try {
          const scores = await gradeStudent(student, exam);
          
          // Calculate total subjective score
          const totalSubScore = Object.values(scores).reduce((a, b) => a + b, 0);
          
          // Update Firestore
          await updateDoc(
            doc(db, 'rooms', roomId, 'attendance', student.id),
            {
              subjectiveScores: scores,
              subjectiveTotal: totalSubScore,
              aiGradedAt: new Date().toISOString()
            }
          );
          
          setProcessedCount(prev => prev + 1);
          addLog(`✅ บันทึกเสร็จ (รวม: ${totalSubScore})`);
        } catch (err) {
          console.error('Error updating student:', err);
          addLog(`❌ ล้มเหลว: ${student.name}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Delay between batches
      if (batchIdx + BATCH_SIZE < pendingStudents.length) {
        addLog(`⏸️ รอ 3 วินาที ก่อนแบทช์ถัดไป...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    addLog(`\n🎉 ตรวจเสร็จสิ้น! กรุณาเรีเฟรชหน้า`);
    setIsProcessing(false);
    setCurrentProcessing(null);
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'แผงควบคุมหลัก', path: '/dashboard' },
    { icon: FolderOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบใหม่', path: '/exam-editor' },
    { icon: Users, label: 'จัดการห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

  if (loading) return (
    <div className="h-screen flex items-center justify-center font-black text-orange-500 italic">
      กำลังโหลด...
    </div>
  );

  const pendingCount = students.filter(s => 
    s.status === 'submitted' && (!s.subjectiveScores || Object.keys(s.subjectiveScores).length === 0)
  ).length;

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-72 h-full bg-white border-r border-slate-100 flex flex-col z-20 shadow-xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-orange-100 overflow-hidden bg-white flex items-center justify-center shadow-md">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-xl italic tracking-tighter text-slate-800 uppercase">SmartExam</span>
          </div>
          <nav className="space-y-1.5">
            {menuItems.map((item) => (
              <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black transition-all ${location.pathname.includes(item.path) ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'text-slate-400 hover:bg-orange-50 hover:text-orange-500'}`}>
                <item.icon size={20} /> <span className="text-xs uppercase tracking-tighter">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-50 flex flex-col gap-4">
           <button onClick={() => { signOut(auth); navigate('/'); }} className="w-full text-red-400 font-black text-[10px] uppercase tracking-[3px] py-2 hover:text-red-600 transition-colors italic text-center">ออกจากระบบ</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-slate-50/50">
        <header className="h-24 w-full bg-white border-b flex items-center justify-between px-10 z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <button onClick={() => navigate(-1)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:text-orange-600 transition-all shadow-sm"><ChevronLeft size={24} /></button>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black text-orange-500 uppercase tracking-[3px] mb-1 italic"><Sparkles size={14} /> AI Grading Queue</div>
              <h2 className="font-black text-2xl text-slate-800 tracking-tighter uppercase italic">{room?.examTitle}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-black text-orange-500">{pendingCount}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">รอตรวจ</div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 flex gap-8">
          
          {/* Left: Control Panel */}
          <div className="w-96 flex flex-col gap-6">
            
            {/* Model Selection */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 uppercase text-sm tracking-wide">เลือก Model</h3>
              <div className="space-y-2">
                {MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => !isProcessing && setSelectedModel(model.id)}
                    disabled={isProcessing}
                    className={`w-full p-4 rounded-xl text-left border-2 transition-all ${
                      selectedModel === model.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-100 bg-white hover:border-orange-200'
                    } ${isProcessing ? 'opacity-50' : ''}`}
                  >
                    <div className="font-black text-sm text-slate-800">{model.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold">ความเร็ว: {model.speed}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 uppercase text-sm tracking-wide">สถานะ</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600 text-sm">รอตรวจ:</span>
                  <span className="font-black text-orange-500">{pendingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-600 text-sm">ตรวจสำเร็จ:</span>
                  <span className="font-black text-green-500">{processedCount}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${totalToProcess > 0 ? (processedCount / totalToProcess) * 100 : 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="text-center text-xs font-bold text-slate-500">
                  {processedCount} / {totalToProcess}
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!groq ? (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 mb-3">
                <div className="flex gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs font-bold text-red-700 leading-relaxed text-left">
                    ⚠️ ไม่พบการตั้งค่า <strong>VITE_GROQ_API_KEY</strong> ใน Environment variables!<br />
                    กรุณาตั้งค่าคีย์ของคุณในระบบก่อนเริ่มดำเนินการตรวจข้อสอบด้วย AI
                  </div>
                </div>
              </div>
            ) : null}
            <button
              onClick={processBatch}
              disabled={isProcessing || pendingCount === 0 || !groq}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                isProcessing || !groq
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : pendingCount === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  กำลังตรวจ...
                </>
              ) : pendingCount === 0 ? (
                <>
                  <CheckCircle2 size={18} />
                  ตรวจเสร็จแล้ว
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  เริ่มตรวจอัตนัย
                </>
              )}
            </button>

            {/* Info Box */}
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <div className="flex gap-2">
                <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs font-bold text-blue-700">
                  ระบบจะตรวจ <strong>{BATCH_SIZE} คน</strong> ต่อแบทช์ และหยุด 3 วินาทีระหว่างแบทช์เพื่อหลีกเลี่ยง rate limiting
                </div>
              </div>
            </div>
          </div>

          {/* Right: Progress Log */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-black text-slate-800 uppercase text-sm tracking-wide">เอาต์พุต</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-xs space-y-1 scrollbar-hide">
              {progressLog.length === 0 ? (
                <div className="text-slate-300 font-bold text-center mt-8">รอการตรวจ...</div>
              ) : (
                progressLog.map((log, idx) => (
                  <div key={idx} className="text-slate-600">
                    <span className="text-slate-400">[{log.time}]</span> {log.msg}
                  </div>
                ))
              )}
              {currentProcessing && (
                <motion.div
                  animate={{ opacity: [0.5, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="text-orange-500 font-bold"
                >
                  🔄 ตรวจ: {currentProcessing.name}...
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 right-8 pointer-events-none opacity-50 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest italic">
           <Heart size={12} className="text-orange-400" /> Developed by KruKaw
        </div>
      </main>
    </div>
  );
};

export default GradingQueue;
