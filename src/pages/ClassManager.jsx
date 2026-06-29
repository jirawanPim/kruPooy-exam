import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePopup } from '../components/PopupProvider';
import { 
  LayoutDashboard, Users, LogOut, Plus, Trash2, 
  Zap, Sparkles, Search, BookOpen, ShieldCheck, FolderOpen, Edit3, Loader2, Activity, ArrowUpDown, X,
  FileSpreadsheet, Upload, Download, UserPlus, CheckCircle2, ChevronLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';

const ClassManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = usePopup();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAscending, setSortAscending] = useState(true);

  // Class selection state
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  
  // Single student form state
  const [studentName, setStudentName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [studentIdCode, setStudentIdCode] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  const fileInputRef = useRef(null);
  const studentNoRef = useRef(null);
  const studentIdRef = useRef(null);

  // Smart sort function that handles class names like "6/1", "6/2", "6/10", "6/11"
  const smartSort = (classesArray, ascending) => {
    return [...classesArray].sort((a, b) => {
      const parseClassName = (name) => {
        const match = name.match(/^([^/]+)\/(\d+)$/);
        if (match) {
          return { prefix: match[1], number: parseInt(match[2]) };
        }
        return { prefix: name, number: 0 };
      };

      const aData = parseClassName(a.name);
      const bData = parseClassName(b.name);

      // Compare prefix (e.g., "ม.3", "ม.4")
      if (aData.prefix !== bData.prefix) {
        return ascending 
          ? aData.prefix.localeCompare(bData.prefix, 'th')
          : bData.prefix.localeCompare(aData.prefix, 'th');
      }

      // Compare numbers (e.g., 1, 2, 10, 11)
      if (ascending) {
        return aData.number - bData.number;
      } else {
        return bData.number - aData.number;
      }
    });
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsubAuth();
  }, [navigate]);

  // Load Classes
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'classes'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const loadedClasses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(loadedClasses);
      
      // Keep selected class details up-to-date
      if (selectedClassId) {
        const current = loadedClasses.find(c => c.id === selectedClassId);
        if (current) setSelectedClass(current);
      }
    });
    return () => unsub();
  }, [user, selectedClassId]);

  // Load Students when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedClass(null);
      return;
    }
    
    const currentClass = classes.find(c => c.id === selectedClassId);
    if (currentClass) setSelectedClass(currentClass);

    setLoadingStudents(true);
    const q = query(collection(db, 'classes', selectedClassId, 'students'), orderBy('no', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const loadedStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(loadedStudents);
      
      // Update student count in parent class document if it is different
      if (currentClass && currentClass.studentCount !== loadedStudents.length) {
        updateDoc(doc(db, 'classes', selectedClassId), {
          studentCount: loadedStudents.length
        }).catch(err => console.error("Error updating student count:", err));
      }

      setLoadingStudents(false);
    }, (err) => {
      console.error(err);
      setLoadingStudents(false);
    });

    return () => unsub();
  }, [selectedClassId]);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
      await showAlert("มีชื่อห้องเรียนนี้ในระบบแล้ว", "warning");
      return;
    }
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'classes'), { 
        name: newClassName.trim(),
        createdAt: serverTimestamp(),
        studentCount: 0 
      });
      setNewClassName('');
      setSelectedClassId(docRef.id); // Auto-select newly created class
    } catch (error) { 
      await showAlert("เกิดข้อผิดพลาดในการสร้างห้องเรียน", "error"); 
    }
    setLoading(false);
  };

  const handleDeleteClass = async (id, name, e) => {
    e.stopPropagation(); // Prevent class selection trigger when clicking delete button
    const isConfirm = await showConfirm(
      `ยืนยันการลบห้องเรียน: ${name}?`,
      '⚠️ ข้อมูลนักเรียนทั้งหมดในห้องเรียนนี้จะถูกลบไปด้วยและไม่สามารถกู้คืนได้!'
    );
    if (isConfirm) {
      try {
        await deleteDoc(doc(db, 'classes', id));
        if (selectedClassId === id) {
          setSelectedClassId(null);
          setSelectedClass(null);
        }
        await showAlert("ลบห้องเรียนสำเร็จ", "success");
      } catch (error) { 
        await showAlert("ไม่สามารถลบห้องเรียนได้", "error"); 
      }
    }
  };

  // Add a single student manually
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedClassId || !studentName.trim() || !studentNo.trim()) return;
    
    setAddingStudent(true);
    try {
      const numNo = parseInt(studentNo) || 1;
      
      await addDoc(collection(db, 'classes', selectedClassId, 'students'), {
        no: numNo,
        name: studentName.trim(),
        studentId: studentIdCode.trim() || '',
        createdAt: serverTimestamp()
      });

      // Reset form states and auto-increment roll number
      setStudentName('');
      setStudentIdCode('');
      
      const nextNo = numNo + 1;
      setStudentNo(nextNo.toString());
      
      // Auto-focus next input (Student ID field) for keyboard-friendly entry
      setTimeout(() => {
        studentIdRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error(err);
      await showAlert("ไม่สามารถเพิ่มข้อมูลนักเรียนได้", "error");
    }
    setAddingStudent(false);
  };

  // Delete a single student manually
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!selectedClassId) return;
    const isConfirm = await showConfirm(
      `ต้องการลบนักเรียน: ${studentName}?`,
      'ข้อมูลประวัติต่างๆ ของนักเรียนคนนี้ในวิชานี้จะถูกลบออกจากฐานข้อมูลห้องเรียน'
    );
    if (isConfirm) {
      try {
        await deleteDoc(doc(db, 'classes', selectedClassId, 'students', studentId));
        await showAlert("ลบข้อมูลนักเรียนสำเร็จ", "success");
      } catch (err) {
        console.error(err);
        await showAlert("เกิดข้อผิดพลาดในการลบข้อมูลนักเรียน", "error");
      }
    }
  };

  // Download Student Template Excel
  const downloadStudentTemplate = () => {
    const templateData = [
      { 'เลขที่': 1, 'รหัสนักเรียน': '10001', 'ชื่อ-นามสกุล': 'นายสมศักดิ์ รักเรียน' },
      { 'เลขที่': 2, 'รหัสนักเรียน': '10002', 'ชื่อ-นามสกุล': 'นางสาวสมศรี ดีใจ' },
      { 'เลขที่': 3, 'รหัสนักเรียน': '10003', 'ชื่อ-นามสกุล': 'นายวิทยา ใฝ่รู้' }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 10 },  // เลขที่
      { wch: 15 },  // รหัสนักเรียน
      { wch: 30 }   // ชื่อ-นามสกุล
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "รายชื่อนักเรียน");
    XLSX.writeFile(wb, "SmartExam_Student_Template.xlsx");
  };

  // Bulk Import Students from Excel
  const handleImportStudentsExcel = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedClassId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          await showAlert("ไม่พบข้อมูลนักเรียนในไฟล์ Excel", "warning");
          return;
        }

        // Smart Mapping headers
        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        
        let noKey = '';
        let nameKey = '';
        let idKey = '';

        keys.forEach(k => {
          const lk = k.toLowerCase().trim();
          if (lk.includes('เลขที่') || lk === 'no' || lk === 'no.' || lk.includes('number')) {
            noKey = k;
          } else if (lk.includes('ชื่อ') || lk.includes('name') || lk.includes('นามสกุล')) {
            nameKey = k;
          } else if (lk.includes('ประจำตัว') || lk.includes('รหัส') || lk === 'id' || lk.includes('code') || lk.includes('student')) {
            idKey = k;
          }
        });

        if (!nameKey) {
          nameKey = keys.find(k => k.includes('ชื่อ') || k.includes('Name')) || keys[2] || keys[0];
        }
        if (!noKey) {
          noKey = keys.find(k => k.includes('เลขที่') || k.includes('No')) || keys[0];
        }
        if (!idKey) {
          idKey = keys.find(k => k.includes('รหัส') || k.includes('ID')) || keys[1];
        }

        if (!nameKey) {
          await showAlert("ระบบไม่สามารถค้นหาคอลัมน์ชื่อ-นามสกุลนักเรียนได้", "error", "กรุณาตรวจสอบหัวตารางไฟล์ Excel อีกครั้ง");
          return;
        }

        let importedCount = 0;
        
        for (const row of data) {
          const rawName = row[nameKey]?.toString().trim();
          if (!rawName) continue;

          let rawNo = importedCount + 1;
          if (noKey && row[noKey]) {
            rawNo = parseInt(row[noKey]) || (importedCount + 1);
          }

          const rawId = idKey && row[idKey] ? row[idKey].toString().trim() : '';

          await addDoc(collection(db, 'classes', selectedClassId, 'students'), {
            no: rawNo,
            name: rawName,
            studentId: rawId,
            createdAt: serverTimestamp()
          });
          
          importedCount++;
        }

        await showAlert(`นำเข้ารายชื่อนักเรียนสำเร็จ!`, "success", `นำเข้ารายชื่อนักเรียนสำเร็จทั้งหมด ${importedCount} คน เรียบร้อยแล้ว`);
      } catch (err) {
        console.error(err);
        await showAlert("เกิดข้อผิดพลาดในการประมวลผลไฟล์ Excel", "error", err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Clear input cache
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
    { icon: BookOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
    { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
    { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
    { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
  ];

  const filteredClasses = smartSort(
    classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
    sortAscending
  );

  const filteredStudents = [...students].filter(s => 
    s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
    s.studentId.toString().includes(studentSearchTerm)
  );

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
          <button onClick={() => { signOut(auth); navigate('/'); }} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 font-black text-[10px] hover:text-red-600 transition-colors uppercase tracking-[2px] hover:bg-red-50 rounded-lg">
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:h-full lg:flex lg:flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* Header */}
        <header className="h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shadow-sm"><Users size={20} /></div>
            <div>
              <h2 className="font-black text-base lg:text-lg text-slate-800 tracking-tight italic uppercase leading-none">รายชื่อนักเรียนและห้องเรียน</h2>
            </div>
          </div>
        </header>

        {/* Content Body Layout: Split Panels */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-6 h-full min-h-0">
          
          {/* Left Panel: Class Management (40% width on Desktop) */}
          <div className="w-full lg:w-[35%] flex flex-col h-full min-h-0 space-y-4">
            
            {/* Create Class Card */}
            <div className="bg-white p-4 lg:p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -z-0 opacity-50" />
              
              <div className="relative z-10">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 italic">จัดการห้องเรียน</h3>
                
                <form onSubmit={handleAddClass} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="ชื่อห้อง เช่น ม.3/1" 
                    value={newClassName} 
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-500 focus:bg-white transition-all text-xs shadow-inner italic" 
                    required
                  />
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-xs shadow-md hover:bg-orange-500 hover:shadow-orange-200 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> เพิ่ม</>}
                  </button>
                </form>
              </div>
            </div>

            {/* Class List Card */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <input 
                    type="text" 
                    placeholder="ค้นหาห้อง..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-28 bg-transparent py-0.5 text-xs font-bold text-slate-600 outline-none placeholder:text-slate-300 border-b border-transparent focus:border-orange-300"
                  />
                </div>
                <button 
                  onClick={() => setSortAscending(!sortAscending)}
                  className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                  title="จัดเรียงชื่อห้อง"
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
                {filteredClasses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 space-y-2">
                    <FolderOpen size={24} className="opacity-30" />
                    <p className="font-bold text-[9px] uppercase tracking-wider italic">ไม่พบห้องเรียน</p>
                  </div>
                ) : (
                  filteredClasses.map((item) => {
                    const isSelected = selectedClassId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedClassId(item.id)}
                        className={`group p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm shadow-orange-50'
                            : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                            isSelected ? 'bg-orange-500 text-white' : 'bg-white text-slate-400 border border-slate-100'
                          }`}>
                            {item.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-black text-slate-700 italic tracking-tight text-xs block">{item.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 block">{item.studentCount || 0} คน</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDeleteClass(item.id, item.name, e)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          title="ลบห้องเรียน"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Right Panel: Student List & Import Console (65% width on Desktop) */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-0">
            
            {!selectedClassId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-3">
                <Users size={48} className="text-slate-200 animate-pulse" />
                <h4 className="font-black text-slate-700 text-sm tracking-tight italic uppercase">จัดการรายชื่อนักเรียน</h4>
                <p className="text-xs text-slate-400 text-center font-medium leading-relaxed max-w-xs">
                  👈 กรุณาคลิกเลือกห้องเรียนจากรายการทางซ้าย เพื่อเริ่มดาวน์โหลดเทมเพลต, นำเข้า Excel หรือเพิ่มนักเรียนรายคน
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full min-h-0">
                
                {/* Panel Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
                  <div>
                    <h3 className="font-black text-slate-800 text-sm tracking-tight italic flex items-center gap-2 uppercase">
                      ห้องเรียน: <span className="text-orange-500">{selectedClass?.name}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">นักเรียนทั้งหมด {students.length} คนในฐานข้อมูล</p>
                  </div>

                  {/* Excel Tools & Smart mapping */}
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button 
                      onClick={downloadStudentTemplate}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-100 hover:bg-blue-100 rounded-xl text-blue-600 font-black text-xs transition-all italic"
                      title="ดาวน์โหลดไฟล์ตัวอย่าง Excel สำหรับใส่รายชื่อ"
                    >
                      <Download size={13} /> เทมเพลต Excel
                    </button>
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-xl text-emerald-600 font-black text-xs transition-all italic"
                      title="นำเข้ารายชื่อนักเรียนผ่าน Excel"
                    >
                      <Upload size={13} /> นำเข้า Excel
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".xlsx" 
                      onChange={handleImportStudentsExcel} 
                    />
                  </div>
                </div>

                {/* Import Console & Add Student Form */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Manually Add Student Form */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block italic">เพิ่มนักเรียนทีละคน</span>
                    
                    <form onSubmit={handleAddStudent} className="grid grid-cols-6 gap-2">
                      <input 
                        type="number" 
                        min="1"
                        placeholder="เลขที่" 
                        value={studentNo}
                        onChange={e => setStudentNo(e.target.value)}
                        ref={studentNoRef}
                        className="col-span-1.5 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-orange-500 focus:bg-white text-xs text-center"
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="รหัสประจำตัว" 
                        value={studentIdCode}
                        onChange={e => setStudentIdCode(e.target.value)}
                        ref={studentIdRef}
                        className="col-span-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-orange-500 focus:bg-white text-xs"
                      />
                      <input 
                        type="text" 
                        placeholder="ชื่อ - นามสกุล" 
                        value={studentName}
                        onChange={e => setStudentName(e.target.value)}
                        className="col-span-2.5 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-orange-500 focus:bg-white text-xs"
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={addingStudent}
                        className="col-span-6 md:col-span-6 bg-slate-800 text-white py-2 rounded-lg font-black text-xs shadow-sm hover:bg-orange-500 hover:shadow-orange-100 transition-all flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                      >
                        {addingStudent ? <Loader2 className="animate-spin" size={13} /> : <><UserPlus size={13} /> เพิ่มรายชื่อลงฐานข้อมูล</>}
                      </button>
                    </form>
                  </div>

                  {/* Search and mapping Info */}
                  <div className="space-y-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block italic">ค้นหารายชื่อ</span>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..." 
                          value={studentSearchTerm} 
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:border-orange-400 focus:bg-white outline-none font-bold transition-all"
                        />
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-slate-400 font-bold bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-left flex items-start gap-1.5">
                      <Zap size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Smart Mapping:</strong> ระบบจะดักจับชื่อหัวตาราง Excel ที่มีคำว่า 'ชื่อ', 'เลขที่' และ 'รหัสประจำตัว' อัตโนมัติ เพื่ออำนวยความสะดวกให้รวดเร็วที่สุด
                      </span>
                    </div>
                  </div>

                </div>

                {/* Student Table List */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {filteredStudents.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลนักเรียนในห้องเรียนนี้
                    </div>
                  ) : (
                    <div className="p-5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <th className="py-3 pl-2 w-16 text-center">เลขที่</th>
                            <th className="py-3 w-28">รหัสประจำตัว</th>
                            <th className="py-3">ชื่อ - นามสกุล</th>
                            <th className="py-3 w-12 pr-2 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-bold text-slate-600 text-xs">
                          {filteredStudents.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 pl-2 text-center text-slate-800 font-black">
                                <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center mx-auto text-[10px]">
                                  {s.no}
                                </span>
                              </td>
                              <td className="py-3 font-mono text-slate-400">{s.studentId || '-'}</td>
                              <td className="py-3 text-slate-700 italic">{s.name}</td>
                              <td className="py-3 text-center pr-2">
                                <button 
                                  onClick={() => handleDeleteStudent(s.id, s.name)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="ลบนักเรียน"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>

        </div>

        <div className="absolute bottom-4 right-6 pointer-events-none opacity-50 flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest italic z-10">
           <ShieldCheck size={12} /> ระบบบันทึกอัตโนมัติ
        </div>
      </main>
    </div>
  );
};

export default ClassManager;