import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { usePopup } from '../components/PopupProvider';
import { 
  ShieldAlert, Clock, Send, ChevronLeft, Sparkles, Loader2, AlertTriangle, FileText, Flag, Activity
} from 'lucide-react';
import Groq from 'groq-sdk';

const ExamPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = usePopup();
  
  // States
  const [room, setRoom] = useState(null);
  const [exam, setExam] = useState(null);
  const [student, setStudent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({}); // { [qIdx]: true }
  const [showCheatModal, setShowCheatModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultScores, setResultScores] = useState(null);
  const [isGradingSubjective, setIsGradingSubjective] = useState(false);
  const [cheatLimitReached, setCheatLimitReached] = useState(false);
  const [cheatAttemptCount, setCheatAttemptCount] = useState(0);
  const [isRetry, setIsRetry] = useState(false);
  const [originalExam, setOriginalExam] = useState(null); // Store original questions for answer checking
  const [inactivityAlert, setInactivityAlert] = useState(false); // Inactivity alert modal state
  const [timeLeft, setTimeLeft] = useState(null); // Countdown timer in seconds
  const [isFullscreen, setIsFullscreen] = useState(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement));
  const hasEnteredFullscreen = React.useRef(false);
  const [fullscreenCountdown, setFullscreenCountdown] = useState(null);

  const enterFullscreen = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE11 */
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
      hasEnteredFullscreen.current = true;
    } catch (err) {
      console.warn("Fullscreen request denied or failed:", err);
      showAlert("ไม่สามารถเข้าสู่โหมดเต็มหน้าจอได้ กรุณาลองใหม่อีกครั้ง หรือตรวจสอบสิทธิ์ของเบราว์เซอร์", "error");
    }
  };

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

  // Utility: Shuffle array using Fisher-Yates algorithm
  const shuffleArray = (arr) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // 1. Initial Data Fetching
  useEffect(() => {
    if (!state?.roomId || !state?.studentId) { navigate('/'); return; }

    // ฟังสถานะห้อง (ถ้าจบการสอบ หรือถูกเตะ หรือห้องถูกลบ)
    const unsubRoom = onSnapshot(doc(db, 'rooms', state.roomId), async (snap) => {
      if (snap.exists()) {
        const rData = snap.data();
        setRoom(rData);
        
        if (rData.status === 'finished') {
          await showAlert("การสอบสิ้นสุดแล้ว", "info");
          navigate('/');
          return;
        }
      } else {
        // กรณีที่เอกสารห้องสอบถูกลบออกจากฐานข้อมูล
        await showAlert("ห้องสอบนี้ถูกลบแล้ว คุณจะถูกนำออกจากห้องสอบ", "error");
        navigate('/');
        return;
      }
    });

    // ฟังสถานะตัวเอง (โดนเตะ หรือ Cheat Count)
    const unsubStudent = onSnapshot(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), async (snap) => {
      if (snap.exists()) {
        const sData = snap.data();
        setStudent(sData);
        setAnswers(sData.answers || {});
        
        // ถ้าสถานะเป็น kicked ให้เด้งออก
        if (sData.status === 'kicked') {
          await showAlert("คุณถูกเชิญออกจากห้องสอบ", "error");
          navigate('/');
        }
      }
    });

    return () => { unsubRoom(); unsubStudent(); };
  }, [state, navigate]);

  // Auto-kick when cheatCount exceeds room limit
  useEffect(() => {
    if (!student || !room) return;
    // If room configured to ignore cheat count, do nothing
    if (room?.ignoreCheatCount) return;
    const maxCheats = room?.maxCheats ?? 3;
    if ((student.cheatCount || 0) >= maxCheats && !student.disqualified) {
      // Show cheat limit modal
      setCheatLimitReached(true);
      setCheatAttemptCount((student.cheatCount || 0));
    }
  }, [student, room, navigate, state]);

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

  // 2. Fetch Exam Content
  useEffect(() => {
    if (room?.examId) {
      getDoc(doc(db, 'exams', room.examId)).then(docSnap => {
        if (docSnap.exists()) {
          const examData = docSnap.data();
          setOriginalExam(examData); // Store original for answer checking
          
          // Apply shuffling if enabled
          if (room.randomizeQuestions || room.randomizeChoices) {
            const shuffledExam = { ...examData };
            
            // Shuffle question order
            if (room.randomizeQuestions) {
              shuffledExam.questions = shuffleArray(examData.questions);
            }
            
            // Shuffle choices within each question
            if (room.randomizeChoices) {
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
      });
    }
  }, [room]);

  // 3. Anti-Cheat System (Core Logic) - Tab Visibility & Focus/Blur Detection
  useEffect(() => {
    let lastTrigger = 0;
    
    const triggerCheat = async (reason) => {
      const now = Date.now();
      // ป้องกันการบวกคะแนนทุจริตซ้ำซ้อนภายในเวลา 3 วินาที
      if (now - lastTrigger < 3000) return;
      lastTrigger = now;

      if (room?.ignoreCheatCount) return;
      if (!state?.roomId || !state?.studentId || student?.disqualified) return;

      try {
        await updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
          cheatCount: increment(1),
          isTabSwitched: true,
          lastCheatReason: reason
        });
        setShowCheatModal(true);
      } catch (err) {
        console.error('Error recording tab/window cheat:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerCheat('tab_hidden');
      } else {
        if (state?.roomId && state?.studentId) {
          updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
            isTabSwitched: false
          }).catch(() => {});
        }
      }
    };

    const handleWindowBlur = () => {
      triggerCheat('window_blurred');
    };

    const handleWindowFocus = () => {
      if (state?.roomId && state?.studentId) {
        updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
          isTabSwitched: false
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [state, room, student?.disqualified]);

  // 3b. Anti-Cheat System - Tab/Window Close Detection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only count as cheat if room is still active and not finished
      if (!state?.roomId || !state?.studentId || !room || room.status === 'finished') return;
      
      // If room is configured to ignore cheat count, do nothing
      if (room?.ignoreCheatCount) return;
      
      // Increment cheat count for tab close
      updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
        cheatCount: increment(1),
        tabClosed: true,
        lastCheatReason: 'closed_tab'
      }).catch(err => console.error('Error recording tab close:', err));
      
      // Show browser confirmation (optional)
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state, room]);

  // 3c. Anti-Cheat: Full-screen Enforcement & Grace Period Timer
  useEffect(() => {
    const handleFullscreenChange = () => {
      const activeFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      setIsFullscreen(activeFullscreen);

      if (room?.ignoreCheatCount) return;

      // หากหลุดจาก Fullscreen และเคยเข้าโหมด Fullscreen ไปแล้วอย่างน้อย 1 ครั้ง
      if (!activeFullscreen && hasEnteredFullscreen.current && state?.roomId && state?.studentId && !student?.disqualified) {
        updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
          cheatCount: increment(1),
          lastCheatReason: 'exited_fullscreen'
        }).catch(err => console.error('Error updating cheat count (fullscreen):', err));
        
        setShowCheatModal(true);
        // เริ่มต้นนับถอยหลัง Grace Period
        setFullscreenCountdown(room?.fullscreenGracePeriod ?? 5);
      } else if (activeFullscreen) {
        // หากกลับมาเข้า Fullscreen ได้สำเร็จ ให้หยุดการนับถอยหลัง
        setFullscreenCountdown(null);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [state, room, student?.disqualified]);

  // เอฟเฟกต์สำหรับนับถอยหลังกรณีหลุดจาก Fullscreen
  useEffect(() => {
    if (isFullscreen || fullscreenCountdown === null || room?.status !== 'started') {
      return;
    }

    const timer = setInterval(async () => {
      setFullscreenCountdown(prev => {
        if (prev <= 1) {
          // เมื่อหมดเวลานับถอยหลัง (เหลือ 0)
          if (state?.roomId && state?.studentId && !student?.disqualified) {
            updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
              cheatCount: increment(1),
              lastCheatReason: 'fullscreen_grace_timeout'
            }).catch(err => console.error('Error updating grace timeout cheat:', err));
          }
          // รีเซ็ตเวลากลับไปเริ่มต้นใหม่เพื่อวนลูปรอบถัดไป
          return room?.fullscreenGracePeriod ?? 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFullscreen, fullscreenCountdown, room, state, student?.disqualified]);

  // 3d. Anti-Cheat: Disable Copy-Paste (silent block)
  useEffect(() => {
    const handleCopy = (e) => {
      e.preventDefault();
      // Silent block - no alert to avoid disruption
    };

    const handlePaste = (e) => {
      e.preventDefault();
    };

    const handleCut = (e) => {
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  }, []);

  // 3e. Anti-Cheat: Disable Developer Tools
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (room?.ignoreCheatCount) return;

      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C')
      ) {
        e.preventDefault();
        if (state?.roomId && state?.studentId) {
          updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
            cheatCount: increment(1),
            lastCheatReason: 'opened_devtools'
          });
        }
        showAlert('ห้ามเปิด Developer Tools', 'error');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state, room]);

  // Grade subjective answers using Groq AI
  const gradeSubjectiveAnswers = async (examData, submittedAnswers) => {
    if (!examData) return {};
    
    const subjectiveScores = {};
    
    if (!groq) {
      console.warn("⚠️ ไม่พบ Groq API Key หรือเริ่มต้นโปรแกรมไม่สำเร็จ ข้ามการตรวจข้อเขียนด้วย AI");
      // ตั้งคะแนนทุกข้ออัตนัยเป็น 0 ชั่วคราวเพื่อให้ครูตรวจเอง
      for (let i = 0; i < examData.questions.length; i++) {
        if (examData.questions[i].type === 'subjective') {
          subjectiveScores[i] = 0;
        }
      }
      return subjectiveScores;
    }
    const subjectiveQuestions = examData.questions.filter(q => q.type === 'subjective');
    
    if (subjectiveQuestions.length === 0) return {}; // No subjective questions
    
    for (let i = 0; i < examData.questions.length; i++) {
      const q = examData.questions[i];
      
      if (q.type === 'subjective') {
        const studentAnswer = submittedAnswers?.[i] || '(ไม่มีคำตอบ)';
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
          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 50
          });
          
          // Validate API response
          if (!completion?.choices?.[0]?.message?.content) {
            console.error(`[AI Grading Error] Q${i + 1}: Invalid API response`);
            subjectiveScores[i] = 0;
            continue;
          }
          
          const rawScore = completion.choices[0].message.content.trim();
          const score = Math.min(parseInt(rawScore) || 0, maxScore);
          subjectiveScores[i] = Math.max(0, score);
        } catch (err) {
          console.error(`[AI Grading Error] Q${i + 1}:`, err);
          subjectiveScores[i] = 0;
        }
      }
    }
    
    return subjectiveScores;
  };

  // 4. Handle Answer & Auto-save with error handling
  const handleAnswer = async (qIdx, value) => {
    const newAnswers = { ...answers, [qIdx]: value };
    setAnswers(newAnswers);
    
    // Auto-save to Firestore
    if (state?.roomId && state?.studentId) {
      try {
        await updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
          [`answers.${qIdx}`]: value,
          lastActive: serverTimestamp()
        });
      } catch (err) {
        console.error('Error saving answer:', err);
        // Silently fail - answer is still stored in state
      }
    }
  };

  const handleSubmit = async () => {
    // ตรวจสอบว่าตอบครบทุกข้อหรือไม่
    const unansweredQuestions = [];
    exam.questions.forEach((q, idx) => {
      const answer = answers[idx];
      if (answer === undefined || answer === '') {
        unansweredQuestions.push(idx + 1);
      }
    });

    if (unansweredQuestions.length > 0) {
      await showAlert(
        'ตอบข้อสอบยังไม่ครบ!',
        'warning',
        `กรุณาตอบคำถามให้ครบถ้วนก่อนส่ง (ยังเหลือข้อที่: ${unansweredQuestions.join(', ')})`
      );
      return;
    }

    const isConfirm = await showConfirm(
      "ยืนยันการส่งข้อสอบ?",
      "เมื่อส่งข้อสอบแล้ว จะไม่สามารถกลับมาแก้ไขคำตอบได้อีกครั้ง"
    );
    if (!isConfirm) return;
    
    setIsSubmitting(true);
    setIsGradingSubjective(false);
    try {
      await updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        answers: answers,
        examData: exam,
        ...(isRetry ? { isCheatingSubmission: true, cheatAttemptNumber: cheatAttemptCount } : {})
      });

      const mcScores = calculateScores({ answers, student });
      setResultScores(mcScores);
      setShowResult(true);

      setIsGradingSubjective(true);
      const subjectiveScores = await gradeSubjectiveAnswers(originalExam || exam, answers);
      
      await updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
        subjectiveScores: subjectiveScores,
        aiGradedAt: serverTimestamp()
      });
      
      const fullScores = calculateScores({ answers, student: { ...student, subjectiveScores } });
      setResultScores(fullScores);
      setIsGradingSubjective(false);
    } catch (e) {
      console.error(e);
      await showAlert("เกิดข้อผิดพลาดในการส่งข้อสอบ", "error");
      setIsGradingSubjective(false);
    }
    setIsSubmitting(false);
  };

  const handleTryAgain = async () => {
    // Reset exam for retry
    setCheatLimitReached(false);
    setIsRetry(true);
    setAnswers({});
    setCurrentIndex(0);
    
    // Log the retry attempt
    await updateDoc(doc(db, `rooms/${state.roomId}/attendance/${state.studentId}`), {
      retryAttempt: increment(1),
      lastRetryTime: serverTimestamp()
    });
  };

  // Calculate MC/sub scores
  const calculateScores = ({ answers: providedAnswers, student: stu }) => {
    // Use the current exam (shuffled if randomization is enabled) for answer checking
    // This ensures answers match the question order the student actually saw
    const examToCheck = exam;
    if (!examToCheck) return { mcScore: 0, subScore: 0, totalScore: 0, maxMc: 0, maxSub: 0 };
    let mc = 0, maxMc = 0;
    let sub = 0, maxSub = 0;
    examToCheck.questions.forEach((q, idx) => {
      if (q.type === 'multiple') {
        const maxScore = q.maxScore || 1;
        maxMc += maxScore;
        const correctAnswer = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
        if ((providedAnswers || answers)[idx] === correctAnswer) mc += maxScore;
      } else {
        const maxScore = q.maxScore || q.points || 10;
        maxSub += maxScore;
        const stuSubScores = stu?.subjectiveScores || {};
        sub += Number(stuSubScores[idx] || 0);
      }
    });
    const total = Math.round((mc + sub) * 100) / 100;
    return { mcScore: mc, subScore: sub, totalScore: total, maxMc, maxSub, maxTotal: maxMc + maxSub };
  };

  if (!exam || !student) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-orange-500" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 select-none">
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 z-40 px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic shadow-md">
            {exam.title.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-xs lg:text-sm text-slate-800 italic uppercase tracking-tight truncate max-w-[120px] lg:max-w-xs">{exam.title}</h1>
            <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 truncate">{student.name}</p>
          </div>
        </div>
        
        {/* Timer */}
        <div className="bg-slate-800 text-white px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl flex items-center gap-2 shadow-lg">
          <Clock size={12} className="text-orange-400" />
          <span className="font-mono font-black text-xs lg:text-sm tracking-widest">
            {timeLeft !== null ? (
              `${Math.floor(timeLeft / 60).toString().padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`
            ) : (
              <span className="hidden sm:block">Running</span>
            )}
            {timeLeft === null && <span className="sm:hidden">▶</span>}
          </span>
        </div>
      </header>

      {/* Exam Content */}
      <div className="pt-20 lg:pt-24 px-3 lg:px-4 max-w-5xl mx-auto space-y-4">
        {/* Randomization Info */}
        {(room?.randomizeQuestions || room?.randomizeChoices) && (
          <div className="text-center">
            <p className="text-[9px] lg:text-xs font-bold text-blue-600 uppercase tracking-wide">
              🔀 ข้อสอบนี้มีการสุ่มลำดับ {room?.randomizeQuestions && room?.randomizeChoices ? '(คำถาม + ตัวเลือก)' : room?.randomizeQuestions ? '(คำถาม)' : '(ตัวเลือก)'}
            </p>
          </div>
        )}

        {/* Progression Bar */}
        {(() => {
          const total = exam.questions.length;
          const answeredCount = exam.questions.filter((_, idx) => answers[idx] !== undefined && answers[idx] !== '').length;
          const progressPercent = total > 0 ? (answeredCount / total) * 100 : 0;
          return (
            <div className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-slate-500 italic">ความคืบหน้าการทำข้อสอบ</span>
                <span className="text-xs font-black text-orange-600 italic">ตอบแล้ว {answeredCount} จาก {total} ข้อ ({Math.round(progressPercent)}%)</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500"
                />
              </div>
            </div>
          );
        })()}

        {/* Responsive Grid Layout: Left Question Card / Right Navigation Panel */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Panel: Question Card */}
          <div className="flex-1 w-full min-w-0">
            {(() => {
              const total = exam.questions.length;
              const q = exam.questions[currentIndex];
              return (
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white p-4 lg:p-6 md:p-8 rounded-xl lg:rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-10 h-10 lg:w-12 lg:h-12 bg-slate-50 rounded-br-xl lg:rounded-br-2xl flex items-center justify-center font-black text-slate-300 text-xs lg:text-sm border-r border-b border-slate-100">
                    {currentIndex + 1}
                  </div>

                  <div className="mt-4 mb-6">
                    <h3 className="text-base lg:text-lg font-bold text-slate-800 leading-relaxed italic">{q.question}</h3>
                    {q.points && <span className="text-[9px] lg:text-[10px] font-black text-orange-400 bg-orange-50 px-2 py-1 rounded-md uppercase tracking-wide mt-2 inline-block">{q.points} คะแนน</span>}
                  </div>

                  {q.type === 'multiple' ? (
                    <div className="grid gap-3">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = answers[currentIndex] === oIdx;
                        return (
                          <button
                            key={oIdx}
                            onClick={() => !student?.disqualified && handleAnswer(currentIndex, oIdx)}
                            disabled={student?.disqualified}
                            className={`w-full text-left p-3 lg:p-4 rounded-xl border-2 transition-all flex items-center gap-3 group ${
                              student?.disqualified ? 'opacity-60 cursor-not-allowed' : isSelected
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-orange-200'
                            }`}
                          >
                            <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center font-black text-[10px] lg:text-xs transition-colors ${
                              isSelected ? 'bg-orange-500 text-white' : 'bg-white text-slate-300 border border-slate-200'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className={`font-bold text-xs lg:text-sm ${isSelected ? 'text-orange-700' : 'text-slate-600'}`}>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="relative">
                      <FileText className="absolute top-3 lg:top-4 left-3 lg:left-4 text-slate-300" size={14} lg:size={18} />
                      <textarea
                        rows={4} lg:rows={5}
                        value={answers[currentIndex] || ''}
                        onChange={(e) => !student?.disqualified && handleAnswer(currentIndex, e.target.value)}
                        placeholder="พิมพ์คำตอบของคุณที่นี่..."
                        readOnly={student?.disqualified}
                        className={`w-full pl-10 lg:pl-12 pr-3 lg:pr-4 py-3 lg:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl lg:rounded-2xl font-bold text-slate-700 text-sm outline-none focus:border-orange-400 focus:bg-white transition-all resize-none leading-relaxed ${student?.disqualified ? 'opacity-60' : ''}`}
                      />
                      {!groq && (
                        <p className="text-[11px] font-bold text-slate-400 mt-1.5 ml-1 italic">
                          *(ระบบตรวจคำตอบอัตนัยด้วย AI ปิดใช้งานชั่วคราว คุณครูจะเป็นผู้ตรวจให้คะแนนภายหลัง)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    <button
                      onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                      disabled={currentIndex === 0 || student?.disqualified}
                      className={`w-full sm:w-auto px-4 py-3 rounded-xl font-black text-sm transition-colors ${currentIndex === 0 || student?.disqualified ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-200 hover:bg-slate-100'}`}
                    >
                      ย้อนกลับ
                    </button>

                    <div className="flex items-center gap-4">
                      {/* Flag System Button */}
                      <button
                        onClick={() => setFlaggedQuestions(prev => ({ ...prev, [currentIndex]: !prev[currentIndex] }))}
                        disabled={student?.disqualified}
                        className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-black ${
                          flaggedQuestions[currentIndex]
                            ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-sm animate-pulse'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                        }`}
                        title="ปักธงข้อนี้เพื่อกลับมาทบทวนภายหลัง"
                      >
                        <Flag size={14} className={flaggedQuestions[currentIndex] ? 'fill-amber-500 text-amber-500' : ''} />
                        <span>{flaggedQuestions[currentIndex] ? 'ปักธงแล้ว' : 'ปักธงทบทวน'}</span>
                      </button>
                      
                      <div className="text-sm font-black text-slate-500">ข้อที่ {currentIndex + 1} / {total}</div>
                    </div>

                    {currentIndex < total - 1 ? (
                      <button
                        onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
                        disabled={student?.disqualified}
                        className={`w-full sm:w-auto px-4 py-3 rounded-xl font-black text-sm transition-all ${student?.disqualified ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                      >
                        ถัดไป
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || student?.disqualified}
                        className={`w-full sm:w-auto px-4 py-3 rounded-xl font-black text-sm transition-all ${isSubmitting || student?.disqualified ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-orange-500'}`}
                      >
                        {isSubmitting ? 'กำลังส่ง...' : 'ส่งข้อสอบ'}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </div>

          {/* Right Panel: Question Navigation Grid */}
          <div className="w-full lg:w-80 flex-shrink-0 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div>
              <h4 className="text-xs font-black text-slate-600 italic tracking-wide uppercase flex items-center gap-1.5 mb-1">
                <Activity size={14} className="text-orange-500" />
                แผงควบคุมข้อสอบ
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold leading-none">คลิกที่เลขข้อเพื่อข้ามไปยังข้อนั้นทันที</p>
            </div>
            
            <div className="grid grid-cols-5 gap-2.5">
              {exam.questions.map((q, idx) => {
                const isCurrent = currentIndex === idx;
                const isAnswered = answers[idx] !== undefined && answers[idx] !== '';
                const isFlagged = flaggedQuestions[idx];
                
                let btnClass = "w-full aspect-square rounded-xl font-black text-xs transition-all flex flex-col items-center justify-center relative cursor-pointer ";
                
                if (isCurrent) {
                  btnClass += "ring-2 ring-orange-500 bg-white text-orange-600 border border-orange-200 shadow-sm";
                } else if (isAnswered) {
                  btnClass += "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 border border-emerald-500";
                } else if (isFlagged) {
                  btnClass += "bg-amber-50 border border-amber-300 text-amber-600 hover:bg-amber-100";
                } else {
                  btnClass += "bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100";
                }
                
                return (
                  <button 
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    disabled={student?.disqualified}
                    className={btnClass}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <Flag size={8} className="absolute top-1.5 right-1.5 text-amber-500 fill-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-50 space-y-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-lg bg-emerald-500" />
                <span>ตอบแล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center"><Flag size={8} className="text-amber-500 fill-amber-500" /></div>
                <span>ปักธงทบทวน</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-lg bg-slate-50 border border-slate-100" />
                <span>ยังไม่ได้ทำ</span>
              </div>
            </div>
          </div>
          
        </div>


        

      </div>

      {/* Cheat Limit Reached Modal */}
      <AnimatePresence>
        {cheatLimitReached && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-12 rounded-[3rem] max-w-sm w-full relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-3 bg-red-500 animate-pulse" />
               <ShieldAlert size={80} className="text-red-500 mx-auto mb-8 animate-bounce" />
               <h2 className="text-3xl font-black text-slate-800 uppercase italic mb-4 tracking-tight">ครบจำนวนครั้งแล้ว!</h2>
               <p className="text-slate-600 text-sm font-bold mb-2">คุณทำการทุจริตมา {cheatAttemptCount} ครั้ง</p>
               <p className="text-slate-500 text-xs font-bold mb-8">หากต้องการทำใหม่ ข้อสอบครั้งนี้จะถูกบันทึกว่าเป็นการทุจริต</p>
               
               <div className="space-y-3">
                 <button 
                   onClick={() => navigate('/')}
                   className="w-full py-4 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-slate-900 transition-colors"
                 >
                   ไปหน้าหลัก
                 </button>
                 <button 
                   onClick={handleTryAgain}
                   className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-orange-600 transition-colors border-2 border-orange-500"
                 >
                   ทำใหม่ (จะบันทึกว่าทุจริต)
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inactivity Alert Modal */}
      <AnimatePresence>
        {inactivityAlert && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2rem] max-w-sm w-full relative"
            >
               <AlertTriangle size={64} className="text-orange-500 mx-auto mb-4 animate-pulse" />
               <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-3">นั่งนิ่งเกิน 5 นาที</h2>
               <p className="text-slate-600 text-sm font-bold mb-6">ระบบบันทึกพฤติกรรมนี้เป็นการทุจริตแล้ว</p>
               <button 
                 onClick={() => setInactivityAlert(false)}
                 className="w-full py-3 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-900 transition-colors"
               >
                 รับทราบ
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Result Modal after submission */}
      <AnimatePresence>
        {showResult && resultScores && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 max-w-lg w-full">
              <h2 className="text-2xl font-black text-slate-800 mb-2">ผลการสอบ</h2>
              <p className="text-sm text-slate-500 mb-4">
                {isGradingSubjective 
                  ? '🤖 ระบบ AI กำลังตรวจคำตอบอัตนัย...'
                  : 'ผลคะแนนตอนนี้แสดงคะแนนจากข้อปรนัย และอัตนัย'}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <div className="text-xs font-black text-blue-600 uppercase">ปรนัย</div>
                  <div className="text-2xl font-black text-blue-700">{resultScores.mcScore}</div>
                  <div className="text-xs text-blue-500">/ {resultScores.maxMc}</div>
                </div>
                <div className={`p-4 rounded-xl text-center ${isGradingSubjective ? 'bg-purple-100 animate-pulse' : 'bg-purple-50'}`}>
                  <div className="text-xs font-black text-purple-600 uppercase">อัตนัย</div>
                  <div className="text-2xl font-black text-purple-700">{resultScores.subScore}</div>
                  <div className="text-xs text-purple-500">/ {resultScores.maxSub}</div>
                  {isGradingSubjective && <div className="text-[10px] mt-1 text-purple-500 font-bold">ตรวจอยู่...</div>}
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <div className="text-xs font-black text-green-600 uppercase">รวม</div>
                  <div className="text-2xl font-black text-green-700">{resultScores.totalScore}</div>
                  <div className="text-xs text-green-500">/ {resultScores.maxTotal}</div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-6">
                {isGradingSubjective 
                  ? '✨ AI กำลังประเมินคำตอบแต่ละข้อตามเกณฑ์คะแนน'
                  : '📝 หมายเหตุ: ครูสามารถปรับแต่งคะแนนอัตนัยได้ในภายหลัง'}
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowResult(false); navigate('/'); }} 
                  disabled={isGradingSubjective}
                  className={`flex-1 py-3 rounded-xl font-black transition-all ${isGradingSubjective ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                >
                  เสร็จสิ้น
                </button>
                <button 
                  onClick={() => setShowResult(false)} 
                  disabled={isGradingSubjective}
                  className={`flex-1 py-3 rounded-xl font-black transition-all ${isGradingSubjective ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white border border-slate-200 hover:bg-slate-50'}`}
                >
                  ดูต่อ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cheat Alert Modal */}
      <AnimatePresence>
        {showCheatModal && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-10 rounded-[3rem] max-w-sm w-full relative overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-2 bg-red-500 animate-pulse" />
               <ShieldAlert size={64} className="text-red-500 mx-auto mb-6 animate-bounce" />
               <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">ตรวจพบการสลับจอ!</h2>
               <p className="text-slate-500 text-xs font-bold mb-8">ระบบได้บันทึกพฤติกรรมนี้และแจ้งเตือนไปยังผู้คุมสอบแล้ว</p>
               <button 
                 onClick={() => setShowCheatModal(false)}
                 className="w-full py-3 bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-600 transition-colors"
               >
                 รับทราบ
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Enforcer Overlay */}
      <AnimatePresence>
        {!isFullscreen && room?.status === 'started' && !student?.disqualified && !cheatLimitReached && !showResult && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[80] flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 lg:p-12 rounded-[2.5rem] max-w-md w-full relative overflow-hidden shadow-2xl border border-slate-100"
            >
               <div className="absolute top-0 left-0 w-full h-2 bg-orange-500 animate-pulse" />
               <ShieldAlert size={64} className="text-orange-500 mx-auto mb-6 animate-pulse" />
               <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-3">จำเป็นต้องเปิดโหมดเต็มหน้าจอ</h2>
               
               {fullscreenCountdown !== null && (
                 <div className="bg-red-50 text-red-600 px-4 py-2.5 rounded-2xl border border-red-100 font-black text-sm mb-4 animate-pulse">
                   ⚠️ กรุณากลับเข้าเต็มจอภายใน {fullscreenCountdown} วินาที
                 </div>
               )}

               <p className="text-slate-500 text-xs font-bold mb-8">
                 เพื่อรักษาความโปร่งใสในการสอบ กรุณากดปุ่มด้านล่างเพื่อเข้าสู่โหมดเต็มหน้าจอ หากคุณไม่ยอมเข้าโหมดเต็มหน้าจอภายในเวลาที่กำหนด คะแนนทุจริตจะเพิ่มขึ้นเรื่อย ๆ
               </p>
               <button 
                 onClick={enterFullscreen}
                 className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest text-sm hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
               >
                 เข้าสู่โหมดเต็มหน้าจอ
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ExamPage;