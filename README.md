# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

---

## ☁️ การนำระบบขึ้นโฮสต์บน Cloudflare Pages

แอปพลิเคชันนี้ได้รับการออกแบบและจัดเตรียมไฟล์ให้พร้อมนำขึ้นโฮสต์บน **Cloudflare Pages** เรียบร้อยแล้ว

### ขั้นตอนการ Deploy ผ่าน Cloudflare Dashboard
1. เข้าสู่ระบบ [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. ไปที่เมนู **Workers & Pages** -> คลิกปุ่ม **Create application** -> เลือกแท็บ **Pages**
3. **ทางเลือกที่ 1: เชื่อมต่อ Git (แนะนำ)**
   - เลือก **Connect to Git** และเลือก Repository ของโปรเจกต์นี้
   - ในการตั้งค่า build:
     - **Framework preset:** `Vite` (หรือเลือก `None`)
     - **Build command:** `npm run build`
     - **Build output directory:** `dist`
4. **ทางเลือกที่ 2: อัปโหลดโดยตรง (Direct Upload)**
   - ทำการ build โปรเจกต์ในเครื่องด้วยคำสั่ง `npm run build`
   - จะได้โฟลเดอร์ `dist` ให้ลากโฟลเดอร์นี้ไปวางอัปโหลดบน Cloudflare Pages
   *หมายเหตุ: ไฟล์ `_redirects` ที่เตรียมไว้ในโฟลเดอร์ public จะถูกสำเนาไปยัง dist โดยอัตโนมัติเพื่อทำหน้าที่แก้ปัญหา 404 Routing*

### 🔑 การตั้งค่า Environment Variables (API Keys)
เนื่องจากระบบใช้ Firebase และ AI (Groq SDK) ในการประมวลผล จำเป็นต้องกำหนดค่าเหล่านี้บน Cloudflare Dashboard เพื่อให้ระบบปลายทางทำงานได้:
1. ที่หน้าโปรเจกต์บน Cloudflare Pages ไปที่แท็บ **Settings** -> เลือกเมนู **Environment variables**
2. คลิก **Add variables** ในส่วนของ **Production** และ **Preview**
3. เพิ่มตัวแปรต่อไปนี้ (คัดลอกค่าจากไฟล์ `.env` ไปใส่):
   - `VITE_GROQ_API_KEY` (คีย์สำหรับ AI ตรวจข้อเขียน)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
4. กดบันทึก (Save) จากนั้นทำการ **Redeploy** เพื่อให้ระบบดึงค่าตัวแปรเหล่านี้ไปใช้งานจริง
