import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, orderBy, updateDoc, serverTimestamp, setDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePopup } from '../components/PopupProvider';
import * as XLSX from 'xlsx';
import { 
  LayoutDashboard, FolderOpen, Edit3, Users, LogOut, 
  ChevronRight, ChevronLeft, Download, FileText, 
  CheckCircle2, Search, Filter, ArrowUpRight, BookOpen,
  PieChart, GraduationCap, Calendar, X, Zap, Activity, ShieldAlert, Trash2, MoreVertical, Eye, Edit, FileDown, Settings, RefreshCw, FileSpreadsheet
} from 'lucide-react';

const RoomResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm } = usePopup();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupByMode, setGroupByMode] = useState('date_first'); // 'date_first' | 'class_first'

  // Navigation State: 'exams' | 'rooms' | 'students'
  const [currentView, setCurrentView] = useState('exams'); 
  
  // Data State
  const [examCollections, setExamCollections] = useState([]); // รายการ collection ข้อสอบทั้งหมดที่มีการจัดสอบ
  const [rooms, setRooms] = useState([]); // รายการห้องสอบทั้งหมดใน collection ที่เลือก
  const [selectedCollection, setSelectedCollection] = useState(null); // collection ที่กำลังเลือกดู
  const [selectedRoom, setSelectedRoom] = useState(null); // ห้องที่กำลังเลือกดู
  const [students, setStudents] = useState([]); // นักเรียนในห้องที่เลือก
  const [selectedExam, setSelectedExam] = useState(null); // exam ที่กำลังเลือกดู
  
  // Export State
  const [selectedRoomIds, setSelectedRoomIds] = useState([]); // ID ห้องที่เลือกเพื่อ Export
  
  // Exam data for score calculation
  const [examData, setExamData] = useState(null); // ข้อมูลข้อสอบสำหรับคำนวณคะแนน

  // Subjective View State
  const [viewingStudent, setViewingStudent] = useState(null); // นักเรียนที่กำลังดูข้อเขียน
  const [editingScoreStudent, setEditingScoreStudent] = useState(null); // นักเรียนที่กำลังแก้ไขคะแนน
  const [editScoreValues, setEditScoreValues] = useState({ mcScore: 0, subScore: 0 }); // คะแนนที่กำลังแก้ไข

  // Table Sorting & Filtering
  const [sortConfig, setSortConfig] = useState({ key: 'studentNumber', direction: 'asc' });
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Filter & Search states for Exam Collections
  const [collectionSearchTerm, setCollectionSearchTerm] = useState('');
  const [collectionSubjectFilter, setCollectionSubjectFilter] = useState('ทั้งหมด');
  const [collectionGradeFilter, setCollectionGradeFilter] = useState('ทั้งหมด');

  // Filtered Exam Collections logic
  const getFilteredCollections = () => {
    return examCollections.filter(c => {
      const matchSearch = (c.name || '').toLowerCase().includes(collectionSearchTerm.toLowerCase()) || 
                          (c.id || '').toLowerCase().includes(collectionSearchTerm.toLowerCase());
      const matchSubject = collectionSubjectFilter === 'ทั้งหมด' || c.subject === collectionSubjectFilter;
      const matchGrade = collectionGradeFilter === 'ทั้งหมด' || c.grade === collectionGradeFilter;
      return matchSearch && matchSubject && matchGrade;
    });
  };

  // Dropdown Menu States
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(null);
  const [studentMenuOpen, setStudentMenuOpen] = useState(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setCollectionMenuOpen(null);
      setStudentMenuOpen(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // --- 1. Auth & Data Fetching ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/'); else setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchInitialData();
  }, [user]);

  const fetchInitialData = async () => {
    console.log('🔍 Starting fetchInitialData (Flat Mode)...');
    if (!user) return;
    
    setLoading(true);
    try {
      // 1. ดึงเอกสารแบนๆ ทั้งหมดใน exam_results เรียงจากเสร็จสิ้นล่าสุด
      const q = query(collection(db, 'exam_results'), orderBy('finishedAt', 'desc'));
      const examResultsSnap = await getDocs(q);
      
      const flatResults = examResultsSnap.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      // 2. จัดกลุ่ม Flat Document ตาม examTitle เพื่อแสดงผลเป็นคลังผลสอบ (สำหรับหน้าแรก)
      const collectionsMap = {};
      flatResults.forEach(item => {
        const title = item.examTitle || 'ไม่ระบุชื่อข้อสอบ';
        if (!collectionsMap[title]) {
          collectionsMap[title] = {
            id: title, // ใช้ examTitle เป็น ID อ้างอิง
            name: title,
            subject: item.subject || '-',
            grade: item.grade || '-',
            createdAt: item.createdAt || item.finishedAt,
            rooms: []
          };
        }
        collectionsMap[title].rooms.push(item);
      });

      const collectionsData = Object.values(collectionsMap);

      console.log('🎯 Flat Grouped Collections:', collectionsData);
      setExamCollections(collectionsData);
      
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      await showAlert(`ไม่สามารถดึงข้อมูลได้: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollection = async (collection) => {
    setSelectedCollection(collection);
    setRooms(collection.rooms || []);
    setCurrentView('rooms');
  };

  const handleSelectRoom = async (room) => {
    setSelectedRoom(room);
    setStudentSearchTerm(''); // Reset search
    setSortConfig({ key: 'studentNumber', direction: 'asc' }); // Reset sort
    setLoading(true);
    
    try {
      // Fetch exam data for score calculation
      if (room.examId) {
        const examDoc = await getDoc(doc(db, 'exams', room.examId));
        if (examDoc.exists()) {
          const examData = examDoc.data();
          
          // ตรวจสอบค่าการสุ่มข้อจากเอกสารห้องในระบบ Flat (หรือดึงข้อมูลการตั้งค่าสุ่มจากตัวคอร์ดหลัก)
          const roomSettingsDoc = await getDoc(doc(db, 'rooms', room.id));
          const roomSettings = roomSettingsDoc.exists() ? roomSettingsDoc.data() : room;
          
          if (roomSettings.randomizeQuestions || roomSettings.randomizeChoices) {
            const shuffledExam = { ...examData };
            
            // Shuffle question order
            if (roomSettings.randomizeQuestions) {
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
            if (roomSettings.randomizeChoices) {
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
            
            setExamData(shuffledExam);
          } else {
            setExamData(examData);
          }
        }
      }
      
      // ดึงรายชื่อนักเรียนจาก Subcollection ใต้ Flat document (exam_results/{roomId}/students)
      const q = query(collection(db, `exam_results/${room.id}/students`), orderBy('studentNumber', 'asc')); 
      const snap = await getDocs(q);
      const sData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      console.log('Student data loaded:', sData.length);
      setStudents(sData);
      setCurrentView('students');
    } catch (e) {
      console.error(e);
      await showAlert("ไม่สามารถดึงข้อมูลนักเรียนได้", "error");
    }
    setLoading(false);
  };

  const handleBack = () => {
    if (currentView === 'students') setCurrentView('rooms');
    else if (currentView === 'rooms') setCurrentView('exams');
  };

  const handleOpenScoreEditor = (student) => {
    setEditingScoreStudent(student);
    setEditScoreValues({
      mcScore: student.score || 0,
      subScore: student.subjectiveScore || 0
    });
  };

  const handleSaveScoreEdit = async () => {
    if (!editingScoreStudent || !selectedRoom) return;
    
    const mcScore = parseFloat(editScoreValues.mcScore) || 0;
    const subScore = parseFloat(editScoreValues.subScore) || 0;
    
    if (mcScore < 0 || subScore < 0) {
      await showAlert('คะแนนต้องไม่ติดลบ', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await updateDoc(doc(db, `exam_results/${selectedRoom.id}/students/${editingScoreStudent.id}`), {
        score: mcScore,
        subjectiveScore: subScore,
        scoreEditedAt: serverTimestamp(),
        scoreEditedBy: user.uid
      });
      
      await handleSelectRoom(selectedRoom);
      setEditingScoreStudent(null);
      await showAlert('บันทึกคะแนนสำเร็จ', 'success');
    } catch (error) {
      console.error('Error saving score:', error);
      await showAlert('เกิดข้อผิดพลาดในการบันทึกคะแนน', 'error');
    }
    setLoading(false);
  };

  // --- 3. Export Logic (Multi-room) ---
  const toggleRoomSelection = (roomId) => {
    if (selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds(selectedRoomIds.filter(id => id !== roomId));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomId]);
    }
  };

  const handleExportExcel = async () => {
    if (selectedRoomIds.length === 0) return await showAlert("กรุณาเลือกห้องอย่างน้อย 1 ห้อง", "warning");
    
    setLoading(true);
    const wb = XLSX.utils.book_new();
    
    try {
      const allRows = [];
      
      for (const roomId of selectedRoomIds) {
        const roomDoc = rooms.find(r => r.id === roomId);
        if (!roomDoc) continue;
        
        const q = query(collection(db, `exam_results/${roomId}/students`), orderBy('studentNumber', 'asc'));
        const snap = await getDocs(q);
        const studentsData = snap.docs.map(d => d.data());

        const examTitle = selectedCollection?.name || roomDoc.examTitle || '';
        
        studentsData.forEach((s, idx) => {
          const scores = calculateScores(s);
          
          allRows.push({
            'ห้องสอบ': roomDoc.targetClass || roomDoc.roomCode,
            'ชุดข้อสอบ': examTitle,
            'ลำดับ': idx + 1,
            'รหัสนักเรียน': s.studentNumber,
            'ชื่อ-นามสกุล': s.name,
            'คะแนนปรนัย': scores.mcScore,
            'คะแนนอัตนัย': scores.subScore,
            'คะแนนรวม': scores.totalScore,
            'สถานะ': s.status || '',
            'สลับจอ (ครั้ง)': s.cheatCount || 0
          });
        });
      }

      if (selectedRoomIds.length === 1) {
        const ws = XLSX.utils.json_to_sheet(allRows);
        const roomDoc = rooms.find(r => r.id === selectedRoomIds[0]);
        const rawSheetName = `${roomDoc?.targetClass || 'Room'}`;
        const sheetName = rawSheetName.replace(/[:\\/?*\[\]]/g, '_').substring(0, 30);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      } else {
        const ws = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, 'รวมทั้งหมด');
      }

      const fileName = selectedRoomIds.length === 1 
        ? `ExamResult_${selectedCollection?.name || 'Room'}.xlsx`
        : `ExamResult_${selectedCollection?.name || 'Combined'}_MultiRoom.xlsx`;
      
      XLSX.writeFile(wb, fileName);
      await showAlert("ดาวน์โหลดเรียบร้อย!", "success");
      setSelectedRoomIds([]);
    } catch (e) {
      console.error(e);
      await showAlert("เกิดข้อผิดพลาดในการ Export", "error");
    }
    setLoading(false);
  };

  const handleExportCurrentRoomExcel = async () => {
    if (!selectedRoom) return;
    
    setLoading(true);
    const wb = XLSX.utils.book_new();
    
    try {
      const allRows = [];
      const q = query(collection(db, `exam_results/${selectedRoom.id}/students`), orderBy('studentNumber', 'asc'));
      const snap = await getDocs(q);
      const studentsData = snap.docs.map(d => d.data());

      const examTitle = selectedCollection?.name || selectedRoom.examTitle || '';
      
      studentsData.forEach((s, idx) => {
        const scores = calculateScores(s);
        
        allRows.push({
          'ห้องสอบ': selectedRoom.targetClass || selectedRoom.roomCode,
          'ชุดข้อสอบ': examTitle,
          'ลำดับ': idx + 1,
          'รหัสนักเรียน': s.studentNumber,
          'ชื่อ-นามสกุล': s.name,
          'คะแนนปรนัย': scores.mcScore,
          'คะแนนอัตนัย': scores.subScore,
          'คะแนนรวม': scores.totalScore,
          'สถานะ': s.status || '',
          'สลับจอ (ครั้ง)': s.cheatCount || 0
        });
      });

      const ws = XLSX.utils.json_to_sheet(allRows);
      const rawSheetName = `${selectedRoom.targetClass || 'Room'}`;
      const sheetName = rawSheetName.replace(/[:\\/?*\[\]]/g, '_').substring(0, 30);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `ExamResult_${selectedRoom.targetClass || selectedRoom.roomCode}.xlsx`;
      XLSX.writeFile(wb, fileName);
      await showAlert("ดาวน์โหลดคะแนนของห้องนี้เรียบร้อย!", "success");
    } catch (e) {
      console.error(e);
      await showAlert("เกิดข้อผิดพลาดในการ Export คะแนน", "error");
    }
    setLoading(false);
  };

  // --- Delete Collection Function ---
  const deleteCollection = async (collectionId) => {
    if (!user) return await showAlert('กรุณาล็อกอินก่อนลบข้อมูล', 'warning');
    
    const isConfirm = await showConfirm(
      'ต้องการลบประวัติการสอบนี้ใช่หรือไม่?',
      '⚠️ ข้อมูลทั้งหมดในชุดข้อสอบนี้ (รวมถึงห้องสอบทุกห้องและนักเรียน) จะถูกลบและไม่สามารถกู้คืนได้!'
    );
    if (!isConfirm) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'exam_results'), where('examTitle', '==', collectionId));
      const snap = await getDocs(q);
      
      for (const sessionDoc of snap.docs) {
        const sessionId = sessionDoc.id;
        const studentsQuery = query(collection(db, `exam_results/${sessionId}/students`));
        const studentsSnap = await getDocs(studentsQuery);
        for (const studentDoc of studentsSnap.docs) {
          await deleteDoc(doc(db, `exam_results/${sessionId}/students/${studentDoc.id}`));
        }
        await deleteDoc(doc(db, 'exam_results', sessionId));
      }
      
      await showAlert('ลบประวัติการสอบสำเร็จแล้ว', 'success');
      await fetchInitialData();
      
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
        setSelectedRoom(null);
        setStudents([]);
        setCurrentView('exams');
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      await showAlert('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    }
    setLoading(false);
  };

  // --- Delete Room Function ---
  const deleteRoom = async (roomId) => {
    if (!user) return await showAlert('กรุณาล็อกอินก่อนลบข้อมูล', 'warning');
    
    const isConfirm = await showConfirm(
      'ต้องการลบห้องสอบนี้ใช่หรือไม่?',
      '⚠️ ข้อมูลนักเรียนทั้งหมดในห้องนี้จะถูกลบและไม่สามารถกู้คืนได้!'
    );
    if (!isConfirm) return;
    
    setLoading(true);
    try {
      const studentsQuery = query(collection(db, `exam_results/${roomId}/students`));
      const studentsSnap = await getDocs(studentsQuery);
      
      for (const studentDoc of studentsSnap.docs) {
        await deleteDoc(doc(db, `exam_results/${roomId}/students/${studentDoc.id}`));
      }
      
      await deleteDoc(doc(db, 'exam_results', roomId));
      await showAlert('ลบห้องสอบสำเร็จแล้ว', 'success');
      
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
        setStudents([]);
        setCurrentView('rooms');
      }
      
      await fetchInitialData();
      
      if (selectedCollection) {
        const updatedRooms = rooms.filter(r => r.id !== roomId);
        setRooms(updatedRooms);
        if (updatedRooms.length === 0) {
          setSelectedCollection(null);
          setCurrentView('exams');
        }
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      await showAlert('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    }
    setLoading(false);
  };

  // --- Test Data Creation Function ---
  const createTestData = async () => {
    if (!user) return await showAlert('กรุณาล็อกอินก่อนสร้างข้อมูลทดสอบ', 'warning');
    
    const isConfirm = await showConfirm(
      'สร้างข้อมูลทดสอบ?',
      'จะสร้างข้อมูลทดสอบสำหรับการแสดงผลคะแนนสอบ (Flat Structure) ใช่หรือไม่?'
    );
    if (!isConfirm) return;
    
    setLoading(true);
    try {
      const roomId = `test_room_${Date.now()}`;
      
      // สร้างข้อมูลห้องสอบ (Flat)
      const roomRef = doc(db, 'exam_results', roomId);
      await setDoc(roomRef, {
        id: roomId,
        roomId: roomId,
        examId: 'test-exam',
        examTitle: 'แบบทดสอบคณิตศาสตร์จำลอง',
        subject: 'วิทยาศาสตร์',
        grade: 'ม.4',
        targetClass: 'ม.4/1',
        roomCode: 'TEST99',
        finishedAt: serverTimestamp(),
        totalStudents: 3,
        submittedStudents: 3,
        createdAt: serverTimestamp(),
        examDateStr: new Date().toLocaleDateString('th-TH').replace(/\//g, '-'),
        endTime: serverTimestamp()
      });
      
      // สร้างข้อมูลนักเรียน
      const testStudents = [
        { id: 'student1', name: 'นายเก่งกล้า ชัยชนะ', studentNumber: '1', score: 8, subjectiveScore: 7, status: 'submitted', answers: [0, 1, 2], subjectiveScores: {3: 7} },
        { id: 'student2', name: 'นางสาวนารี รุ่งเรือง', studentNumber: '2', score: 9, subjectiveScore: 8, status: 'submitted', answers: [0, 1, 0], subjectiveScores: {3: 8} },
        { id: 'student3', name: 'เด็กชายสมชาย หมายปอง', studentNumber: '3', score: 5, subjectiveScore: 4, status: 'submitted', answers: [1, 0, 2], subjectiveScores: {3: 4} }
      ];
      
      for (const student of testStudents) {
        const studentRef = doc(db, `exam_results/${roomId}/students/${student.id}`);
        await setDoc(studentRef, student);
      }
      
      await showAlert('สร้างข้อมูลทดสอบสำเร็จแล้ว! ระบบจะรีเฟรชข้อมูล', 'success');
      await fetchInitialData();
    } catch (error) {
      console.error('Error creating test data:', error);
      await showAlert('เกิดข้อผิดพลาดในการสร้างข้อมูลทดสอบ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Delete Student Function ---
  const deleteStudent = async (studentId) => {
    if (!user) return await showAlert('กรุณาล็อกอินก่อนลบข้อมูล', 'warning');
    if (!selectedRoom) return;
    
    const isConfirm = await showConfirm('ยืนยันการลบข้อมูลนักเรียนคนนี้?', 'ข้อมูลคะแนนของนักเรียนจะถูกลบออกถาวร');
    if (!isConfirm) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, `exam_results/${selectedRoom.id}/students/${studentId}`));
      await showAlert('ลบข้อมูลนักเรียนสำเร็จ', 'success');
      await handleSelectRoom(selectedRoom);
    } catch (error) {
      console.error('Error deleting student:', error);
      await showAlert('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Score Calculation Function ---
  const calculateScores = (student) => {
    // Use the exam data that student actually saw (saved during submission)
    const examToCheck = student?.examData || examData;
    if (!examToCheck || !examToCheck.questions) {
      console.log('No exam data or questions, using stored scores');
      // Fallback to stored scores if available
      return {
        mcScore: student.score || 0,
        subScore: student.subjectiveScore || 0,
        totalScore: (student.score || 0) + (student.subjectiveScore || 0),
        maxMc: 0,
        maxSub: 0,
        maxTotal: 0
      };
    }
    
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
    const result = {
      mcScore: mc,
      subScore: sub,
      totalScore: total,
      maxMc,
      maxSub,
      maxTotal: maxMc + maxSub
    };
    
    console.log('Calculated scores:', result);
    return result;
  };

  // --- Sorting Function ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- Filtering and Sorting Function ---
  const getSortedAndFilteredStudents = () => {
    let filteredStudents = [...students];
    
    // Filter by search term
    if (studentSearchTerm) {
      filteredStudents = filteredStudents.filter(student =>
        student.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.studentNumber.toLowerCase().includes(studentSearchTerm.toLowerCase())
      );
    }
    
    // Sort
    filteredStudents.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortConfig.key) {
        case 'studentNumber':
          aValue = a.studentNumber;
          bValue = b.studentNumber;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'score':
          aValue = calculateScores(a).mcScore;
          bValue = calculateScores(b).mcScore;
          break;
        case 'subjectiveScore':
          aValue = calculateScores(a).subScore;
          bValue = calculateScores(b).subScore;
          break;
        case 'isCheatingSubmission':
          aValue = a.isCheatingSubmission ? 1 : 0;
          bValue = b.isCheatingSubmission ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    return filteredStudents;
  };

  const renderRoomCard = (room) => (
    <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-all relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-black text-base text-slate-800 mb-1">{room.targetClass || room.roomCode}</h4>
          <p className="text-sm text-slate-500">สอบแล้ว {room.submittedStudents}/{room.totalStudents} คน</p>
        </div>
        <input
          type="checkbox"
          checked={selectedRoomIds.includes(room.id)}
          onChange={() => toggleRoomSelection(room.id)}
          className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400 cursor-pointer"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <Calendar size={12} />
        <span>{room.examDateStr || room.finishedAt?.toDate?.()?.toLocaleDateString('th-TH') || '-'}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleSelectRoom(room)}
          className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-black text-xs hover:bg-orange-600 transition-colors"
        >
          ดูผล
        </button>
        <button
          onClick={() => deleteRoom(room.id)}
          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

// Sidebar Menu
const menuItems = [
  { icon: LayoutDashboard, label: 'หน้าหลัก', path: '/dashboard' },
  { icon: FolderOpen, label: 'คลังข้อสอบ', path: '/exam-manager' },
  { icon: Edit3, label: 'สร้างข้อสอบ', path: '/exam-editor' },
  { icon: Users, label: 'รายชื่อห้องเรียน', path: '/class-manager' },
  { icon: Activity, label: 'ผลการสอบ', path: '/room-result' },
];

return (
  <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 text-sm lg:flex lg:h-screen lg:overflow-hidden">
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
        <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 py-2.5 text-red-400 font-black text-[10px] hover:text-red-600 transition-colors uppercase tracking-[2px] hover:bg-red-50 rounded-lg"><LogOut size={14} /> ออกจากระบบ</button>
      </div>
    </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-0 lg:h-full lg:flex lg:flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* Header */}
        <header className="h-auto lg:h-16 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 lg:px-6 z-10 sticky top-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shadow-sm"><Activity size={16} lg:size={20} /></div>
              <div>
                <h2 className="font-black text-base lg:text-lg text-slate-800 italic mb-1 truncate pr-8">ผลการสอบ</h2>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <ChevronLeft size={16} lg:size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col space-y-4 lg:space-y-6">
          
          {/* Breadcrumbs Navigation */}
          <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2 text-xs font-black text-slate-400">
            <button 
              onClick={() => {
                setSelectedCollection(null);
                setSelectedRoom(null);
                setCurrentView('exams');
              }}
              className={`hover:text-orange-500 transition-colors flex items-center gap-1.5 ${currentView === 'exams' ? 'text-orange-500 font-extrabold' : ''}`}
            >
              <BookOpen size={14} /> คลังผลสอบทั้งหมด
            </button>
            
            {selectedCollection && (
              <>
                <ChevronRight size={12} className="text-slate-300" />
                <button 
                  onClick={() => {
                    setSelectedRoom(null);
                    setCurrentView('rooms');
                  }}
                  className={`hover:text-orange-500 transition-colors flex items-center gap-1.5 ${currentView === 'rooms' ? 'text-orange-500 font-extrabold' : ''}`}
                >
                  <FolderOpen size={14} /> {selectedCollection.name} ({selectedCollection.grade})
                </button>
              </>
            )}
            
            {selectedRoom && currentView === 'students' && (
              <>
                <ChevronRight size={12} className="text-slate-300" />
                <span className="text-slate-700 flex items-center gap-1.5 font-extrabold bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50">
                  <Users size={14} /> ห้อง: {selectedRoom.targetClass || selectedRoom.roomCode}
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mb-4">
            <button 
              onClick={() => fetchInitialData()}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg hover:bg-blue-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider disabled:opacity-50"
            >
              <RefreshCw size={14} />
              รีเฟรชข้อมูล
            </button>
            {selectedRoomIds.length > 0 && (
              <button 
                onClick={handleExportExcel}
                disabled={loading}
                className="bg-green-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 active:scale-95 italic uppercase tracking-wider disabled:opacity-50"
              >
                <Download size={14} />
                Export Excel ({selectedRoomIds.length} ห้อง)
              </button>
            )}
          </div>

          {/* VIEW 1: Exam Collections */}
          {currentView === 'exams' && (
            <motion.div key="exams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {/* แถบค้นหาและตัวกรองคลังผลสอบ */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อชุดข้อสอบ..."
                    value={collectionSearchTerm}
                    onChange={(e) => setCollectionSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black italic tracking-wide focus:outline-none focus:border-orange-400 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Filters Group */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Subject Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">วิชา:</span>
                    <select
                      value={collectionSubjectFilter}
                      onChange={(e) => setCollectionSubjectFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 focus:outline-none focus:border-orange-400 focus:bg-white transition-all cursor-pointer"
                    >
                      {['ทั้งหมด', ...new Set(examCollections.map(c => c.subject).filter(Boolean))].map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grade Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">ชั้นเรียน:</span>
                    <select
                      value={collectionGradeFilter}
                      onChange={(e) => setCollectionGradeFilter(e.target.value)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-600 focus:outline-none focus:border-orange-400 focus:bg-white transition-all cursor-pointer"
                    >
                      {['ทั้งหมด', ...new Set(examCollections.map(c => c.grade).filter(Boolean))].map(grd => (
                        <option key={grd} value={grd}>{grd}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* รายการคลังผลสอบแบบตาราง (Compact Table/List View) */}
              {getFilteredCollections().length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-400 shadow-sm font-bold">
                  📭 ไม่พบชุดข้อสอบที่ตรงตามตัวเลือกของคุณ
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-16">ลำดับ</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">ชุดข้อสอบ</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-36">หมวดหมู่</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-32">จำนวนห้อง</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-36">วันที่จัดสอบ</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 w-44 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {getFilteredCollections().map((collection, index) => {
                          const roomCount = collection.rooms?.length || 0;
                          return (
                            <tr key={collection.id} className="hover:bg-orange-50/10 transition-colors group">
                              <td className="px-6 py-4 text-xs font-black text-slate-400">{index + 1}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                    <FileText size={18} />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-slate-800 text-sm mb-0.5 leading-snug group-hover:text-orange-600 transition-colors">{collection.name}</h4>
                                    <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase leading-none block">ID: {collection.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-lg text-[10px] font-black">{collection.subject}</span>
                                  <span className="bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-lg text-[10px] font-black">{collection.grade}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl font-black text-[10px] uppercase tracking-wider inline-flex items-center gap-1">
                                  <Activity size={10} />
                                  {roomCount} ห้องสอบ
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                {collection.createdAt?.toDate?.()?.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) || '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 relative">
                                  <button
                                    onClick={() => handleSelectCollection(collection)}
                                    className="bg-orange-500 text-white px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md hover:bg-orange-600 transition-all flex items-center gap-1.5 active:scale-95"
                                  >
                                    <FolderOpen size={12} />
                                    <span>ดูห้องสอบ</span>
                                  </button>

                                  <div className="relative">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCollectionMenuOpen(collectionMenuOpen === collection.id ? null : collection.id);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/40"
                                    >
                                      <MoreVertical size={14} />
                                    </button>

                                    {collectionMenuOpen === collection.id && (
                                      <div className="absolute right-0 top-9 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] overflow-hidden text-left">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCollectionMenuOpen(null);
                                            handleSelectCollection(collection);
                                          }}
                                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition-colors font-black"
                                        >
                                          <Eye size={12} /> ดูรายละเอียด
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCollectionMenuOpen(null);
                                            if (window.confirm('คุณต้องการลบคลังผลสอบและห้องสอบทั้งหมดที่เกี่ยวข้องใช่หรือไม่?')) {
                                              deleteCollection(collection.id);
                                            }
                                          }}
                                          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors font-black"
                                        >
                                          <Trash2 size={12} /> ลบคลังผลสอบ
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {/* VIEW 2: Rooms List */}
          {currentView === 'rooms' && (
            <motion.div key="rooms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{selectedCollection?.name}</h3>
                    <p className="text-sm text-slate-500">ห้องสอบทั้งหมด {rooms.length} ห้อง</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => (
                  <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-all relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-black text-base text-slate-800 mb-1">{room.targetClass || room.roomCode}</h4>
                        <p className="text-sm text-slate-500">สอบแล้ว {room.submittedStudents}/{room.totalStudents} คน</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedRoomIds.includes(room.id)}
                        onChange={() => toggleRoomSelection(room.id)}
                        className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                      <Calendar size={12} />
                      <span>{room.finishedAt?.toDate?.()?.toLocaleDateString('th-TH') || '-'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectRoom(room)}
                        className="flex-1 bg-orange-500 text-white py-2 rounded-lg font-black text-xs hover:bg-orange-600 transition-colors"
                      >
                        ดูผล
                      </button>
                      <button
                        onClick={() => deleteRoom(room.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* VIEW 3: Students Table */}
          {currentView === 'students' && (
            <motion.div key="students" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 bg-slate-50 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{selectedRoom?.targetClass || selectedRoom?.roomCode}</h3>
                    <p className="text-sm text-slate-500">นักเรียนทั้งหมด {students.length} คน</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Export Current Room Excel Button */}
                  <button 
                    onClick={handleExportCurrentRoomExcel}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 rounded-lg text-emerald-600 font-bold text-xs transition-colors cursor-pointer"
                    title="ดาวน์โหลดคะแนนของห้องเรียนนี้เป็น Excel"
                  >
                    <FileSpreadsheet size={14} />
                    <span>ดาวน์โหลด Excel</span>
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อหรือเลขที่..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                </div>
              </div>

              {/* Stats Dashboard */}
              {(() => {
                const getStats = () => {
                  if (students.length === 0) return { max: 0, min: 0, mean: 0, median: 0 };
                  const totalScores = students.map(s => calculateScores(s).totalScore || 0).sort((a, b) => a - b);
                  const max = Math.max(...totalScores);
                  const min = Math.min(...totalScores);
                  const sum = totalScores.reduce((acc, curr) => acc + curr, 0);
                  const mean = (sum / totalScores.length).toFixed(1);
                  let median = 0;
                  const mid = Math.floor(totalScores.length / 2);
                  if (totalScores.length % 2 !== 0) {
                    median = totalScores[mid];
                  } else {
                    median = ((totalScores[mid - 1] + totalScores[mid]) / 2).toFixed(1);
                  }
                  return { max, min, mean, median };
                };
                const stats = getStats();
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
                    {/* Max Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all duration-300">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">คะแนนสูงสุด</p>
                          <h4 className="text-2xl lg:text-3xl font-black mt-2 text-slate-800 tracking-tight italic">{stats.max} <span className="text-[10px] font-bold text-slate-400 not-italic">คะแนน</span></h4>
                        </div>
                        <div className="p-2 bg-red-50 text-red-500 rounded-xl">
                          <GraduationCap size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Min Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all duration-300">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">คะแนนต่ำสุด</p>
                          <h4 className="text-2xl lg:text-3xl font-black mt-2 text-slate-800 tracking-tight italic">{stats.min} <span className="text-[10px] font-bold text-slate-400 not-italic">คะแนน</span></h4>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-500 rounded-xl">
                          <ArrowUpRight size={16} className="transform rotate-90" />
                        </div>
                      </div>
                    </div>

                    {/* Mean Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all duration-300">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">คะแนนเฉลี่ย</p>
                          <h4 className="text-2xl lg:text-3xl font-black mt-2 text-slate-800 tracking-tight italic">{stats.mean} <span className="text-[10px] font-bold text-slate-400 not-italic">คะแนน</span></h4>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
                          <Activity size={16} />
                        </div>
                      </div>
                    </div>

                    {/* Median Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all duration-300">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">ค่ามัธยฐาน</p>
                          <h4 className="text-2xl lg:text-3xl font-black mt-2 text-slate-800 tracking-tight italic">{stats.median} <span className="text-[10px] font-bold text-slate-400 not-italic">คะแนน</span></h4>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-500 rounded-xl">
                          <PieChart size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-100">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">ลำดับ</th>
                      <th 
                        onClick={() => handleSort('studentNumber')}
                        className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50"
                      >
                        เลขที่ {sortConfig.key === 'studentNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('name')}
                        className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50"
                      >
                        ชื่อ-นามสกุล {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('score')}
                        className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50"
                      >
                        คะแนนปรนัย {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        onClick={() => handleSort('subjectiveScore')}
                        className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50"
                      >
                        คะแนนอัตนัย {sortConfig.key === 'subjectiveScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">รวม</th>
                      <th 
                        onClick={() => handleSort('isCheatingSubmission')}
                        className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-orange-50"
                      >
                        สถานะ {sortConfig.key === 'isCheatingSubmission' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-4 py-3 text-left font-black text-xs text-slate-600 uppercase tracking-wider">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getSortedAndFilteredStudents().map((student, index) => {
                      const scores = calculateScores(student);
                      return (
                        <tr key={student.id} className="hover:bg-orange-50/10 transition-colors duration-150">
                          <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{student.studentNumber}</td>
                          <td className="px-4 py-3 text-sm text-slate-800 font-medium">{student.name}</td>
                          <td className="px-4 py-3 text-sm font-bold text-blue-600">{scores.mcScore}</td>
                          <td className="px-4 py-3 text-sm font-bold text-purple-600">{scores.subScore}</td>
                          <td className="px-4 py-3">
                            <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-xl border border-orange-100/50 font-black text-xs min-w-[36px] inline-block text-center shadow-sm">{scores.totalScore}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-sm transition-all ${
                              student.isCheatingSubmission 
                                ? 'bg-red-50 text-red-600 border-red-100' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${student.isCheatingSubmission ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                              {student.isCheatingSubmission ? 'พบการทุจริต' : 'ปกติ'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setViewingStudent(student)}
                                className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100/50 rounded-xl transition-all active:scale-95"
                                title="ดูคำตอบและข้อมูลตรวจข้อสอบ"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenScoreEditor(student)}
                                className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100/50 rounded-xl transition-all active:scale-95"
                                title="แก้ไขคะแนนสอบ"
                              >
                                <Edit size={14} />
                              </button>
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStudentMenuOpen(studentMenuOpen === student.id ? null : student.id);
                                  }}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
                                >
                                  <MoreVertical size={12} />
                                </button>
                                
                                {/* Dropdown Menu for Student */}
                                {studentMenuOpen === student.id && (
                                  <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-[9999]">
                                    <button 
                                      onClick={() => {
                                        setStudentMenuOpen(null);
                                        setViewingStudent(student);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-orange-50 transition-colors"
                                    >
                                      <Eye size={14} /> ดูข้อสอบ
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setStudentMenuOpen(null);
                                        handleOpenScoreEditor(student);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <Edit size={14} /> แก้ไขคะแนน
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setStudentMenuOpen(null);
                                        // Export individual student data
                                        const wb = XLSX.utils.book_new();
                                        const ws = XLSX.utils.json_to_sheet([{
                                          'รหัสนักเรียน': student.studentNumber,
                                          'ชื่อ-นามสกุล': student.name,
                                          'คะแนนปรนัย': scores.mcScore,
                                          'คะแนนอัตนัย': scores.subScore,
                                          'คะแนนรวม': scores.totalScore,
                                          'สถานะ': student.isCheatingSubmission ? 'ทุจริต' : 'ปกติ'
                                        }]);
                                        XLSX.utils.book_append_sheet(wb, ws, 'Student_Result');
                                        XLSX.writeFile(wb, `Student_${student.studentNumber}_${student.name}.xlsx`);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                                    >
                                      <FileDown size={14} /> Export ข้อมูล
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setStudentMenuOpen(null);
                                        if (window.confirm('ต้องการลบข้อมูลนักเรียนนี้ใช่หรือไม่?')) {
                                          deleteStudent(student.id);
                                        }
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 size={14} /> ลบข้อมูล
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* MODAL: Subjective Answer Viewer */}
      <AnimatePresence>
        {viewingStudent && selectedCollection && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 lg:p-6">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-5xl h-[90vh] lg:h-[80vh] rounded-xl lg:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">
                
                {/* Modal Header */}
                <div className="bg-slate-800 p-4 lg:p-6 flex items-center justify-between shrink-0">
                    <div>
                       <h3 className="text-white text-lg lg:text-xl font-black italic uppercase tracking-tight">{viewingStudent.name}</h3>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">เลขที่ {viewingStudent.studentNumber} | คะแนนอัตนัยรวม: <span className="text-orange-400">{viewingStudent.subjectiveScore || 0}</span></p>
                    </div>
                    <button onClick={() => setViewingStudent(null)} className="p-2 bg-slate-700 text-slate-300 rounded-xl hover:bg-red-500 hover:text-white transition-colors"><X size={16} lg:size={20}/></button>
                </div>

                {/* Modal Split Content */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-slate-50">
                  
                  {/* Left: Exam Sheet (70%) */}
                  <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4 lg:space-y-6">
                     {examData && examData.questions ? (
                       examData.questions.map((question, qIndex) => {
                         const studentAnswer = viewingStudent.answers?.[qIndex];
                         const studentSubjectiveScore = viewingStudent.subjectiveScores?.[qIndex] || 0;
                         
                         return (
                           <div key={qIndex} className="bg-white rounded-xl border border-slate-200 p-4 lg:p-6">
                             <div className="flex items-start justify-between mb-3">
                               <div className="flex items-center gap-2">
                                 <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-black text-xs">ข้อที่ {qIndex + 1}</span>
                                 <span className={`px-2 py-1 rounded-lg font-black text-xs ${
                                   question.type === 'subjective' 
                                     ? 'bg-purple-100 text-purple-600' 
                                     : 'bg-blue-100 text-blue-600'
                                 }`}>
                                   {question.type === 'subjective' ? 'อัตนัย' : 'ปรนัย'}
                                 </span>
                                 {question.maxScore && (
                                   <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-black text-xs">
                                     {question.maxScore} คะแนน
                                   </span>
                                 )}
                               </div>
                             </div>
                             
                             <div className="mb-4">
                               <div className="text-sm font-bold text-slate-700 mb-2">คำถาม:</div>
                               <div className="text-sm text-slate-600 whitespace-pre-wrap">{question.question}</div>
                             </div>
                             
                             {question.type === 'multiple_choice' && (
                               <div className="mb-4">
                                 <div className="text-sm font-bold text-slate-700 mb-2">ตัวเลือก:</div>
                                 <div className="space-y-1">
                                   {question.options?.map((option, optIndex) => (
                                     <div key={optIndex} className={`text-sm p-2 rounded-lg ${
                                       option === question.correctAnswer 
                                         ? 'bg-green-50 text-green-700 border border-green-200' 
                                         : 'bg-slate-50 text-slate-600'
                                     }`}>
                                       {String.fromCharCode(65 + optIndex)}. {option}
                                       {option === question.correctAnswer && (
                                         <span className="ml-2 text-xs font-black text-green-600">(✓ คำตอบที่ถูกต้อง)</span>
                                       )}
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             )}
                             
                             <div className="mb-4">
                               <div className="text-sm font-bold text-slate-700 mb-2">คำตอบของนักเรียน:</div>
                               <div className={`p-3 rounded-lg text-sm ${
                                 question.type === 'subjective'
                                   ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                   : studentAnswer === question.correctAnswer
                                     ? 'bg-green-50 text-green-700 border border-green-200'
                                     : 'bg-red-50 text-red-700 border border-red-200'
                               }`}>
                                 {question.type === 'subjective' 
                                   ? (viewingStudent.subjectiveAnswers?.[qIndex] || 'ไม่ได้ตอบ')
                                   : (studentAnswer || 'ไม่ได้ตอบ')
                                 }
                                 {question.type === 'multiple_choice' && studentAnswer === question.correctAnswer && (
                                   <span className="ml-2 text-xs font-black text-green-600">(✓ ถูกต้อง)</span>
                                 )}
                                 {question.type === 'multiple_choice' && studentAnswer && studentAnswer !== question.correctAnswer && (
                                   <span className="ml-2 text-xs font-black text-red-600">(✗ ผิด)</span>
                                 )}
                               </div>
                             </div>
                             
                             {question.type === 'subjective' && (
                               <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                                 <div className="text-sm font-bold text-slate-700">คะแนนที่ได้:</div>
                                 <div className="text-lg font-black text-purple-600">{studentSubjectiveScore} / {question.maxScore || 10}</div>
                               </div>
                             )}
                           </div>
                         );
                       })
                     ) : (
                       <div className="text-center py-20 text-slate-300 font-bold italic">
                         {examData ? 'ไม่พบข้อมูลคำถามในข้อสอบนี้' : 'กำลังโหลดข้อมูลข้อสอบ...'}
                       </div>
                     )}
                  </div>

                  {/* Right: Cheating logs timeline (30% width) */}
                  <div className="w-full lg:w-[320px] bg-slate-900 text-slate-100 p-6 flex flex-col overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-800 shrink-0">
                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                      <ShieldAlert size={14} className="text-red-500" /> ประวัติพฤติกรรม (Logs)
                    </h4>
                    
                    {(() => {
                      const logs = viewingStudent.cheatingLogs || viewingStudent.logs || [];
                      if (logs.length === 0) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-12 space-y-2">
                            <CheckCircle2 size={32} className="text-green-500 opacity-40" />
                            <span className="text-[10px] font-black uppercase tracking-widest">ความประพฤติปกติ</span>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {logs.map((log, lIdx) => (
                            <div key={lIdx} className="bg-slate-800/40 border border-slate-800/80 p-3 rounded-xl relative pl-8 text-left">
                              <div className="absolute left-3 top-4.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                              <div className="absolute left-3 top-4.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                              <div className="text-[9px] font-black text-red-400 uppercase tracking-wider">{log.type || 'ตรวจจับผิดปกติ'}</div>
                              <p className="text-[11px] font-bold text-slate-300 mt-1 leading-relaxed">{log.detail || log.message}</p>
                              <div className="text-[8px] text-slate-500 font-black mt-1.5 italic">
                                {log.time || (log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('th-TH') : '')}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                </div>

             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Score Editor */}
      <AnimatePresence>
        {editingScoreStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 lg:p-6">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-xl lg:rounded-[2.5rem] shadow-2xl p-6 lg:p-8 relative">
                
                {/* Header */}
                <div className="mb-6">
                   <h3 className="text-xl lg:text-2xl font-black text-slate-800 italic uppercase tracking-tight mb-1">แก้ไขคะแนน</h3>
                   <p className="text-sm text-slate-600 font-bold">{editingScoreStudent.name} (เลขที่ {editingScoreStudent.studentNumber})</p>
                </div>

                {/* Score Inputs */}
                <div className="space-y-4 mb-6">
                   {/* MC Score */}
                   <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">คะแนนปรนัย (Multiple Choice)</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.5"
                        value={editScoreValues.mcScore}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditScoreValues({...editScoreValues, mcScore: Math.max(0, val)});
                        }}
                        className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-lg text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                      />
                   </div>

                   {/* Subjective Score */}
                   <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest">คะแนนอัตนัย (Subjective)</label>
                      <input 
                        type="number" 
                        min="0"
                        step="0.5"
                        value={editScoreValues.subScore}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setEditScoreValues({...editScoreValues, subScore: Math.max(0, val)});
                        }}
                        className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl font-bold text-lg text-purple-700 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                      />
                   </div>

                   {/* Total Display */}
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">คะแนนรวม</div>
                      <div className="text-2xl lg:text-3xl font-black text-slate-800">{(parseFloat(editScoreValues.mcScore) || 0) + (parseFloat(editScoreValues.subScore) || 0)}</div>
                   </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                   <button 
                     onClick={() => setEditingScoreStudent(null)}
                     className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition-all"
                   >
                     ยกเลิก
                   </button>
                   <button 
                     onClick={handleSaveScoreEdit}
                     disabled={loading}
                     className="flex-1 px-4 py-3 bg-green-500 rounded-xl font-black text-xs uppercase tracking-wider text-white hover:bg-green-600 transition-all disabled:opacity-50"
                   >
                     {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoomResult;