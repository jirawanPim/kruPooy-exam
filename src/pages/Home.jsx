import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GraduationCap, 
  Users, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap,
  Heart
} from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  // Animation Variants สำหรับเนื้อหาฝั่งซ้าย
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans overflow-hidden">
      
      {/* === ฝั่งซ้าย: เมนูและเนื้อหา (45%) === */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 md:px-16 lg:px-20 py-12 relative bg-white z-10">
        
        {/* ตกแต่งพื้นหลังด้วยวงกลมสีส้มจางๆ */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-50 rounded-full blur-3xl opacity-60 -z-10" />

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col space-y-10"
        >
          {/* 1. กรอบสำหรับโลโก้ - จัดกึ่งกลางของแถบฝั่งซ้าย */}
          <motion.div variants={itemVariants} className="w-full flex justify-center mb-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-orange-100 overflow-hidden bg-white flex items-center justify-center shadow-xl shadow-orange-100/50 transition-transform group-hover:scale-105 duration-300">
                {/* วางลิงก์ภาพโลโก้ของคุณที่นี่ */}
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR6s7EQRb6ajyauH0XNv48gBEZrXA98igZhTg&s" 
                  alt="System Logo" 
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=LOGO'; }}
                />
              </div>
              <div className="absolute -top-1 -right-1 bg-orange-500 text-white p-1.5 rounded-full shadow-lg">
                <Zap size={14} fill="currentColor" />
              </div>
            </div>
          </motion.div>

          {/* ส่วนหัวข้อหลัก และ รูปภาพครูทางด้านขวา */}
          <motion.div variants={itemVariants} className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 justify-center lg:justify-start">
              <h1 className="text-5xl md:text-6xl font-black text-slate-800 leading-tight tracking-tighter text-center md:text-left">
                ระบบห้องสอบ<br />
                <span className="text-orange-500 underline decoration-orange-200 decoration-8 underline-offset-4">ออนไลน์</span>
              </h1>

              {/* 2. กรอบวงกลมสำหรับใส่รูปภาพครู (อยู่ทางขวาของหัวข้อ) */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-orange-100 ring-4 ring-orange-50 transition-transform hover:scale-105 duration-300">
                  {/* วางลิงก์ภาพครูปุ้ยที่นี่ */}
                  <img 
                    src="/profilePicture.jpg" 
                    alt="Teacher Pui" 
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Teacher'; }}
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg border border-orange-100">
                  <Sparkles size={18} className="text-orange-500" />
                </div>
              </div>
            </div>

            {/* ข้อความชื่อเว็บไซต์ ครูจิรวรรณ พิมพ์ทวด (ครูปุ้ย) */}
            <div className="relative py-3 px-5 bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-orange-500 rounded-r-xl self-center lg:self-start">
              <p className="text-xl md:text-2xl font-black text-slate-700 leading-none">
                เว็บไซต์ข้อสอบ <span className="text-orange-600">ครูจิรวรรณ พิมพ์ทวด</span>
              </p>
              <p className="text-lg font-bold text-slate-500 mt-1">
                (ครูปุ้ย)
              </p>
            </div>
          </motion.div>

          {/* เมนูเข้าใช้งาน */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 w-full">
            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}
              className="group flex items-center justify-between p-6 bg-orange-500 text-white rounded-[2rem] shadow-xl shadow-orange-200 hover:bg-orange-600 transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <GraduationCap size={28} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black text-orange-100 uppercase tracking-widest leading-none mb-1">Teacher Portal</div>
                  <div className="text-xl font-black">สำหรับครูผู้สอน</div>
                </div>
              </div>
              <ArrowRight className="opacity-50 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/lobby')}
              className="group flex items-center justify-between p-6 bg-white text-slate-700 rounded-[2rem] border-2 border-slate-100 hover:border-orange-200 hover:bg-orange-50 transition-all duration-300 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 text-slate-500 p-3 rounded-2xl group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                  <Users size={28} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Student Entry</div>
                  <div className="text-xl font-black">เข้าสอบ (นักเรียน)</div>
                </div>
              </div>
              <ArrowRight className="text-slate-200 group-hover:text-orange-500 group-hover:translate-x-2 transition-all" />
            </motion.button>
          </motion.div>

          {/* เครดิตพัฒนาโดย KruKaw */}
          <motion.div variants={itemVariants} className="pt-8 flex flex-col gap-4">
            <div className="flex items-center justify-center lg:justify-start gap-8 text-[10px] font-black text-slate-300 uppercase tracking-[2px]">
              <div className="flex items-center gap-2"><ShieldCheck size={14} /> Security First</div>
              <div className="flex items-center gap-2"><Zap size={14} /> AI Powered</div>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start gap-2 text-slate-400 text-xs font-medium italic">
              <Heart size={12} className="text-orange-400 fill-orange-400" />
              <span>พัฒนาโดย KruKaw</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* === ฝั่งขวา: ภาพประกอบ Hero (55%) === */}
      <div className="hidden lg:flex lg:w-[55%] relative items-center justify-center bg-orange-500">
        <div className="absolute inset-0 opacity-10" 
             style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-[85%] aspect-[4/3] rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white/20"
        >
          <img 
            src="/background.jpg" 
            alt="Education Tech" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent" />
          <div className="absolute bottom-10 left-10 text-white">
            <div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Smart Examination Platform</div>
            <div className="text-3xl font-black italic">"Test your knowledge,<br/>Elevate your future."</div>
          </div>
        </motion.div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[80%] bg-white/10 rounded-full blur-[120px] -z-0" />
      </div>

    </div>
  );
};

export default Home;