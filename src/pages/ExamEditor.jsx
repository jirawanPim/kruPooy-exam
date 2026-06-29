import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePopup } from '../components/PopupProvider';
import { 
  LayoutDashboard, LogOut, Plus, Trash2, Zap, Save, 
  Upload, CheckCircle2, 
  AlignLeft, List, ShieldCheck, BookOpen, GraduationCap, 
  Edit3, Loader2, PlusCircle, MinusCircle, Award, FileSpreadsheet,
  Users, ChevronLeft, ChevronRight, Activity, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ExamEditor = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = usePopup();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState({ title: '', subject: '', grade: '' });
  const [questions, setQuestions] = useState([
    { 
      id: Date.now(), question: '', type: 'multiple', maxScore: 1,
      options: ['', '', '', ''], correctAnswer: 0, rubrics: [{ criteria: 'ตอบตรงประเด็นและครบถ้วน', points: 3 }] 
    }
  ]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [activeStep, setActiveStep] = useState(1); // Step 1: Metadata, Step 2: Multiple Choice, Step 3: Subjective

  // Subject list with categories
  const subjects = [
    { value: 'ภาษาไทย', label: 'ภาษาไทย' },
    { value: 'วิทยาศาสตร์', label: 'วิทยาศาสตร์' },
    { value: 'วิทยาการคำนวณ', label: 'วิทยาการคำนวณ' },
    { value: 'สังคมศึกษา', label: 'สังคมศึกษา ศาสนา และวัฒนธรรม' },
    { value: 'ประวัติศาสตร์', label: 'ประวัติศาสตร์' },
    { value: 'สุขศึกษา', label: 'สุขศึกษาและพลศึกษา' },
    { value: 'ศิลปะ', label: 'ศิลปะ' },
    { value: 'การงาน', label: 'การงานอาชีพ' },
    { value: 'ภาษาต่างประเทศ', label: 'ภาษาต่างประเทศ' }
  ];

  const grades = ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (examId && user) {
      const fetchExam = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'exams', examId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMetadata({ title: data.title || '', subject: data.subject || '', grade: data.grade || '' });
            setQuestions(data.questions.map(q => ({
              ...q,
              id: q.id || Math.random(),
              rubrics: q.rubrics || [{ criteria: q.rubric || '', points: q.points || 3 }]
            })));
          }
        } catch (err) { console.error(err); }
      };
      fetchExam();
    }
  }, [examId, user]);

  const handleExportExcel = async () => {
    const mcqQuestions = questions.filter(q => q.type === 'multiple');
    if (mcqQuestions.length === 0) return await showAlert("ไม่พบข้อสอบปรนัยสำหรับ Export", "warning");
    const exportData = mcqQuestions.map((q, idx) => ({
      'ข้อที่': idx + 1, 'โจทย์': q.question, 'คะแนน': q.maxScore,
      'ตัวเลือก A': q.options[0], 'ตัวเลือก B': q.options[1], 'ตัวเลือก C': q.options[2], 'ตัวเลือก D': q.options[3],
      'เฉลย (0-3)': q.correctAnswer
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MultipleChoice");
    XLSX.writeFile(wb, `${metadata.title || 'MCQ_Template'}.xlsx`);
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          await showAlert("ไฟล์ Excel ว่างเปล่า", "error");
          return;
        }

        const headers = Object.keys(data[0]);
        console.log("🔍 Headers:", headers);
        console.log("📄 Row 1:", data[0]);

        const getKey = (keywords) => {
          return headers.find(h => {
            const hLower = h.trim();
            return keywords.some(kw => hLower.includes(kw));
          });
        };

        const questionKey = getKey(['โจทย์']);
        const scoreKey = getKey(['คะแนน']);
        const answerKey = getKey(['เฉลย']);
        const optionAKey = getKey(['ตัวเลือก A', 'ตัวเลือกA', 'A)']) || getKey(['A']);
        const optionBKey = getKey(['ตัวเลือก B', 'ตัวเลือกB', 'B)']) || getKey(['B']);
        const optionCKey = getKey(['ตัวเลือก C', 'ตัวเลือกC', 'C)']) || getKey(['C']);
        const optionDKey = getKey(['ตัวเลือก D', 'ตัวเลือกD', 'D)']) || getKey(['D']);

        console.log("🔑 Keys ที่พบ:", { questionKey, scoreKey, answerKey, optionAKey, optionBKey, optionCKey, optionDKey });

        if (!questionKey) {
          await showAlert("ไม่พบคอลัมน์ 'โจทย์'", "error", "กรุณาตรวจสอบว่ามีคอลัมน์ชื่อ 'โจทย์' อยู่ในไฟล์ Excel");
          return;
        }

        const newMCQs = data
          .filter((row) => String(row[questionKey] || '').trim().length > 0)
          .map((row, i) => ({
            id: Date.now() + i,
            question: String(row[questionKey] || '').trim(),
            type: 'multiple',
            maxScore: parseInt(row[scoreKey]) || 1,
            options: [
              String(row[optionAKey] || '').trim(),
              String(row[optionBKey] || '').trim(),
              String(row[optionCKey] || '').trim(),
              String(row[optionDKey] || '').trim(),
            ],
            correctAnswer: Math.min(Math.max(parseInt(row[answerKey]) || 0, 0), 3),
            rubrics: [{ criteria: '', points: 3 }]
          }));

        if (newMCQs.length === 0) {
          await showAlert("ไม่พบข้อสอบที่ถูกต้องในไฟล์", "warning");
          return;
        }

        console.log("✅ ข้อแรก:", newMCQs[0]);
        setQuestions([...questions, ...newMCQs]);
        await showAlert(`นำเข้าข้อสอบปรนัยสำเร็จ!`, "success", `ระบบนำเข้าข้อสอบจำนวน ${newMCQs.length} ข้อ เรียบร้อยแล้ว`);
      } catch (err) {
        console.error("❌ Error:", err);
        await showAlert("เกิดข้อผิดพลาดในการอ่านไฟล์", "error", err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'โจทย์': 'ตัวอย่างคำถาม 1: 2 + 2 = ?',
        'คะแนน': 1,
        'ตัวเลือก A': '3',
        'ตัวเลือก B': '4',
        'ตัวเลือก C': '5',
        'ตัวเลือก D': '6',
        'เฉลย': 1
      },
      {
        'โจทย์': 'ตัวอย่างคำถาม 2: ธนาคารของประเทศไทยคือ?',
        'คะแนน': 1,
        'ตัวเลือก A': 'ธนาคารพาณิชย์',
        'ตัวเลือก B': 'ธนาคารแห่งประเทศไทย',
        'ตัวเลือก C': 'ธนาคารพัฒนาวิสาหกิจ',
        'ตัวเลือก D': 'ธนาคารอาหาร',
        'เฉลย': 1
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // ตั้งความกว้างของคอลัมน์
    ws['!cols'] = [
      { wch: 40 },  // โจทย์
      { wch: 8 },   // คะแนน
      { wch: 20 },  // ตัวเลือก A
      { wch: 20 },  // ตัวเลือก B
      { wch: 20 },  // ตัวเลือก C
      { wch: 20 },  // ตัวเลือก D
      { wch: 8 }    // เฉลย
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "SmartExam_Template.xlsx");
  };

  const addQuestion = (type = 'multiple') => {
    setQuestions([...questions, { 
      id: Date.now(), 
      question: '', 
      type: type, 
      maxScore: type === 'multiple' ? 1 : 3, 
      options: ['', '', '', ''], 
      correctAnswer: 0, 
      rubrics: [{ criteria: 'ตอบตรงประเด็นเนื้อหาครบถ้วน', points: 3 }] 
    }]);
  };
  const removeQuestion = async (id) => {
    if (questions.length <= 1) {
      await showAlert("ต้องมีข้อสอบอย่างน้อย 1 ข้อในระบบ", "warning");
      return;
    }
    const newQuestions = questions.filter(q => q.id !== id);
    setQuestions(newQuestions);
    
    if (currentQuestionIdx >= newQuestions.length) {
      setCurrentQuestionIdx(Math.max(0, newQuestions.length - 1));
    }
  };
  const updateQuestion = (id, field, value) => setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  const updateRubric = (qId, rIdx, field, value) => setQuestions(questions.map(q => {
    if (q.id === qId) { const nR = [...q.rubrics]; nR[rIdx][field] = value; return { ...q, rubrics: nR }; } return q;
  }));
  const addRubric = (qId) => setQuestions(questions.map(q => q.id === qId ? { ...q, rubrics: [...q.rubrics, { criteria: 'เกณฑ์ใหม่', points: 1 }] } : q));
  const removeRubric = (qId, rIdx) => setQuestions(questions.map(q => (q.id === qId && q.rubrics.length > 1) ? { ...q, rubrics: q.rubrics.filter((_, i) => i !== rIdx) } : q));

  const getSubjectiveMaxScore = (rubrics) => {
    if (!rubrics || rubrics.length === 0) return 10;
    return Math.max(...rubrics.map(r => parseInt(r.points) || 0));
  };

  const handleSave = async () => {
    if (!metadata.title) return await showAlert("กรุณาระบุชื่อชุดข้อสอบ", "warning");
    setLoading(true);
    try {
      const processedQuestions = questions.map(q => {
        if (q.type === 'subjective') {
          return { ...q, maxScore: getSubjectiveMaxScore(q.rubrics) };
        }
        return q;
      });
      const examData = { ...metadata, questions: processedQuestions, authorId: user.uid, updatedAt: serverTimestamp(), ...(examId ? {} : { createdAt: serverTimestamp() }) };
      await setDoc(examId ? doc(db, 'exams', examId) : doc(collection(db, 'exams')), examData, { merge: true });
      await showAlert("บันทึกสำเร็จ!", "success", "ชุดข้อสอบของท่านจัดเก็บในคลังเรียบร้อยแล้ว");
      navigate('/exam-manager');
    } catch (e) { 
      await showAlert("เกิดข้อผิดพลาดในการบันทึก", "error", e.message); 
    }
    setLoading(false);
  };

  // Navigation handlers
  const goToPreviousQuestion = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(currentQuestionIdx - 1);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    }
  };

  const goToQuestion = (idx) => {
    setCurrentQuestionIdx(idx);
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
    { icon: BookOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
    { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

  const mcqQuestions = questions.filter(q => q.type === 'multiple');
  const subQuestions = questions.filter(q => q.type === 'subjective');

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 text-sm lg:flex lg:h-screen lg:overflow-hidden">
      
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden bg-white border-b border-slate-100 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-orange-100 bg-white flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/profilePicture.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s'; }} />
          </div>
          <span className="font-black text-sm italic tracking-tighter text-slate-800 uppercase">SmartExam</span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
          <LayoutDashboard size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Sidebar */}
      <aside className="fixed lg:static inset-y-0 left-0 z-20 w-64 h-full bg-white border-r border-slate-100 flex flex-col shadow-xl transform -translate-x-full lg:translate-x-0 transition-transform duration-300">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-full border border-orange-100 bg-white flex items-center justify-center shadow-sm overflow-hidden">
              <img src="/profilePicture.jpg" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s'; }} />
            </div>
            <span className="font-black text-lg italic tracking-tighter text-slate-800 uppercase">SmartExam</span>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname.includes(item.path);
              return (
                <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black transition-all group ${isActive ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:bg-orange-50 hover:text-orange-500'}`}>
                  <item.icon size={18} className={isActive ? 'text-white' : ''} />
                  <span className="text-xs italic uppercase tracking-wider">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t border-slate-50">
          <button onClick={() => { signOut(auth); navigate('/'); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 font-black text-[10px] hover:text-red-600 transition-colors uppercase tracking-[2px] hover:bg-red-50 rounded-lg"><LogOut size={14} /> ออกจากระบบ</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:h-full lg:flex lg:flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* Header */}
        <header className="h-auto lg:h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 lg:px-6 z-10 sticky top-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
             <div className="flex items-center gap-3">
                <button onClick={() => navigate('/exam-manager')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><ChevronLeft size={18} /></button>
                <div className="hidden lg:block h-6 w-[1px] bg-slate-200 mx-1"></div>
                <input type="text" placeholder="ตั้งชื่อชุดข้อสอบ..." value={metadata.title} onChange={e => setMetadata({...metadata, title: e.target.value})} className="bg-transparent font-black text-base lg:text-lg text-slate-800 outline-none w-full lg:w-64 md:w-96 placeholder:text-slate-300 italic truncate" />
             </div>
             
             <div className="flex items-center gap-2 self-end lg:self-auto">
                <button onClick={downloadTemplate} className="px-3 py-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl font-black text-[10px] uppercase tracking-wider border border-blue-100 transition-all flex items-center gap-1.5 active:scale-95" title="ดาวน์โหลดไฟล์ตัวอย่าง Excel">
                  <FileSpreadsheet size={14} /> โหลดเทมเพลต
                </button>
                <button onClick={handleExportExcel} className="px-3 py-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl font-black text-[10px] uppercase tracking-wider border border-emerald-100 transition-all flex items-center gap-1.5 active:scale-95" title="ส่งออกข้อมูลเป็น Excel">
                  <FileSpreadsheet size={14} /> ส่งออก Excel
                </button>
                <button onClick={() => fileInputRef.current.click()} className="px-3 py-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-black text-[10px] uppercase tracking-wider border border-slate-200 transition-all flex items-center gap-1.5 active:scale-95" title="นำเข้าข้อสอบจาก Excel">
                  <Upload size={14} /> นำเข้า Excel
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleImportExcel} />
                
                <div className="hidden md:block h-6 w-[1px] bg-slate-200 mx-1"></div>

                <button onClick={handleSave} disabled={loading} className="bg-green-500 text-white px-5 py-2.5 rounded-xl font-black text-xs shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider disabled:opacity-50">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> บันทึกข้อสอบ</>}
                </button>
             </div>
          </div>
        </header>

        {/* Wizard Step Indicator */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 overflow-x-auto scrollbar-hide">
          {[
            { step: 1, label: 'ข้อมูลเบื้องต้น' },
            { step: 2, label: `ข้อสอบปรนัย (${mcqQuestions.length})` },
            { step: 3, label: `ข้อสอบอัตนัย (${subQuestions.length})` }
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`flex items-center gap-2 pb-2 pt-1 border-b-2 font-black text-xs tracking-tight italic transition-all whitespace-nowrap ${
                activeStep === s.step
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                activeStep === s.step ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>{s.step}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Editor Layout Split Panels */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-6 h-full min-h-0">
          
          {/* Left Panel: Step Editor Form (60%) */}
          <div className="w-full lg:w-[60%] flex flex-col h-full overflow-y-auto pr-1 scrollbar-hide space-y-6">
            
            {/* STEP 1: Metadata */}
            {activeStep === 1 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-black text-slate-800 mb-1 italic tracking-tight uppercase">ข้อมูลรายละเอียดข้อสอบ</h3>
                  <p className="text-xs text-slate-400 font-medium">กรอกชื่อรายวิชา และระบุระดับชั้นของแบบทดสอบนี้</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-slate-500 italic">ชื่อหัวข้อข้อสอบ</label>
                    <input 
                      type="text" 
                      placeholder="ตัวอย่าง: สอบกลางภาคเรียนที่ 1/2569" 
                      value={metadata.title} 
                      onChange={e => setMetadata({...metadata, title: e.target.value})} 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all text-sm shadow-inner italic" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-500 italic">รายวิชา</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <BookOpen size={16} className="text-slate-400" />
                        <select 
                          value={metadata.subject} 
                          onChange={e => setMetadata({...metadata, subject: e.target.value})}
                          className="flex-1 bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="" className="text-slate-400">เลือกวิชา</option>
                          {subjects.map((sub) => (
                            <option key={sub.value} value={sub.value}>{sub.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-500 italic">ระดับชั้น</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <GraduationCap size={16} className="text-slate-400" />
                        <select 
                          value={metadata.grade} 
                          onChange={e => setMetadata({...metadata, grade: e.target.value})}
                          className="flex-1 bg-transparent font-bold text-sm text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="" className="text-slate-400">เลือกระดับชั้น</option>
                          {grades.map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setActiveStep(2)}
                    className="bg-orange-500 text-white px-5 py-3 rounded-xl font-black text-xs shadow-md hover:bg-orange-600 transition-all flex items-center gap-2"
                  >
                    ขั้นตอนถัดไป (ข้อสอบปรนัย) <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Multiple Choice Questions */}
            {activeStep === 2 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-slate-800 mb-1 italic tracking-tight uppercase">รายการข้อสอบปรนัย (Multiple Choice)</h3>
                    <p className="text-xs text-slate-400 font-medium">จัดการข้อคำถามแบบสี่ตัวเลือก พร้อมตัวช่วยนำเข้าจากไฟล์ Excel</p>
                  </div>
                  
                  <div className="text-[10px] text-orange-500 bg-orange-50/50 border border-orange-100 px-3 py-1.5 rounded-xl font-black italic uppercase tracking-wider">
                    จัดการ Excel ได้จากแถบด้านบน
                  </div>
                </div>

                {/* Drag & Drop Area for Excel inside Step 2 */}
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.endsWith('.xlsx')) {
                      const fakeEvent = { target: { files: [file] } };
                      handleImportExcel(fakeEvent);
                    } else {
                      await showAlert("กรุณาใช้ไฟล์ Excel (.xlsx) เท่านั้น", "error");
                    }
                  }}
                  className="border-2 border-dashed border-slate-200 hover:border-orange-400 hover:bg-orange-50/5 bg-slate-50 p-6 rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group shadow-inner"
                  onClick={() => fileInputRef.current.click()}
                >
                  <Upload size={24} className="text-orange-400 group-hover:scale-110 transition-transform" />
                  <div className="text-slate-600 font-black text-xs italic uppercase tracking-wider">ลากวางไฟล์ Excel (.xlsx) ที่นี่เพื่อนำเข้าข้อสอบปรนัยด่วน</div>
                  <div className="text-[10px] text-slate-400 font-bold">หรือคลิกเพื่อเลือกไฟล์จากคอมพิวเตอร์ของคุณ</div>
                </div>

                {mcqQuestions.length === 0 ? (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center text-slate-400 font-bold">
                    ยังไม่มีข้อสอบปรนัยในชุดข้อสอบนี้ กดปุ่มด้านล่างเพื่อเริ่มสร้าง หรือลากวางไฟล์ Excel ด้านบน
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, idx) => {
                      if (q.type !== 'multiple') return null;
                      return (
                        <div key={q.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                          <div className="absolute -left-3 top-6 w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-lg z-10">
                            {idx + 1}
                          </div>
                          
                          <div className="flex justify-between items-start mb-4 pl-6">
                            <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2.5 py-1 rounded-md uppercase tracking-wide italic">ข้อสอบปรนัย</span>
                            <div className="flex items-center gap-2">
                              {/* +/- Modifier for Score */}
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200/50 shadow-inner">
                                <button type="button" onClick={() => updateQuestion(q.id, 'maxScore', Math.max(1, (q.maxScore || 1) - 1))} className="w-5 h-5 rounded bg-white text-slate-500 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors font-black text-xs cursor-pointer shadow-sm border border-slate-200/55">-</button>
                                <span className="w-6 text-center font-black text-slate-700 text-xs">{q.maxScore || 1}</span>
                                <button type="button" onClick={() => updateQuestion(q.id, 'maxScore', (q.maxScore || 1) + 1)} className="w-5 h-5 rounded bg-white text-slate-500 flex items-center justify-center hover:bg-orange-100 hover:text-orange-600 transition-colors font-black text-xs cursor-pointer shadow-sm border border-slate-200/55">+</button>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide pr-1">คะแนน</span>
                              </div>
                              <button onClick={() => removeQuestion(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="ลบคำถาม"><Trash2 size={16} /></button>
                            </div>
                          </div>

                          <div className="pl-6 mb-4">
                            <textarea rows="2" value={q.question} onChange={e => updateQuestion(q.id, 'question', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 text-xs outline-none focus:border-orange-300 focus:bg-white transition-all italic resize-none" placeholder="พิมพ์โจทย์คำถามปรนัยที่นี่..." />
                          </div>

                          <div className="pl-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`relative flex items-center p-1 rounded-xl border-2 transition-all ${q.correctAnswer === oIdx ? 'border-orange-500 bg-orange-50/20' : 'border-slate-50 bg-slate-50'}`}>
                                <button 
                                  type="button" 
                                  onClick={() => updateQuestion(q.id, 'correctAnswer', oIdx)} 
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] mr-2 ml-1 cursor-pointer transition-all hover:scale-105 active:scale-95 ${q.correctAnswer === oIdx ? 'bg-orange-500 text-white' : 'bg-white text-slate-300 border border-slate-200'}`}
                                >
                                  {String.fromCharCode(65 + oIdx)}
                                </button>
                                <input type="text" value={opt} onChange={e => { const no = [...q.options]; no[oIdx] = e.target.value; updateQuestion(q.id, 'options', no); }} className="flex-1 bg-transparent font-bold text-xs text-slate-700 outline-none py-2" placeholder={`ตัวเลือก ${oIdx + 1}`} />
                                <button type="button" onClick={() => updateQuestion(q.id, 'correctAnswer', oIdx)} className={`p-2 ${q.correctAnswer === oIdx ? 'text-orange-500' : 'text-slate-200 hover:text-slate-400'}`}><CheckCircle2 size={16} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={() => addQuestion('multiple')} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-orange-300 hover:text-orange-500 hover:bg-white transition-all flex flex-col items-center justify-center gap-2 group bg-slate-50/50">
                  <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="font-black italic text-[9px] uppercase tracking-widest">เพิ่มข้อสอบปรนัยใหม่</span>
                </button>

                <div className="pt-4 flex justify-between items-center bg-transparent border-t border-slate-200">
                  <button onClick={() => setActiveStep(1)} className="px-5 py-3 rounded-xl border border-slate-200 bg-white font-black text-xs hover:bg-slate-50 transition-colors flex items-center gap-2"><ChevronLeft size={14} /> ย้อนกลับ</button>
                  <button onClick={() => setActiveStep(3)} className="bg-orange-500 text-white px-5 py-3 rounded-xl font-black text-xs shadow-md hover:bg-orange-600 transition-all flex items-center gap-2">ขั้นตอนถัดไป (ข้อสอบอัตนัย) <ChevronRight size={14} /></button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Subjective Questions */}
            {activeStep === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-800 mb-1 italic tracking-tight uppercase">รายการข้อสอบอัตนัย (Subjective Questions)</h3>
                  <p className="text-xs text-slate-400 font-medium">จัดการคำถามเขียนตอบพร้อมกำหนด Rubrics เพื่อใช้ส่งตรวจคะแนนด้วยระบบ AI</p>
                </div>

                {subQuestions.length === 0 ? (
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center text-slate-400">
                    ยังไม่มีข้อสอบอัตนัยในชุดข้อสอบนี้ กดปุ่มด้านล่างเพื่อสร้าง
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, idx) => {
                      if (q.type !== 'subjective') return null;
                      return (
                        <div key={q.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                          <div className="absolute -left-3 top-6 w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-lg z-10">
                            {idx + 1}
                          </div>
                          
                          <div className="flex justify-between items-start mb-4 pl-6">
                            <span className="text-[10px] font-black text-purple-500 bg-purple-50 px-2.5 py-1 rounded-md uppercase tracking-wide italic">ข้อสอบอัตนัย</span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                                <Award size={12} className="text-orange-500" />
                                <span className="font-black text-orange-600 text-xs">{getSubjectiveMaxScore(q.rubrics)}</span>
                                <span className="text-[9px] text-orange-400 uppercase">คะแนนเต็ม</span>
                              </div>
                              <button onClick={() => removeQuestion(q.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="ลบคำถาม"><Trash2 size={16} /></button>
                            </div>
                          </div>

                          <div className="pl-6 mb-4">
                            <textarea rows="2" value={q.question} onChange={e => updateQuestion(q.id, 'question', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 text-xs outline-none focus:border-orange-300 focus:bg-white transition-all italic resize-none" placeholder="พิมพ์โจทย์คำถามอัตนัยเขียนตอบที่นี่..." />
                          </div>

                          <div className="pl-6 bg-orange-50/30 p-4 rounded-2xl border border-orange-100 border-dashed">
                            <div className="flex justify-between items-center mb-3">
                               <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1"><Zap size={12}/> เกณฑ์การให้คะแนนสำหรับการตรวจของ AI</span>
                               <button onClick={() => addRubric(q.id)} className="text-orange-500 hover:text-orange-700 cursor-pointer" title="เพิ่มเกณฑ์ย่อย"><PlusCircle size={16} /></button>
                            </div>
                            <div className="space-y-2">
                               {q.rubrics.map((rub, rIdx) => (
                                 <div key={rIdx} className="flex gap-2 items-center">
                                   <input type="text" value={rub.criteria} onChange={(e) => updateRubric(q.id, rIdx, 'criteria', e.target.value)} className="flex-1 bg-white border border-orange-100 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 outline-none" placeholder="รายละเอียดเกณฑ์การได้คะแนน (เช่น มีคำว่า 'น้ำขึ้นน้ำลง')..." />
                                   
                                   {/* +/- Modifier for Rubric point */}
                                   <div className="flex items-center gap-1 bg-white border border-orange-100 rounded-xl px-2 py-1 flex-shrink-0 shadow-sm">
                                     <button type="button" onClick={() => updateRubric(q.id, rIdx, 'points', Math.max(0, (rub.points || 0) - 1))} className="w-4 h-4 rounded bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-orange-50 hover:text-orange-500 transition-colors font-black text-xs cursor-pointer shadow-sm border border-slate-200/50">-</button>
                                     <span className="w-6 text-center font-black text-xs text-orange-500">{rub.points || 0}</span>
                                     <button type="button" onClick={() => updateRubric(q.id, rIdx, 'points', (rub.points || 0) + 1)} className="w-4 h-4 rounded bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-orange-50 hover:text-orange-500 transition-colors font-black text-xs cursor-pointer shadow-sm border border-slate-200/50">+</button>
                                     <span className="text-[8px] text-orange-400 font-bold uppercase pl-0.5">คะแนน</span>
                                   </div>

                                   {q.rubrics.length > 1 && <button onClick={() => removeRubric(q.id, rIdx)} className="text-slate-300 hover:text-red-400"><MinusCircle size={16} /></button>}
                                 </div>
                               ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={() => addQuestion('subjective')} className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:border-orange-300 hover:text-orange-500 hover:bg-white transition-all flex flex-col items-center justify-center gap-2 group bg-slate-50/50">
                  <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="font-black italic text-[9px] uppercase tracking-widest">เพิ่มข้อสอบอัตนัยใหม่</span>
                </button>

                <div className="pt-4 flex justify-between items-center bg-transparent border-t border-slate-200">
                  <button onClick={() => setActiveStep(2)} className="px-5 py-3 rounded-xl border border-slate-200 bg-white font-black text-xs hover:bg-slate-50 transition-colors flex items-center gap-2"><ChevronLeft size={14} /> ย้อนกลับ</button>
                  <button onClick={handleSave} disabled={loading} className="bg-green-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-md hover:bg-green-600 transition-all flex items-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> บันทึกชุดข้อสอบ</>}
                  </button>
                </div>
              </motion.div>
            )}

          </div>

          {/* Right Panel: Virtual Exam Sheet Preview (40%) */}
          <div className="hidden lg:flex lg:w-[40%] flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800 text-xs tracking-wider flex items-center gap-2 uppercase">
                <FileText size={14} className="text-orange-500" /> กระดาษข้อสอบจำลอง (Preview)
              </h3>
              <span className="px-2 py-0.5 bg-orange-100 rounded-full text-[9px] font-black text-orange-600 uppercase tracking-widest border border-orange-200">
                รวม {questions.length} ข้อ
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100/30">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col items-center justify-center text-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
                <h4 className="font-black text-slate-700 text-sm italic">{metadata.title || '(ยังไม่มีชื่อชุดข้อสอบ)'}</h4>
                <div className="flex gap-4 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>วิชา: {metadata.subject || 'ไม่ระบุ'}</span>
                  <span>ชั้น: {metadata.grade || 'ไม่ระบุ'}</span>
                </div>
              </div>

              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  onClick={() => {
                    if (q.type === 'multiple') setActiveStep(2);
                    else setActiveStep(3);
                  }}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer relative ${
                    q.question.trim() === ''
                      ? 'border-dashed border-slate-200'
                      : 'border-slate-100 hover:border-orange-300'
                  }`}
                >
                  <div className="absolute top-3 left-3 w-6 h-6 bg-slate-100 rounded flex items-center justify-center font-black text-[10px] text-slate-500">
                    {idx + 1}
                  </div>
                  
                  <div className="pl-8">
                    <p className={`font-bold text-xs text-slate-700 leading-relaxed break-words ${q.question.trim() === '' ? 'text-slate-300 italic' : ''}`}>
                      {q.question.trim() || 'คำถามว่างเปล่า (กรุณาใส่โจทย์)'}
                    </p>
                    <span className="text-[8px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide mt-2 inline-block">
                      {q.type === 'multiple' ? `ปรนัย (${q.maxScore || 1} คะแนน)` : `อัตนัย (${getSubjectiveMaxScore(q.rubrics)} คะแนน)`}
                    </span>

                    {/* Show Options Mockup for MCQs */}
                    {q.type === 'multiple' && q.options && (
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-black text-[8px] flex-shrink-0 ${
                              q.correctAnswer === oIdx ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>{String.fromCharCode(65 + oIdx)}</span>
                            <span className="truncate w-full font-medium">{opt || `ตัวเลือก ${oIdx + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Show Input Area Mockup for Subjective */}
                    {q.type === 'subjective' && (
                      <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200/50 border-dashed text-[10px] text-slate-400 text-center font-bold">
                        (กล่องพิมพ์คำตอบสำหรับนักเรียนเขียนตอบ)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="absolute bottom-4 right-6 pointer-events-none opacity-50 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest italic z-10">
           <ShieldCheck size={12} /> ระบบบันทึกอัตโนมัติ
        </div>
      </main>
    </div>
  );
};

export default ExamEditor;