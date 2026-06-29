import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { ShieldCheck, User, GraduationCap, ArrowRight, Loader2, Key, Hash, Clock, Sparkles } from 'lucide-react';

const Lobby = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  // Auto-redirect to home if accessed directly
  useEffect(() => {
    // This page should only be accessed via state from navigation
    // If there's no proper entry point, redirect to home
    const timer = setTimeout(() => {
      // Placeholder for potential redirect logic if needed
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Data States
  const [classList, setClassList] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [studentId, setStudentId] = useState(null); // เก็บ ID นักเรียนหลังลงทะเบียน

  // Form State
  const [formData, setFormData] = useState({ name: '', studentNumber: '', className: '', roomCode: '' });

  // 1. ดึงรายชื่อห้องเรียนสำหรับ Dropdown
  useEffect(() => {
    const loadClasses = async () => {
      try {
        console.log('🔍 กำลังโหลดรายชื่อห้องเรียน...');
        const q = query(collection(db, 'classes'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        const classes = snap.docs.map(d => d.data().name).filter(Boolean);
        console.log('✅ โหลดห้องเรียนสำเร็จ:', classes);
        setClassList(classes);
      } catch (error) {
        console.error('❌ โหลดห้องเรียนล้มเหลว:', error);
        alert('ไม่สามารถโหลดรายชื่อห้องเรียนได้: ' + error.message);
      }
    };
    loadClasses();
  }, []);

  // 2. ระบบรอสัญญาณเริ่มสอบ (Real-time Listener)
  useEffect(() => {
    let unsubStatus = null;
    if (isWaiting && roomData?.id) {
      unsubStatus = onSnapshot(doc(db, 'rooms', roomData.id), (docSnap) => {
        if (docSnap.exists()) {
          const status = docSnap.data().status;
          // ถ้าสถานะเปลี่ยนเป็น started ให้พาไปหน้าสอบทันที
          if (status === 'started') {
            navigate('/exam-page', { 
              state: { roomId: roomData.id, studentId: studentId } 
            });
          }
        }
      });
    }
    return () => { if (unsubStatus) unsubStatus(); };
  }, [isWaiting, roomData, studentId, navigate]);

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.className || !formData.roomCode) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    
    setLoading(true);
    try {
      // 3. ตรวจสอบรหัสห้องสอบ (รองรับ status waiting และ started)
      const q = query(collection(db, 'rooms'), where('roomCode', '==', formData.roomCode.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("❌ ไม่พบห้องสอบ");
        setLoading(false);
        return;
      }

      const roomDoc = querySnapshot.docs[0];
      const roomDataContent = roomDoc.data();

      // ✅ ตรวจสอบสถานะห้องและการล็อก
      if (roomDataContent.status === 'finished') {
        alert("❌ การสอบสิ้นสุดแล้ว ไม่สามารถเข้าได้");
        setLoading(false);
        return;
      }

      if (roomDataContent.isLocked) {
        alert("❌ ห้องสอบถูกล็อกอยู่ ไม่สามารถเข้าห้องได้ในขณะนี้");
        setLoading(false);
        return;
      }

      // ✅ ตรวจสอบว่าห้องเรียนตรงกับ targetClass ที่กำหนดไว้
      if (roomDataContent.targetClass && formData.className !== roomDataContent.targetClass) {
        alert(`❌ ไม่สามารถเข้าได้! ห้องสอบนี้สำหรับห้อง ${roomDataContent.targetClass} เท่านั้น`);
        setLoading(false);
        return;
      }

      setRoomData({ id: roomDoc.id, ...roomDataContent });

      // 4. ลงทะเบียนนักเรียนเข้าห้อง (Attendance)
      const studentRef = await addDoc(collection(db, `rooms/${roomDoc.id}/attendance`), {
        name: formData.name,
        studentNumber: formData.studentNumber || '-',
        className: formData.className,
        joinedAt: serverTimestamp(),
        status: 'online',
        cheatCount: 0,
        answers: {},
        score: 0
      });

      setStudentId(studentRef.id);
      setIsWaiting(true); // เปลี่ยนสถานะเป็นรอเข้าห้อง

    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-slate-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      <AnimatePresence mode="wait">
        {!isWaiting ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative border border-slate-100"
          >
             <div className="text-center mb-10">
               <div className="w-16 h-16 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-orange-200 mb-6">
                 <ShieldCheck size={32} className="text-white" />
               </div>
               <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter mb-2">Student Login</h1>
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">ระบบสอบออนไลน์ปลอดภัยสูง</p>
             </div>

            {/* Back button */}
            <button onClick={() => navigate(-1)} className="absolute top-6 left-6 p-2 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">
              ย้อนกลับ
            </button>

             <form onSubmit={handleJoinRoom} className="space-y-5">
               
               {/* Room Code */}
               <div className="relative group">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500"><Hash size={20} /></div>
                 <input 
                   type="text" 
                   placeholder="รหัสห้องสอบ (Room Code)" 
                   value={formData.roomCode}
                   onChange={e => setFormData({...formData, roomCode: e.target.value})}
                   className="w-full pl-12 pr-4 py-4 bg-orange-50/50 border-2 border-orange-100 rounded-2xl font-black text-lg text-orange-600 outline-none focus:border-orange-500 focus:bg-white transition-all placeholder:text-orange-300/70 italic text-center tracking-widest"
                   maxLength={6}
                   required
                 />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 {/* Name */}
                 <div className="relative col-span-2 md:col-span-1">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={18} /></div>
                   <input 
                     type="text" 
                     placeholder="ชื่อ-นามสกุล" 
                     value={formData.name}
                     onChange={e => setFormData({...formData, name: e.target.value})}
                     className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:border-slate-400 transition-all placeholder:text-slate-300 italic"
                     required
                   />
                 </div>
                 
                 {/* Student No */}
                 <div className="relative col-span-2 md:col-span-1">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Hash size={18} /></div>
                   <input 
                     type="text" 
                     placeholder="เลขที่" 
                     value={formData.studentNumber}
                     onChange={e => setFormData({...formData, studentNumber: e.target.value})}
                     className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:border-slate-400 transition-all placeholder:text-slate-300 italic"
                   />
                 </div>
               </div>

               {/* Class Dropdown */}
               <div className="relative">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><GraduationCap size={18} /></div>
                 <select 
                    value={formData.className}
                    onChange={e => setFormData({...formData, className: e.target.value})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:border-slate-400 transition-all italic appearance-none cursor-pointer"
                    required
                 >
                    <option value="">-- เลือกห้องเรียน --</option>
                    {classList.length > 0 ? (
                      classList.map((cls, idx) => <option key={idx} value={cls}>{cls}</option>)
                    ) : (
                      <option disabled>กำลังโหลดรายชื่อ...</option>
                    )}
                 </select>
               </div>

               <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-orange-500 hover:shadow-orange-200 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest mt-4 group"
               >
                 {loading ? <Loader2 className="animate-spin" /> : <>เข้าห้องสอบ <ArrowRight className="group-hover:translate-x-1 transition-transform" /></>}
               </button>
             </form>
          </motion.div>
        ) : (
          <motion.div 
            key="waiting" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="w-full max-w-xl bg-white rounded-[3rem] p-12 text-center relative border border-slate-100 shadow-2xl overflow-hidden"
          >
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400 animate-pulse" />
             
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 8, repeat: Infinity, ease: "linear" }} 
               className="w-32 h-32 border-4 border-dashed border-orange-200 rounded-full mx-auto mb-8 flex items-center justify-center relative"
             >
                <div className="absolute inset-0 bg-orange-50 rounded-full blur-xl opacity-50" />
                <Clock size={48} className="text-orange-500 relative z-10" />
             </motion.div>

             <h2 className="text-3xl font-black text-slate-800 uppercase italic mb-2 tracking-tight">ลงทะเบียนสำเร็จ!</h2>
             <p className="text-slate-400 font-bold mb-8 italic text-sm">คุณ <span className="text-orange-500">{formData.name}</span> ได้เข้าสู่ห้องสอบแล้ว</p>
             
             <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 animate-pulse">
                <div className="flex items-center justify-center gap-3 text-slate-500">
                   <Loader2 size={18} className="animate-spin" />
                   <span className="text-xs font-black uppercase tracking-widest italic">กำลังรอคุณครูเริ่มการสอบ...</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold">ห้ามปิดหน้านี้ ระบบจะพาเข้าห้องสอบอัตโนมัติ</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Lobby;