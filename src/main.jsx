import React from 'react' // <--- เพิ่มบรรทัดนี้ครับ
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // ตรวจสอบว่า import ไฟล์ css ที่มี tailwind แล้ว

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)