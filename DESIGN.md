---
name: SmartExam System
description: Smart proctoring and examination web application for modern classrooms
colors:
  primary: "#f97316"
  primary-hover: "#ea580c"
  neutral-bg: "#f8fafc"
  neutral-surface: "#ffffff"
  neutral-border: "#f1f5f9"
  text-primary: "#1e293b"
  text-muted: "#64748b"
  accent-green: "#10b981"
  accent-red: "#ef4444"
typography:
  display:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, Noto Sans Thai, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card-container:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: SmartExam System

## 1. Overview

**Creative North Star: "The Smart Proctor Lab (ห้องแล็บคุมสอบอัจฉริยะ)"**

ระบบนี้ออกแบบมาเพื่อจำลองบรรยากาศห้องแล็บสำหรับทำข้อสอบและควบคุมสอบที่ล้ำสมัย ลื่นไหล และปลอดภัยสูงสุด ระบบเน้นความโปร่งใส ปราศจากสิ่งรบกวนสายตา เพื่อให้นักเรียนสามารถโฟกัสกับการทำข้อสอบได้อย่างเต็มที่ ขณะเดียวกันก็มอบแดชบอร์ดข้อมูลแบบเรียลไทม์ที่ชัดเจน แม่นยำ และทรงพลังให้กับคุณครูผู้ควบคุมสอบ 

สไตล์โดยรวมจะเน้นความสะอาดตา ข้อมูลมองเห็นชัดเจน ปรับปรุงรูปแบบเมนูที่เคยหนาแน่นและซับซ้อนให้กลายเป็นขั้นตอนที่เรียนรู้ได้ง่าย (Step-by-Step) และนำเสนอข้อมูลสถิติเชิงลึกผ่าน AI

**คุณลักษณะสำคัญ (Key Characteristics):**
*   **โปร่งใสและคมชัด (Clarity First):** ข้อมูลสถิติและคะแนนแสดงผลอย่างมีลำดับความสำคัญ (Visual Hierarchy) ชัดเจนสูงสุด
*   **ปลอดภัยแต่เป็นมิตร (Secure yet Welcoming):** การบล็อกการทุจริตและการเตือนพฤติกรรมทำงานอย่างรัดกุมโดยไม่ใช้น้ำเสียงเชิงลบหรือเอฟเฟกต์สีที่ทำให้ตื่นตระหนก
*   **ตอบสนองทันท่วงที (Real-time Responsiveness):** อินเทอร์เฟซตอบรับการทำงานทันที ลื่นไหลด้วยอนิมิชันที่ละเอียดอ่อนและรวดเร็ว

## 2. Colors

ระบบเลือกใช้กลุ่มสีโทนส้มอบอุ่นร่วมกับโทนสีธรรมชาติ เพื่อให้หน้าตาเว็บไซต์มีความเป็นมืออาชีพแต่น่าเชื่อถือและอบอุ่น

### Primary
*   **Proctor Orange** (`#f97316` / `oklch(0.67 0.22 39.4)`): สีแบรนด์หลัก ใช้สำหรับเน้นส่วนสำคัญ ปุ่มดำเนินการหลัก และองค์ประกอบสำคัญที่ต้องการความโดดเด่น
*   **Proctor Orange Dark** (`#ea580c` / `oklch(0.61 0.22 36.7)`): สีส้มเข้มขึ้น สำหรับแสดงสถานะ Hover หรือ Active ขององค์ประกอบหลัก

### Neutral
*   **Slate Background** (`#f8fafc` / `oklch(0.98 0.005 247)`): สีพื้นหลังหน้าเว็บหลัก เพื่อความสบายตาระหว่างอ่านโจทย์
*   **Pure Surface** (`#ffffff` / `oklch(1 0 0)`): สีพื้นผิวของการ์ดและพาเนลควบคุม เพื่อแยกแยะเนื้อหาออกจากพื้นหลัง
*   **Slate Ink** (`#1e293b` / `oklch(0.27 0.03 246)`): สีข้อความเนื้อหาหลัก (Body text) เพื่อให้อัตราความต่างของสี (Contrast Ratio) สูงกว่า 4.5:1 เสมอ อ่านง่ายชัดเจน
*   **Muted Ink** (`#64748b` / `oklch(0.55 0.03 246)`): สีข้อความอธิบาย หรือข้อความรองที่ไม่สำคัญ
*   **Border Gray** (`#f1f5f9` / `oklch(0.96 0.01 247)`): สีของขอบการ์ดและเส้นแบ่งองค์ประกอบ

### Accents
*   **Secure Green** (`#10b981` / `oklch(0.72 0.17 150)`): แสดงสถานะออนไลน์ ส่งข้อสอบสำเร็จ หรือคะแนนที่ผ่านเกณฑ์
*   **Alert Red** (`#ef4444` / `oklch(0.63 0.22 25)`): แสดงความเสี่ยงทุจริต การทำผิดกฎ หรือการหลุดออกจากระบบ

**กฎ "The Highlight Rule":**
เราจะใช้สีส้ม `primary` กับสิ่งสำคัญที่เป็นเป้าหมายหลักในหน้านั้น ๆ เท่านั้น (สัดส่วนไม่เกิน 10% ของพื้นผิวหน้าจอ) เพื่อให้จุดสำคัญสะดุดสายตาได้ทันที

## 3. Typography

**Display Font:** Inter, Noto Sans Thai, sans-serif
**Body Font:** Inter, Noto Sans Thai, sans-serif

ระบบเลือกใช้ชุดอักษรแบบไม่มีหัวสไตล์ Grotesque (Inter) ควบคู่กับ Noto Sans Thai เพื่อให้เกิดลุคที่ทันสมัย คมชัด และประมวลผลคำตอบได้ชัดเจนบนทุกขนาดหน้าจอ

### Hierarchy
*   **Display:** Bold (weight 900), `clamp(2rem, 5vw, 3.5rem)`, line-height 1.1, letter-spacing `-0.02em` – ใช้สำหรับหัวเรื่องหลักของหน้าจอ (Hero Title) เช่น หน้ายินดีต้อนรับ หรือข้อความประกาศสำคัญ
*   **Headline:** Semibold (weight 700), `24px` (1.5rem), line-height 1.2 – ใช้สำหรับชื่อกลุ่มเครื่องมือหรือหัวข้อการ์ดสำคัญ
*   **Title:** Semibold (weight 600), `18px` (1.125rem), line-height 1.3 – ใช้สำหรับโจทย์ข้อสอบ ชื่อวิชา หรือหัวข้อสถิติหลัก
*   **Body:** Medium (weight 500), `14px` (0.875rem), line-height 1.5 – สำหรับเนื้อหา ตัวเลือกคำตอบ คำอธิบายทั่วไป (จำกัดความยาวต่อบรรทัดที่ 65-75ch เพื่อไม่ให้ล้าสายตา)
*   **Label:** Bold (weight 700), `11px` (0.688rem), letter-spacing `0.05em`, Uppercase – สำหรับป้ายสถานะ (Badge) หรือหัวตาราง

## 4. Elevation

ระบบนำดีไซน์สไตล์ **Flat-by-Default / Layered** มาใช้งาน หน้าจอหลักเกือบทั้งหมดจะแบนราบ (Flat) ไปกับพื้นหลัง โดยแยกแยะองค์ประกอบหลักโดยการเล่นระดับสีพื้นผิว (Neutral bg vs Neutral surface) และขอบขนาด 1px (`border-slate-100`) 

ระบบจะเรียกใช้เงาที่จางและอ่อนนุ่มมากเฉพาะกับคอมโพเนนต์ลอยตัว หรือเมื่อมีปฏิสัมพันธ์จากผู้ใช้ (Interactive Response) เท่านั้น

### Shadow Vocabulary
*   **Interactive Hover:** `box-shadow: 0 4px 12px rgba(249, 115, 22, 0.08)` – เมื่อผู้ใช้ชี้ไปที่การ์ดห้องเรียนหรือปุ่มกดหลัก เพื่อสร้างฟีดแบ็กทางสายตา
*   **Floating Control:** `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.05)` – ใช้สำหรับหน้าต่างเด้งตอบโต้ (Modal dialog หรือ Slide-over panel)

## 5. Components

### Buttons
*   **Shape:** มุมโค้งปานกลาง (`border-radius: 12px` / `{rounded.md}`)
*   **Primary Button:** สีส้ม `primary` ตัวอักษรสีขาว ห้ามใส่เงาลอยตัวหนา (ใช้การขยายขนาด 1.02 และเพิ่มความสว่างสีส้มเล็กน้อยแทนเมื่อชี้เมาส์)
*   **Secondary/Ghost Button:** ขอบสี Slate จาง และขยายการตอบรับด้วยสีส้มจางเมื่อชี้เมาส์

### Cards (คลังข้อสอบ & ห้องเรียน)
*   **Shape:** ขอบโค้งมนเด่นชัด (`border-radius: 20px` / `{rounded.lg}`)
*   **Style:** พื้นหลังสีขาว ขอบ `1px border-slate-100` ไม่มีเงาที่สถานะปกติ แต่เมื่อ Hover จะเพิ่มขอบสีส้มบางและยกตัวลอยขึ้นเล็กน้อยด้วยเงา `Interactive Hover`

### Forms & Input Fields
*   **Shape:** ขอบโค้งมนแบบเดียวกับปุ่ม (`border-radius: 12px` / `{rounded.md}`)
*   **Style:** พื้นหลัง `slate-50` เสมอ และเมื่อคลิกเลือก (Focus State) จะเปลี่ยนพื้นหลังเป็นสีขาวพร้อมขอบสีส้มเรืองแสงรอบกล่องอินพุต

## 6. Do's and Don'ts

### Do's
*   **Do:** ใช้ระบบ Step-by-Step Wizard เพื่อช่วยคุณครูสร้างข้อสอบยาว ๆ ได้ทีละขั้นตอน ไม่ให้เกิดอาการข้อมูลท่วมท้น (Information Overload)
*   **Do:** รักษาสัดส่วนความต่างของสี (Contrast) ให้ชัดเจนระหว่างตัวหนังสือกับพื้นหลังเสมอ โดยเฉพาะข้อมูลประวัตินักเรียนและคะแนน
*   **Do:** แสดง Live Preview ของกระดาษคำถามฝั่งขวาเสมอขณะกำลังพิมพ์ข้อสอบ
*   **Do:** ทำระบบจัดเรียง (Sorting) ชื่อและเลขที่นักเรียนตามพฤติกรรมการทุจริตเพื่อให้ครูค้นหาได้ในทันที

### Don'ts
*   **Don't:** ห้ามใช้เงาสีดำเข้มหรือขนาดใหญ่กว่า 16px บนปุ่มหรือการ์ดแบบไม่มีเหตุผล
*   **Don't:** ห้ามใช้ขอบข้างสีหนา ๆ (Side-stripe borders) บนการ์ดรายงานผลหรือการ์ดประวัติการสอบ
*   **Don't:** ห้ามทำอนิเมชันกะพริบหรือการขยายตัวที่สั่นไหวกับหน้าจอทำข้อสอบของนักเรียน เพราะทำให้เสียสมาธิและเกิดความกังวล
*   **Don't:** ห้ามเปิดโอกาสให้ข้อมูลข้อสอบล้นหน้าจอ (Text Overflow) โดยเฉพาะบนหน้าจอโทรศัพท์มือถือและแท็บเล็ต
