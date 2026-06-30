import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LogIn, 
  ChevronLeft, 
  Sparkles, 
  ShieldCheck, 
  Zap,
  Heart
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { usePopup } from '../components/PopupProvider';

const Login = () => {
  const navigate = useNavigate();
  const { showAlert } = usePopup();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email ? result.user.email.toLowerCase() : '';
      const allowedEmails = [
        'phurin2003@gmail.com',
        'jirawan@rajsima.ac.th',
        'jirawan1221@rajsima.ac.th'
      ];
      
      if (allowedEmails.includes(email)) {
        navigate('/dashboard');
      } else {
        await signOut(auth);
        await showAlert("คุณไม่มีสิทธิ์เข้าใช้งานระบบสำหรับครู", "error");
      }
    } catch (error) {
      console.error("Login failed:", error);
      await showAlert("การเข้าสู่ระบบล้มเหลว กรุณาลองใหม่อีกครั้ง", "error");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.8, staggerChildren: 0.2, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="h-screen w-full flex flex-col lg:flex-row bg-white font-sans overflow-hidden">
      
      {/* === ฝั่งซ้าย: แบบฟอร์มเข้าสู่ระบบ (45%) === */}
      <div className="w-full lg:w-[45%] h-full flex flex-col justify-between px-8 md:px-12 lg:px-16 py-8 relative bg-white z-10">
        
        {/* ปุ่มกลับหน้าหลัก */}
        <motion.button
          whileHover={{ x: -4 }}
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 flex items-center gap-1 text-slate-400 hover:text-orange-500 font-bold text-xs transition-colors group z-20"
        >
          <ChevronLeft size={16} />
          <span>กลับไปหน้าหลัก</span>
        </motion.button>

        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-orange-50 rounded-full blur-3xl opacity-60" />
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex-grow flex flex-col justify-center space-y-10"
        >
          {/* โลโก้กึ่งกลาง */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <div className="relative group">
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full border-4 border-orange-100 overflow-hidden bg-white flex items-center justify-center shadow-lg shadow-orange-100/50">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s" 
                  alt="System Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-1 -right-1 bg-orange-500 text-white p-1.5 rounded-full shadow-lg">
                <Zap size={14} fill="currentColor" />
              </div>
            </div>
          </motion.div>

          {/* หัวข้อ Login */}
          <motion.div variants={itemVariants} className="text-center lg:text-left space-y-4">
            <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tighter leading-tight">
              Teacher <span className="text-orange-500">Login</span>
            </h1>
            <div className="inline-block py-2 px-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-xl">
              <p className="text-lg font-bold text-slate-600">
                ระบบจัดการห้องสอบ (สำหรับครูปุ้ย จิรวรรณ)
              </p>
            </div>
          </motion.div>

          {/* ส่วนปุ่มกดเข้าสู่ระบบ */}
          <motion.div variants={itemVariants} className="w-full max-w-sm mx-auto lg:mx-0">
            <button
              onClick={handleLogin}
              className="group w-full flex items-center justify-center gap-4 p-5 bg-white text-slate-700 rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 hover:border-orange-500 hover:bg-orange-50 transition-all active:scale-[0.98]"
            >
              <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100">
                <img 
                  src="https://cdn-icons-png.freepik.com/512/720/720255.png" 
                  alt="Google" 
                  className="w-6 h-6"
                />
              </div>
              <span className="text-lg font-black italic">Sign in with Google</span>
              <LogIn size={20} className="text-orange-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
            <p className="text-center mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              เฉพาะอาจารย์ผู้ดูแลระบบเท่านั้น
            </p>
          </motion.div>
        </motion.div>

        {/* Footer Credits */}
        <motion.div 
          variants={itemVariants} 
          initial="hidden" 
          animate="visible"
          className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-50"
        >
          <div className="flex items-center gap-5 text-[9px] font-black text-slate-300 uppercase tracking-[2px]">
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> Teacher Only</span>
            <span className="flex items-center gap-1.5"><Zap size={12} /> Secure Access</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium italic">
            <Heart size={10} className="text-orange-400 fill-orange-400" />
            <span>พัฒนาโดย KruKaw</span>
          </div>
        </motion.div>
      </div>

      {/* === ฝั่งขวา: ภาพประกอบ (55%) === */}
      <div className="hidden lg:flex lg:w-[55%] h-full relative items-center justify-center bg-orange-500 p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

        {/* Hero Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2 }}
          className="relative z-10 w-full h-full max-h-[85%] rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white/20"
        >
          <img 
            src="/background.jpg" 
            alt="Teacher Work" 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://placehold.co/600x400/f97316/ffffff?text=Teacher+Work';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-orange-900/60 via-transparent to-transparent" />
          
          {/* แผ่นกระจกแสดงสถานะครู */}
          <div className="absolute bottom-10 left-10 flex items-center gap-6">
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-2xl overflow-hidden ring-4 ring-orange-500/30">
              <img 
                src="/profilePicture.jpg" 
                alt="Teacher Pui" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/150/f97316/ffffff?text=Teacher+Pui';
                }}
              />
            </div>
            <div className="text-white">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest mb-2 border border-white/30">
                <Sparkles size={12} /> Verified Teacher
              </div>
              <h3 className="text-2xl font-black italic">จิรวรรณ พิมพ์ทวด</h3>
              <p className="text-orange-200 text-sm font-bold">ผู้ออกแบบและจัดการการสอบ</p>
            </div>
          </div>
        </motion.div>

        {/* Orbs แสง */}
        <div className="absolute w-full h-full flex items-center justify-center -z-0">
          <div className="w-[120%] h-[60%] bg-white/10 rounded-full blur-[100px]" />
        </div>
      </div>

    </div>
  );
};

export default Login;