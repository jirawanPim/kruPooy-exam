import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  LayoutDashboard, FileText, LogOut, Plus, Trash2, 
  Zap, Sparkles, Search, Loader2, 
  FolderOpen, Edit3, Users, Calendar, HelpCircle, ChevronRight, Activity
} from 'lucide-react';

const ExamManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(true);

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
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleDelete = async (id, title) => {
    if (window.confirm(`⚠️ ยืนยันการลบชุดข้อสอบ: ${title}?`)) {
      try {
        await deleteDoc(doc(db, 'exams', id));
      } catch (error) { alert("ไม่สามารถลบข้อสอบได้"); }
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
    { icon: FolderOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
    { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

  const filteredExams = exams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedSubject === '' || exam.subject === selectedSubject) &&
    (selectedGrade === '' || exam.grade === selectedGrade)
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 text-sm lg:flex lg:h-screen lg:overflow-hidden">
      
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
          <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 font-black text-[10px] hover:text-red-600 transition-colors uppercase tracking-[2px] hover:bg-red-50 rounded-lg">
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:h-full lg:flex lg:flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* Header */}
        <header className="h-auto lg:h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 lg:px-6 z-10 sticky top-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shadow-sm"><FolderOpen size={16} lg:size={20} /></div>
              <div>
                <h2 className="font-black text-base lg:text-lg text-slate-800 tracking-tight italic uppercase leading-none">คลังข้อสอบ</h2>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/exam-editor')} className="bg-green-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider">
                <Plus size={14} /> สร้างข้อสอบใหม่
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col space-y-4 lg:space-y-6">
          
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col lg:flex-row items-center gap-3">
            <div className="flex-1 relative group w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-orange-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="ค้นหาข้อสอบ..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none font-bold transition-all italic"
              />
            </div>

            <select 
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full lg:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-slate-600 cursor-pointer transition-all"
            >
              <option value="">วิชาทั้งหมด</option>
              {subjects.map((sub) => (
                <option key={sub.value} value={sub.value}>{sub.label}</option>
              ))}
            </select>

            <select 
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full lg:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-slate-600 cursor-pointer transition-all"
            >
              <option value="">ระดับชั้นทั้งหมด</option>
              {grades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          {/* Exams Grid */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-300">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <FileText size={48} className="mb-4" />
                <p className="font-black text-sm lg:text-base uppercase tracking-widest italic">ไม่พบข้อสอบ</p>
                <p className="text-xs text-slate-400 mt-2">ลองปรับเปลี่ยนตัวกรองหรือเพิ่มข้อสอบใหม่</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence>
                  {filteredExams.map((exam, idx) => (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white rounded-xl lg:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => navigate(`/exam-editor/${exam.id}`)}
                    >
                      <div className="p-4 lg:p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-black text-sm lg:text-base text-slate-800 mb-2 line-clamp-2">{exam.title}</h3>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">{exam.subject || '-'}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">{exam.grade || '-'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(exam.id, exam.title);
                              }}
                              className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors"
                              title="ลบข้อสอบ"
                            >
                              <Trash2 size={14} lg:size={16} />
                            </button>
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-orange-100 text-orange-500 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                              <ChevronRight size={14} lg:size={16} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} />
                            <span>{exam.createdAt?.toDate().toLocaleDateString('th-TH') || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText size={12} />
                            <span>{exam.questions?.length || 0} ข้อ</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExamManager;