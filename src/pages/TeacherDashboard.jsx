import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { 
  collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, serverTimestamp, where 
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  LayoutDashboard, BookOpen, Users, Edit3, Plus, Trash2, 
  PlayCircle, Zap, Sparkles, LogOut, ChevronRight,
  Clock, ShieldAlert, X, Loader2, FolderOpen, Activity
} from 'lucide-react';

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [exams, setExams] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [classList, setClassList] = useState([]); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [roomForm, setRoomForm] = useState({ 
    examId: '', 
    targetClass: '', 
    duration: 60, 
    maxCheats: 3, 
    ignoreCheatCount: false,
    randomizeQuestions: false
  });

  // ✅ ตั้งค่า User จาก Firebase Auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDataLoading(false);
      } else {
        navigate('/login');
      }
    });
    return () => unsubAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    // 1. ดึงข้อสอบ
    const unsubExams = onSnapshot(query(collection(db, 'exams'), orderBy('createdAt', 'desc')), (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("❌ Error fetching exams:", error);
    });

    // 2. ดึงห้องสอบ (🔴 แก้ไข: เพิ่ม where เพื่อให้ผ่าน Security Rules)
    // ใช้ query ระบุเจ้าของห้องทันที เพื่อความชัวร์ในการดึงข้อมูล
    const roomsQuery = query(
      collection(db, 'rooms'),
      where('authorId', '==', user.uid) 
    );

    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
      try {
        const roomsData = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          // กรองห้องที่ปิดถาวร (Archived) ที่หน้าบ้าน (Client-side)
          .filter(r => r.status !== 'archived')
          // เรียงลำดับ: ใหม่ -> เก่า ที่หน้าบ้าน (Client-side Sorting)
          .sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tB - tA;
          });
        
        setActiveRooms(roomsData);
      } catch (err) {
        console.error("❌ Error processing rooms:", err);
      }
    }, (error) => {
      console.error("❌ Firebase permission error on rooms:", error);
    });

    // 3. ดึงห้องเรียน
    const unsubClasses = onSnapshot(query(collection(db, 'classes'), orderBy('name', 'asc')), (snap) => {
      setClassList(snap.docs.map(d => d.data().name));
    }, (error) => {
      console.error("❌ Error fetching classes:", error);
    });

    return () => { unsubExams(); unsubRooms(); unsubClasses(); };
  }, [user]);

  const handleCreateRoom = async () => {
    if (!roomForm.examId || !roomForm.targetClass) return alert("กรุณาระบุข้อมูลให้ครบถ้วน");
    setLoading(true);
    
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const selectedExam = exams.find(e => e.id === roomForm.examId);

    if (!selectedExam) {
      alert("❌ ไม่พบข้อมูลชุดข้อสอบที่เลือก กรุณาลองใหม่");
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'rooms'), {
        ...roomForm,
        examTitle: selectedExam?.title || 'แบบทดสอบ',
        roomCode,
        status: 'waiting',
        isLocked: false,
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      setIsModalOpen(false);
      setRoomForm({ examId: '', targetClass: '', duration: 60, maxCheats: 3, ignoreCheatCount: false, randomizeQuestions: false });
      alert(`✅ สร้างห้องสอบสำเร็จ! รหัสคือ: ${roomCode}`);
    } catch (e) { 
      console.error("Error creating room:", e);
      alert("เกิดข้อผิดพลาด: " + e.message); 
    }
    setLoading(false);
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
    { icon: FolderOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
    { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

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
              const isActive = location.pathname === item.path;
              return (
                <button 
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black transition-all group ${
                    isActive 
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-200' 
                    : 'text-slate-400 hover:bg-orange-50 hover:text-orange-500'
                  }`}
                >
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
              <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shadow-sm"><LayoutDashboard size={16} lg:size={20} /></div>
              <div>
                <h2 className="font-black text-base lg:text-lg text-slate-800 tracking-tight italic uppercase leading-none">แดชบอร์ดครู</h2>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-green-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider"
              >
                <Plus size={14} /> สร้างห้องสอบใหม่
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Active Rooms */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-black text-sm lg:text-base text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <PlayCircle size={16} lg:size={20} className="text-slate-400" /> ห้องสอบที่กำลังดำเนินงาน
              </h3>
              
              {activeRooms.length === 0 ? (
                <div className="bg-white rounded-xl lg:rounded-3xl p-6 lg:p-8 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-2 h-40 lg:h-48">
                  <Clock size={24} lg:size={32} className="opacity-20" />
                  <span className="text-xs font-bold uppercase tracking-widest italic text-center">ไม่มีการสอบในขณะนี้</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeRooms.map(room => (
                    <motion.div layout key={room.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                      <div className="absolute top-0 right-0 px-2 lg:px-3 py-1 bg-slate-800 rounded-bl-xl lg:rounded-bl-2xl text-[8px] lg:text-[9px] font-black text-white uppercase tracking-widest">
                        {room.status === 'started' ? 'กำลังสอบ' : 'รอเริ่มสอบ'}
                      </div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                           <span className="block text-2xl lg:text-3xl font-black text-slate-800 font-mono tracking-tighter mb-1">{room.roomCode}</span>
                           <span className="text-[9px] lg:text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md uppercase tracking-wide">ห้อง: {room.targetClass}</span>
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-600 text-xs lg:text-sm mb-4 truncate pr-8">{room.examTitle}</h4>
                      <button onClick={() => navigate(`/live-monitor/${room.id}`)} className="w-full bg-slate-50 text-slate-500 py-2.5 lg:py-3 rounded-xl font-black text-[9px] lg:text-[10px] uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 group-hover:shadow-lg">
                        เข้าหน้าคุมสอบ <ChevronRight size={12} lg:size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Exam List */}
            <div className="space-y-4">
              <h3 className="font-black text-sm lg:text-base text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <BookOpen size={16} lg:size={20} className="text-slate-400" /> ชุดข้อสอบล่าสุด
              </h3>
              <div className="bg-white rounded-xl lg:rounded-3xl border border-slate-100 shadow-sm p-4 h-[calc(100vh-280px)] lg:h-[calc(100vh-240px)] overflow-y-auto">
                 {exams.length === 0 ? (
                   <div className="text-center text-slate-300 text-xs py-10 italic">ไม่พบชุดข้อสอบ</div>
                 ) : (
                   <div className="space-y-3">
                     {exams.map(exam => (
                       <div key={exam.id} className="p-3 lg:p-4 bg-slate-50 rounded-xl lg:rounded-2xl border border-transparent hover:border-orange-200 transition-colors group cursor-default">
                         <div className="flex justify-between items-start mb-1">
                           <span className="bg-white text-slate-400 border border-slate-100 px-2 py-0.5 rounded-md text-[8px] lg:text-[9px] font-black uppercase">{exam.subject}</span>
                           <span className="text-[8px] lg:text-[9px] font-bold text-slate-300">{exam.grade}</span>
                         </div>
                         <h4 className="font-bold text-slate-700 text-xs lg:text-sm truncate mb-2">{exam.title}</h4>
                         <div className="flex items-center gap-2 text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-wider">
                           <FolderOpen size={8} lg:size={10} /> {exam.questions?.length || 0} ข้อ
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Modal: Create Room */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-slate-800">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-colors"><X size={24}/></button>
              
              <div className="mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 mb-4 shadow-sm">
                  <PlayCircle size={24} fill="currentColor" className="text-white"/>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">เปิดห้องสอบ</h3>
                <p className="text-xs text-slate-400 font-bold">กำหนดค่าห้องสอบสำหรับเริ่มใช้งาน</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">เลือกชุดข้อสอบ</label>
                  <select value={roomForm.examId} onChange={e => setRoomForm({...roomForm, examId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-orange-500 focus:bg-white transition-all italic text-slate-600 appearance-none">
                    <option value="">-- กรุณาเลือก --</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">เลือกห้องเรียน</label>
                  <select value={roomForm.targetClass} onChange={e => setRoomForm({...roomForm, targetClass: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-orange-500 focus:bg-white transition-all italic text-slate-600 appearance-none">
                    <option value="">-- กรุณาเลือก --</option>
                    {classList.length > 0 ? (
                      classList.map(c => <option key={c} value={c}>{c}</option>)
                    ) : (
                      <option disabled>ไม่มีข้อมูลห้องเรียน</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">เวลา (นาที)</label>
                    <input type="number" value={roomForm.duration} onChange={e => setRoomForm({...roomForm, duration: parseInt(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-center outline-none focus:border-orange-500 transition-all italic" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-red-400 uppercase tracking-widest ml-1">สลับจอได้ (ครั้ง)</label>
                    <div className="relative">
                      <ShieldAlert size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                      <input type="number" value={roomForm.maxCheats} onChange={e => setRoomForm({...roomForm, maxCheats: parseInt(e.target.value)})} className="w-full pl-9 pr-4 py-3 bg-red-50 border border-red-100 rounded-xl font-black text-xs text-red-500 text-center outline-none focus:border-red-400 transition-all italic" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <input id="ignoreCheat" type="checkbox" checked={roomForm.ignoreCheatCount} onChange={e => setRoomForm({...roomForm, ignoreCheatCount: e.target.checked})} className="w-4 h-4" />
                  <label htmlFor="ignoreCheat" className="text-[11px] font-black text-slate-600">ไม่นับการสลับจอ (ปิดการแจ้งเตือน/การลงโทษ)</label>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">⚙️ ตัวเลือกสุ่มข้อ</h4>
                  
                  <div className="flex items-center gap-3">
                    <input id="randomizeQuestions" type="checkbox" checked={roomForm.randomizeQuestions} onChange={e => setRoomForm({...roomForm, randomizeQuestions: e.target.checked})} className="w-4 h-4" />
                    <label htmlFor="randomizeQuestions" className="text-[11px] font-black text-slate-600">🔀 สุ่มลำดับคำถาม</label>
                  </div>
                </div>

                <button onClick={handleCreateRoom} disabled={loading} className="w-full bg-slate-800 text-white py-4 rounded-xl font-black text-xs shadow-xl hover:bg-orange-500 transition-all uppercase tracking-widest mt-4 flex items-center justify-center gap-2 active:scale-95">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <><Sparkles size={16} /> ยืนยันเปิดห้องสอบ</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherDashboard;