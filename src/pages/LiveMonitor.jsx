import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { doc, onSnapshot, collection, updateDoc, deleteDoc, getDoc, serverTimestamp, query, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  LayoutDashboard, BookOpen, Users, Edit3, LogOut, 
  ShieldAlert, Timer, ChevronLeft, Trash2, Zap, Sparkles, 
  PlayCircle, StopCircle, CheckCircle2, AlertTriangle, UserX, FolderOpen,
  X, Save, RotateCcw, Star, Lock, Unlock, ChevronRight, Activity, ArrowUpDown
} from 'lucide-react';

const LiveMonitor = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editScores, setEditScores] = useState({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [sortBy, setSortBy] = useState('name'); // 'name', 'studentNumber'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [timeLeft, setTimeLeft] = useState(null); // Countdown timer in seconds

  // --- 1. Auth & Initial Data ---
  // Countdown Timer Effect
  useEffect(() => {
    if (room?.status !== 'started' || !room?.startTime || !room?.duration) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const startTime = room.startTime.toDate();
      const durationMs = room.duration * 60 * 1000; // Convert minutes to milliseconds
      const endTime = new Date(startTime.getTime() + durationMs);
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      return remaining;
    };

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    return () => clearInterval(timer);
  }, [room?.status, room?.startTime, room?.duration]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!roomId) return;

    // 1.1 ฟังข้อมูลห้องสอบ (Room Status)
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), async (snap) => {
      if (!snap.exists()) { navigate('/dashboard'); return; }
      const roomData = snap.data();
      setRoom({ id: snap.id, ...roomData });
      
      // ดึงข้อมูลข้อสอบ (Exam Content) ครั้งเดียว
      if (roomData.examId && !exam) {
        const examSnap = await getDoc(doc(db, 'exams', roomData.examId));
        if (examSnap.exists()) {
          const examData = examSnap.data();
          
          // Apply shuffling if enabled (same logic as ExamPage)
          if (roomData.randomizeQuestions || roomData.randomizeChoices) {
            const shuffledExam = { ...examData };
            
            // Shuffle question order
            if (roomData.randomizeQuestions) {
              const shuffleArray = (arr) => {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
              };
              shuffledExam.questions = shuffleArray(examData.questions);
            }
            
            // Shuffle choices within each question
            if (roomData.randomizeChoices) {
              const shuffleArray = (arr) => {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
              };
              shuffledExam.questions = shuffledExam.questions.map(q => {
                if (q.type === 'multiple' && q.options) {
                  // Create mapping of old index to new index for answer checking
                  const oldAnswerIndex = q.correctAnswer;
                  const optionsWithIndex = q.options.map((opt, idx) => ({ text: opt, originalIndex: idx }));
                  const shuffledWithIndex = shuffleArray(optionsWithIndex);
                  const newAnswerIndex = shuffledWithIndex.findIndex(item => item.originalIndex === oldAnswerIndex);
                  
                  return {
                    ...q,
                    options: shuffledWithIndex.map(item => item.text),
                    correctAnswer: newAnswerIndex
                  };
                }
                return q;
              });
            }
            
            setExam(shuffledExam);
          } else {
            setExam(examData);
          }
        }
      }
    });

    // 1.2 ฟังข้อมูลนักเรียน (Students Real-time)
    const unsubStudents = onSnapshot(collection(db, `rooms/${roomId}/attendance`), (snap) => {
      const studentData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentData);
      setLoading(false);
    });

    return () => { unsubRoom(); unsubStudents(); };
  }, [roomId, exam, navigate]);

  // --- 2. Actions ---
  const handleStartExam = async () => {
    if (window.confirm("ยืนยันการ 'เริ่มสอบ'? \nระบบจะเปิดให้นักเรียนทำข้อสอบทันที")) {
      await updateDoc(doc(db, 'rooms', roomId), { status: 'started', startTime: serverTimestamp() });
    }
  };

  const handleFinishExam = async () => {
    if (window.confirm("ยืนยันการ 'จบการสอบ'? \nนักเรียนทุกคนจะถูกบังคับส่งข้อสอบ")) {
      try {
        // 1. อัปเดตสถานะห้องเป็นจบการสอบ
        await updateDoc(doc(db, 'rooms', roomId), { 
          status: 'finished', 
          endTime: serverTimestamp(),
          archived: false // ไม่ archive ให้ยังคงข้อมูลไว้สำหรับ RoomResult
        });

        alert('✅ จบการสอบเรียบร้อยแล้ว!');
      } catch (error) {
        console.error('Error finishing exam:', error);
        alert('❌ เกิดข้อผิดพลาดในการจบการสอบ: ' + error.message);
      }
    }
  };

  const handleCloseAndSaveExam = async () => {
    if (window.confirm("ยืนยันการ 'ปิดและบันทึกผลสอบ'? \nห้องสอบจะถูกปิดและข้อมูลจะถูกบันทึกไปยังหน้าผลการสอบ")) {
      try {
        // 1. ดึงข้อมูลนักเรียนทั้งหมดเพื่อเก็บไปยัง RoomResult
        const attendanceQuery = query(collection(db, `rooms/${roomId}/attendance`));
        const attendanceSnap = await getDocs(attendanceQuery);
        const studentsData = attendanceSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 2. สร้างชื่อ collection ใหม่ตามโครงสร้าง: ชื่อข้อสอบ+วันที่จัดสอบ
        const safeTitle = exam?.title ? exam.title.replace(/[.#$/\[\]]/g, '') : 'Untitled';
        const examDate = new Date().toLocaleDateString('th-TH').replace(/\//g, '-');
        const collectionName = `${safeTitle}_${examDate}`; // ชื่อโฟลเดอร์แม่
        
        // 3. สร้างข้อมูลห้องสอบใน collection ใหม่
        const roomData = {
          roomId: roomId,
          examId: room.examId,
          examTitle: exam.title,
          targetClass: room.targetClass,
          roomCode: room.roomCode,
          finishedAt: serverTimestamp(),
          totalStudents: studentsData.length,
          submittedStudents: studentsData.filter(s => s.status === 'submitted').length,
          createdAt: room.createdAt,
          endTime: serverTimestamp()
        };

        // 4. สร้าง document หลักใน exam_results พร้อมข้อมูล
        const collectionRef = doc(db, 'exam_results', collectionName);
        await setDoc(collectionRef, {
          name: collectionName,
          subject: exam?.subject || '-',
          grade: exam?.grade || '-',
          createdAt: serverTimestamp() // ใส่เวลาที่สร้าง
        });

        // 5. บันทึกข้อมูลห้องสอบไปยัง subcollection 'rooms'
        const roomResultRef = doc(db, 'exam_results', collectionName, 'rooms', roomId);
        console.log('📍 DEBUG: Saving to path:', `exam_results/${collectionName}/rooms/${roomId}`);
        console.log('📍 DEBUG: Room data:', roomData);
        await setDoc(roomResultRef, roomData);

        // 6. บันทึกข้อมูลนักเรียนไปยัง subcollection 'students'
        console.log(`📍 DEBUG: Saving ${studentsData.length} students...`);
        for (const student of studentsData) {
          const studentRef = doc(db, 'exam_results', collectionName, 'rooms', roomId, 'students', student.id);
          console.log('📍 DEBUG: Saving student:', student.id, student.name);
          await setDoc(studentRef, student);
        }
        
        // DEBUG: ตรวจสอบว่าบันทึกสำเร็จจริงๆ
        console.log('📍 DEBUG: Verifying saved data...');
        const verifyRoom = await getDoc(roomResultRef);
        console.log('📍 DEBUG: Room saved successfully:', verifyRoom.exists());

        // 6. ลบห้องสอบจาก collection 'rooms' เพื่อไม่ให้โชว์ใน Dashboard
        await deleteDoc(doc(db, 'rooms', roomId));

        alert('✅ ปิดและบันทึกผลสอบเรียบร้อยแล้ว!');
        
        // 7. นำทางไปหน้า RoomResult
        navigate('/room-result');
      } catch (error) {
        console.error('Error closing and saving exam:', error);
        alert('❌ เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const handleToggleLock = async () => {
    const newLockStatus = !room?.isLocked;
    const confirmMsg = newLockStatus 
      ? "ยืนยันการล็อกห้อง? นักเรียนจะไม่สามารถเข้าห้องได้" 
      : "ยืนยันการปลดล็อกห้อง? นักเรียนสามารถเข้าห้องได้";
    
    if (window.confirm(confirmMsg)) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), { isLocked: newLockStatus });
      } catch (error) {
        console.error('Error toggling lock:', error);
        alert('❌ เกิดข้อผิดพลาด: ' + error.message);
      }
    }
  };

  const handleKickStudent = async (studentId, studentName) => {
    if (window.confirm(`ต้องการเชิญ '${studentName}' ออกจากการสอบหรือไม่?`)) {
      await updateDoc(doc(db, `rooms/${roomId}/attendance/${studentId}`), { status: 'kicked' });
    }
  };

  const handleDeleteRoom = async () => {
    if (window.confirm("⚠️ ลบห้องสอบนี้ถาวร? ข้อมูลทั้งหมดจะหายไป!")) {
      await deleteDoc(doc(db, 'rooms', roomId));
      navigate('/dashboard');
    }
  };

  // --- 3. Edit Subjective Scores ---
  const handleOpenScoreEditor = (student) => {
    setEditingStudent(student);
    setCurrentQuestionIdx(0);
    // เตรียมคะแนนอัตนัยจากคำตอบเดิม
    const initialScores = {};
    exam?.questions?.forEach((q, idx) => {
      if (q.type === 'subjective') {
        initialScores[idx] = student.subjectiveScores?.[idx] || 0;
      }
    });
    setEditScores(initialScores);
  };

  const handleSaveScores = async () => {
    if (!editingStudent) return;
    try {
      await updateDoc(doc(db, `rooms/${roomId}/attendance/${editingStudent.id}`), {
        subjectiveScores: editScores,
        scoredAt: serverTimestamp()
      });
      setEditingStudent(null);
      setEditScores({});
      alert('✅ บันทึกคะแนนสำเร็จ');
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('❌ เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleResetScores = () => {
    if (editingStudent) {
      const initialScores = {};
      exam?.questions?.forEach((q, idx) => {
        if (q.type === 'subjective') {
          initialScores[idx] = editingStudent.subjectiveScores?.[idx] || 0;
        }
      });
      setEditScores(initialScores);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(currentQuestionIdx - 1);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIdx < exam?.questions?.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    }
  };

  const goToQuestion = (idx) => {
    setCurrentQuestionIdx(idx);
  };

  // --- 4. Calculate Scores ---
  const calculateScores = (student) => {
    // Use the exam data that student actually saw (saved during submission)
    const examToCheck = student?.examData || exam;
    if (!examToCheck) return { mcScore: 0, subScore: 0, totalScore: 0, maxMc: 0, maxSub: 0, maxTotal: 0 };

    let mc = 0, maxMc = 0;
    let sub = 0, maxSub = 0;

    examToCheck.questions?.forEach((q, idx) => {
      if (q.type === 'multiple') {
        const maxScore = q.maxScore || 1;
        maxMc += maxScore;
        const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
        if (student?.answers?.[idx] === correctAnswer) {
          mc += maxScore;
        }
      } else {
        const maxScore = q.maxScore || q.points || 10;
        maxSub += maxScore;
        const stuSubScores = student?.subjectiveScores || {};
        sub += Number(stuSubScores[idx] || 0);
      }
    });

    const total = Math.round((mc + sub) * 100) / 100;
    return { 
      mcScore: mc, 
      subScore: sub, 
      totalScore: total, 
      maxMc, 
      maxSub, 
      maxTotal: maxMc + maxSub 
    };
  };

  // Stats Calculation
  const totalStudents = students.length;
  const submittedCount = students.filter(s => s.status === 'submitted').length;
  const onlineCount = students.filter(s => s.status === 'online').length;
  const cheatAlerts = students.filter(s => s.cheatCount > 0).length;

  // Sort function for students
  const sortStudents = (studentsArray) => {
    return [...studentsArray].sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB, 'th') : nameB.localeCompare(nameA, 'th');
      } else if (sortBy === 'studentNumber') {
        const numA = parseInt(a.studentNumber) || 0;
        const numB = parseInt(b.studentNumber) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      return 0;
    });
  };

  const sortedStudents = sortStudents(students);

  // Sidebar Items
  const menuItems = [
    { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
    { icon: FolderOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
    { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">กำลังโหลดข้อมูลห้องสอบ...</div>;

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 text-sm lg:flex lg:h-screen lg:overflow-hidden bg-slate-50/50">
      
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden bg-white border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-orange-100 bg-white flex items-center justify-center shadow-sm overflow-hidden">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-sm italic tracking-tighter text-slate-800 uppercase">SmartExam</span>
        </div>
        <button className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
          <Activity size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className="fixed lg:static inset-y-0 left-0 z-20 w-64 h-full bg-white border-r border-slate-100 flex flex-col shadow-xl transform -translate-x-full lg:translate-x-0 transition-transform duration-300">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-full border border-orange-100 bg-white flex items-center justify-center shadow-sm overflow-hidden">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-lg italic tracking-tighter text-slate-800 uppercase">SmartExam</span>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button 
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-all group"
              >
                <item.icon size={18} />
                <span className="text-xs italic uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-slate-50">
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 font-black text-[10px] hover:text-red-600 transition-colors uppercase tracking-[2px] hover:bg-red-50 rounded-lg"><LogOut size={14} /> ออกจากระบบ</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:h-full lg:flex lg:flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* Header & Controls */}
        <header className="h-auto lg:h-24 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 lg:px-8 z-10 sticky top-0 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
             <div className="flex items-center gap-3">
                <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
                <div>
                   <h2 className="font-black text-lg lg:text-2xl text-slate-800 tracking-tighter italic uppercase flex items-center gap-2">
                     ROOM: <span className="text-orange-500 text-xl lg:text-3xl font-mono">{room?.roomCode}</span>
                   </h2>
                   <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">วิชา: {room?.examTitle}</span>
                      <span className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">ห้อง: {room?.targetClass}</span>
                   </div>
                </div>
             </div>

             <div className="flex flex-col lg:flex-row items-center gap-3">
               {/* Status Indicator & Timer */}
               <div className={`px-3 lg:px-4 py-2 rounded-xl border flex items-center gap-2 font-black uppercase tracking-widest text-xs ${
                 room?.status === 'started' ? 'bg-green-50 border-green-200 text-green-600' : 
                 room?.status === 'finished' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                 'bg-orange-50 border-orange-200 text-orange-500'
               }`}>
                  {room?.status === 'started' ? <Timer size={16} className="animate-pulse"/> : 
                   room?.status === 'finished' ? <CheckCircle2 size={16} /> :
                   <Zap size={16} />}
                  {room?.status === 'started' ? 'กำลังสอบ' : 
                   room?.status === 'finished' ? 'สอบเสร็จสิ้น' :
                   'รอเริ่มสอบ'}
               </div>

               {/* Countdown Timer */}
               {room?.status === 'started' && timeLeft !== null && (
                 <div className="px-3 lg:px-4 py-2 rounded-xl border border-red-300 bg-red-50 flex items-center gap-2 font-black uppercase tracking-widest text-xs text-red-600">
                   <Timer size={16} className="animate-pulse" />
                   {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                 </div>
               )}

               {room?.status === 'started' && room?.isLocked && (
                 <div className="px-3 py-2 rounded-xl border border-red-300 bg-red-50 flex items-center gap-2 font-black uppercase tracking-widest text-xs text-red-600 animate-pulse">
                   <Lock size={14} /> ห้องล็อคแล้ว
                 </div>
               )}

               <div className="hidden lg:block h-8 w-[1px] bg-slate-200 mx-2"></div>

               {/* Action Buttons */}
               {room?.status === 'waiting' && (
                 <button onClick={handleStartExam} className="bg-green-500 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl font-black text-xs shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2 active:scale-95 italic uppercase tracking-wider">
                   <PlayCircle size={16} lg:size={18} /> เริ่มการสอบ
                 </button>
               )}
               
               {room?.status === 'started' && (
                 <div className="flex gap-2">
                   <button 
                     onClick={handleToggleLock} 
                     className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl font-black text-xs shadow-lg transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider ${
                       room?.isLocked 
                         ? 'bg-orange-500 text-white hover:bg-orange-600' 
                         : 'bg-slate-500 text-white hover:bg-slate-600'
                     }`}
                   >
                     {room?.isLocked ? (
                       <>
                         <Lock size={16} lg:size={18} /> ปลดล็อก
                       </>
                     ) : (
                       <>
                         <Unlock size={16} lg:size={18} /> ล็อก
                       </>
                     )}
                   </button>
                   <button onClick={handleFinishExam} className="bg-red-500 text-white px-3 lg:px-6 py-2 lg:py-3 rounded-xl font-black text-xs shadow-lg hover:bg-red-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider">
                     <StopCircle size={16} lg:size={18} /> จบการสอบ
                   </button>
                 </div>
               )}

               {room?.status === 'finished' && (
                 <div className="flex gap-2">
                   <button onClick={handleCloseAndSaveExam} className="bg-blue-500 text-white px-3 lg:px-6 py-2 lg:py-3 rounded-xl font-black text-xs shadow-lg hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider">
                     <Save size={16} lg:size={18} /> ปิดและบันทึกผลสอบ
                   </button>
                 </div>
               )}

               <button onClick={handleDeleteRoom} className="p-2 lg:p-3 text-slate-300 hover:text-red-500 bg-white border border-slate-100 rounded-xl transition-colors" title="ลบห้องสอบ"><Trash2 size={16} lg:size={18} /></button>
             </div>
          </div>
        </header>

        {/* Dashboard Stats */}
        <div className="p-4 lg:p-6 pb-0">
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div className="bg-white p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 lg:gap-4">
                 <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center"><Users size={16} lg:size={24}/></div>
                 <div><div className="text-lg lg:text-2xl font-black text-slate-800">{totalStudents}</div><div className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-wide">นักเรียนทั้งหมด</div></div>
              </div>
              <div className="bg-white p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 lg:gap-4">
                 <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-green-50 text-green-500 flex items-center justify-center"><CheckCircle2 size={16} lg:size={24}/></div>
                 <div><div className="text-lg lg:text-2xl font-black text-slate-800">{submittedCount}</div><div className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-wide">ส่งข้อสอบแล้ว</div></div>
              </div>
           </div>
        </div>
        <div className="p-4 lg:p-6">
          <div className="bg-white rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base lg:text-lg text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Users size={18} className="text-slate-400" /> รายชื่อนักเรียน
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSortBy('name')}
                    className={`text-xs font-black px-2 py-1 rounded ${sortBy === 'name' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}
                  >
                    ชื่อ {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => setSortBy('studentNumber')}
                    className={`text-xs font-black px-2 py-1 rounded ${sortBy === 'studentNumber' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}
                  >
                    เลขที่ {sortBy === 'studentNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[9px] lg:text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left">เลขที่</th>
                    <th className="px-4 lg:px-6 py-3 text-left">ชื่อ-นามสกุล</th>
                    <th className="px-4 lg:px-6 py-3 text-center">สถานะ</th>
                    <th className="px-4 lg:px-6 py-3 text-center">ความคืบหน้า</th>
                    <th className="px-4 lg:px-6 py-3 text-center">จำนวนทุจริต</th>
                    <th className="px-4 lg:px-6 py-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedStudents.map((student) => {
                    const progress = exam?.questions?.length > 0 
                      ? Math.round((Object.keys(student.answers || {}).length / exam.questions.length) * 100)
                      : 0;
                    
                    return (
                      <tr key={student.id} className="hover:bg-orange-50/50 transition-colors">
                        <td className="px-4 lg:px-6 py-3 lg:py-4 font-black text-slate-300 text-sm">{student.studentNumber}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 font-bold text-slate-700 text-sm">{student.name}</td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                          <span className={`text-[8px] lg:text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${
                            student.status === 'submitted' ? 'bg-green-50 text-green-600' :
                            student.status === 'online' ? 'bg-blue-50 text-blue-600' :
                            student.status === 'kicked' ? 'bg-red-50 text-red-600' :
                            'bg-slate-50 text-slate-400'
                          }`}>
                            {student.status === 'submitted' ? 'ส่งแล้ว' :
                             student.status === 'online' ? 'ออนไลน์' :
                             student.status === 'kicked' ? 'เชิญออก' :
                             'ออฟไลน์'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 lg:w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-orange-500 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-black text-slate-600">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                          {student.cheatCount > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <ShieldAlert size={12} className="text-red-500" />
                              <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-md">
                                {student.cheatCount}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-md">
                              0
                            </span>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleOpenScoreEditor(student)}
                              className="text-[8px] lg:text-[10px] font-black text-orange-400 border border-orange-200 px-2 py-1 rounded-md bg-white hover:bg-orange-500 hover:text-white transition-colors uppercase tracking-wide"
                            >
                              คะแนน
                            </button>
                            <button 
                              onClick={() => handleKickStudent(student.id, student.name)}
                              className="text-[8px] lg:text-[10px] font-black text-red-400 border border-red-200 px-2 py-1 rounded-md bg-white hover:bg-red-500 hover:text-white transition-colors uppercase tracking-wide"
                            >
                              เชิญออก
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedStudents.length === 0 && (
                <div className="text-center py-12 text-slate-300 font-bold italic">
                  ยังไม่มีนักเรียนเข้าห้องสอบ
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
        {editingStudent && exam && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white z-10">
                <div className="flex-1">
                  <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter mb-1">แก้ไขคะแนนอัตนัย</h3>
                  <p className="text-xs text-slate-400 font-bold mb-3">นักเรียน: <span className="text-slate-600 font-black">{editingStudent.name}</span></p>
                  
                  {/* Score Summary */}
                  {(() => {
                    const scores = calculateScores(editingStudent);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider mb-1">ปรนัย</p>
                          <p className="text-lg font-black text-blue-700">{scores.mcScore}</p>
                          <p className="text-[9px] text-blue-500">/ {scores.maxMc}</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-2">
                          <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider mb-1">อัตนัย</p>
                          <p className="text-lg font-black text-purple-700">{scores.subScore}</p>
                          <p className="text-[9px] text-purple-500">/ {scores.maxSub}</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-2">
                          <p className="text-[9px] font-black text-green-600 uppercase tracking-wider mb-1">รวม</p>
                          <p className="text-lg font-black text-green-700">{scores.totalScore}</p>
                          <p className="text-[9px] text-green-500">/ {scores.maxTotal}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <button 
                  onClick={() => setEditingStudent(null)} 
                  className="text-slate-300 hover:text-red-500 transition-colors p-2"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Content - Questions & Answers */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {exam.questions && exam.questions.length > 0 && (() => {
                  const qIdx = currentQuestionIdx;
                  const question = exam.questions[qIdx];
                  const studentAnswer = editingStudent.answers?.[qIdx];
                  const isSubjective = question.type === 'subjective';

                  return (
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                      {/* Question */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="text-xs font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-lg uppercase tracking-wider">
                            ข้อที่ {qIdx + 1}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${isSubjective ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isSubjective ? '📝 อัตนัย' : '🔘 ปรนัย'}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-3">{question.question}</p>

                        {/* Options for Multiple Choice */}
                        {!isSubjective && question.options && (
                          <div className="space-y-2 ml-3">
                            {question.options.map((opt, optIdx) => {
                              const isCorrect = optIdx === question.correctAnswer;
                              const isSelected = studentAnswer === optIdx;
                              return (
                                <div 
                                  key={optIdx}
                                  className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                                    isCorrect
                                      ? 'bg-green-50 border-green-300 text-green-700'
                                      : isSelected
                                        ? 'bg-red-50 border-red-300 text-red-700'
                                        : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <span className="inline-block w-6 h-6 mr-2 font-black text-center">{String.fromCharCode(65 + optIdx)}.</span>
                                  {opt}
                                  {isCorrect && <span className="ml-2 text-green-600">✓ เฉลย</span>}
                                  {isSelected && isCorrect && <span className="ml-2 text-green-600">(ถูกต้อง)</span>}
                                  {isSelected && !isCorrect && <span className="ml-2 text-red-600">(ผิด)</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Student Answer for Subjective */}
                      {isSubjective && (
                        <>
                          <div className="mb-4 p-3 bg-white border border-slate-300 rounded-lg">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">คำตอบของนักเรียน:</p>
                            <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{studentAnswer || '(ไม่มีคำตอบ)'}</p>
                          </div>

                          {/* Rubrics for Subjective */}
                          {question.rubrics && question.rubrics.length > 0 && (
                            <div className="mb-4 bg-orange-50 p-3 rounded-lg border border-orange-200">
                              <p className="text-[10px] font-black text-orange-600 uppercase mb-3 tracking-wider">🎯 เกณฑ์การให้คะแนน:</p>
                              <div className="space-y-2">
                                {question.rubrics.map((rubric, rIdx) => (
                                  <div key={rIdx} className="flex items-start gap-2 p-2 bg-white rounded border border-orange-100">
                                    <div className="w-6 h-6 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center flex-shrink-0 font-black text-xs">
                                      {rubric.points}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-bold text-slate-700">{rubric.criteria}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Score Input (Only for Subjective) */}
                      {isSubjective && (
                        <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-lg border border-purple-200">
                          <label className="text-xs font-black text-purple-600 uppercase tracking-wider">คะแนน:</label>
                          <div className="relative flex items-center">
                            <input 
                              type="number" 
                              min="0"
                              max={question.maxScore || 10}
                              value={editScores[qIdx] || 0}
                              onChange={(e) => setEditScores({...editScores, [qIdx]: Math.max(0, parseInt(e.target.value) || 0)})}
                              className="w-16 px-3 py-2 border border-purple-300 rounded-lg font-black text-center text-purple-600 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                            <span className="ml-2 text-sm font-black text-slate-500">/ {question.maxScore || 10}</span>
                          </div>
                        </div>
                      )}

                      {/* Navigation Menu */}
                      {exam.questions.length > 1 && (
                        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                          <button 
                            onClick={goToPreviousQuestion}
                            disabled={currentQuestionIdx === 0}
                            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <select 
                              value={currentQuestionIdx}
                              onChange={(e) => goToQuestion(parseInt(e.target.value))}
                              className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-black text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                            >
                              {exam.questions.map((_, idx) => (
                                <option key={idx} value={idx}>ข้อที่ {idx + 1} / {exam.questions.length}</option>
                              ))}
                            </select>
                          </div>
                          
                          <button 
                            onClick={goToNextQuestion}
                            disabled={currentQuestionIdx === exam.questions.length - 1}
                            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-orange-100 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer - Actions */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 sticky bottom-0">
                <button 
                  onClick={handleResetScores}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-xl font-black text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <RotateCcw size={16} /> รีเซต
                </button>
                <button 
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 px-4 py-3 bg-slate-300 rounded-xl font-black text-xs uppercase tracking-wider text-slate-700 hover:bg-slate-400 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSaveScores}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 rounded-xl font-black text-xs uppercase tracking-wider text-white hover:bg-green-600 transition-all shadow-lg"
                >
                  <Save size={16} /> บันทึก
                </button>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default LiveMonitor;