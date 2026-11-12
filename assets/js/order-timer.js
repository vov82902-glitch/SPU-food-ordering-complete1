/* ==========================================================
   order-timer.js — จับเวลาออเดอร์ที่ร้านยังไม่กด "รับออเดอร์"
   ใช้ในหน้าร้าน (admin.html) · ต้องโหลดก่อน admin.js

   ทำ 2 อย่าง:
   1) นับถอยหลัง  : โชว์ "⏱ รับภายใน 2:45" ใต้เลขคิว อัปเดตทุก 1 วินาที
   2) เตือนร้าน   : ถ้าเกิน 3 นาทีแล้วยังไม่รับ -> เสียง + ข้อความ + แจ้งเตือนบนจอ
                   และเตือนซ้ำทุก 2 นาทีจนกว่าจะรับ

   สารบัญ
   1. ตั้งค่าเวลา
   2. เริ่ม / หยุดจับเวลา
   3. คำนวณเวลา
   4. นับถอยหลังบนหน้าจอ
   5. เตือนร้าน
========================================================== */


/* ----------------------------------------------------------
   1. ตั้งค่าเวลา (แก้ตัวเลขตรงนี้ที่เดียว)

   ทำไม 3 นาที   : ร้านควรเห็นออเดอร์ภายใน 1-2 นาที เกิน 3 นาทีแปลว่าน่าจะไม่ได้ดูจอ
   ทำไมซ้ำ 2 นาที : ถี่พอให้ไม่ลืม แต่ไม่ดังจนน่ารำคาญ
---------------------------------------------------------- */
const LATE_MINUTES = 3;           // สั่งมาแล้วกี่นาทีถึงนับว่า "ค้าง"
const REMIND_EVERY_MINUTES = 2;   // เตือนซ้ำทุกกี่นาที
const CHECK_EVERY_SECONDS = 30;   // เช็กออเดอร์ค้างทุกกี่วินาที

let remindTimer = null;      // ตัวจับเวลาเช็กออเดอร์ค้าง (ทุก 30 วินาที)
let countdownTimer = null;   // ตัวจับเวลาอัปเดตตัวเลขนับถอยหลัง (ทุก 1 วินาที)
let lastRemind = {};         // เตือนออเดอร์ไหนไปล่าสุดเมื่อไหร่ { รหัสออเดอร์: เวลา }


/* ----------------------------------------------------------
   2. เริ่ม / หยุดจับเวลา
   admin.js เรียก startLateCheck() ตอนร้านล็อกอิน
   และเรียก stopLateCheck() ตอนออกจากระบบ
---------------------------------------------------------- */
function startLateCheck() {
    stopLateCheck();   // กันเผลอเริ่มซ้ำ 2 ตัว
    lastRemind = {};
    remindTimer = setInterval(checkLateOrders, CHECK_EVERY_SECONDS * 1000);
    countdownTimer = setInterval(updateCountdowns, 1000);
}

function stopLateCheck() {
    clearInterval(remindTimer);
    clearInterval(countdownTimer);
    remindTimer = null;
    countdownTimer = null;
}


/* ----------------------------------------------------------
   3. คำนวณเวลา
---------------------------------------------------------- */

// ออเดอร์นี้รอมากี่นาทีแล้ว
function waitingMinutes(order) {
    return Math.floor((Date.now() - order.createdAt) / 60000);
}

// ออเดอร์นี้ "ค้าง" ไหม = ยังเป็นออเดอร์ใหม่ และรอเกิน 3 นาที
function isLate(order) {
    return order.status === 'new' && waitingMinutes(order) >= LATE_MINUTES;
}

// แปลงวินาทีเป็น "นาที:วินาที" เช่น 165 -> "2:45"
function minSec(seconds) {
    let m = Math.floor(seconds / 60);
    let s = seconds % 60;
    if (s < 10) s = '0' + s;
    return m + ':' + s;
}


/* ----------------------------------------------------------
   4. นับถอยหลังบนหน้าจอ

   หลักการ:
   - ตอนวาดตาราง ฝาก "เวลาที่ลูกค้าสั่ง" ไว้ใน data-created
   - ทุก 1 วินาที updateCountdowns() อ่านค่านั้น แล้วคำนวณเวลาที่เหลือใหม่
---------------------------------------------------------- */

// ข้อความ เช่น "⏱ รับภายใน 2:45" หรือถ้าเลยเวลาแล้ว "⏰ เกินเวลา 1:10"
function countdownText(createdAt) {
    let deadline = createdAt + LATE_MINUTES * 60000;         // ต้องรับก่อนเวลานี้
    let left = Math.round((deadline - Date.now()) / 1000);   // เหลืออีกกี่วินาที

    if (left > 0) {
        return '⏱ รับภายใน ' + minSec(left);
    } else {
        return '⏰ เกินเวลา ' + minSec(-left);
    }
}

// HTML ของตัวนับถอยหลัง (admin.js เรียกใช้ตอนวาดตาราง)
// โชว์เฉพาะออเดอร์ใหม่ ถ้ารับแล้วจะไม่มีตัวนับ
function countdownHtml(order) {
    if (order.status !== 'new') return '';
    return '<small class="countdown" data-created="' + order.createdAt + '">' +
        countdownText(order.createdAt) + '</small>';
}

// ทำงานทุก 1 วินาที: อัปเดตตัวนับทุกตัวที่อยู่บนหน้าจอ
function updateCountdowns() {
    let boxes = document.querySelectorAll('.countdown');

    for (let i = 0; i < boxes.length; i++) {
        let box = boxes[i];
        let createdAt = Number(box.dataset.created);
        let over = Date.now() - createdAt >= LATE_MINUTES * 60000;   // เลยเวลาแล้วหรือยัง

        box.textContent = countdownText(createdAt);
        box.classList.toggle('over', over);   // เลยเวลา -> ตัวหนังสือสีแดง

        let row = box.closest('tr, .order-card');   // แถวในตาราง หรือการ์ดในกระดาน -> เป็นสีแดง
        if (row) row.classList.toggle('late', over);
    }
}


/* ----------------------------------------------------------
   5. เตือนร้าน (ทำงานทุก 30 วินาที)

   ขั้นตอน:
   1) หาออเดอร์ที่ค้าง
   2) ข้ามตัวที่เพิ่งเตือนไปไม่ถึง 2 นาที
   3) ที่เหลือ -> เตือน
---------------------------------------------------------- */
function checkLateOrders() {
    if (!adminStore) return;   // ยังไม่ได้ล็อกอินร้าน

    // 1) + 2) หาออเดอร์ที่ถึงเวลาต้องเตือน
    let orders = adminOrders();
    let now = Date.now();
    let needRemind = [];

    for (let i = 0; i < orders.length; i++) {
        let order = orders[i];
        if (!isLate(order)) continue;

        let last = lastRemind[order.id];
        if (last && now - last < REMIND_EVERY_MINUTES * 60000) continue;

        lastRemind[order.id] = now;
        needRemind.push(order);
    }

    if (needRemind.length === 0) return;

    // 3) เตือน: ข้อความ เช่น "A003 (รอ 4 นาที), A004 (รอ 3 นาที)"
    let names = [];
    for (let i = 0; i < needRemind.length; i++) {
        names.push(needRemind[i].queue + ' (รอ ' + waitingMinutes(needRemind[i]) + ' นาที)');
    }
    let text = 'มีออเดอร์ยังไม่ได้รับ: ' + names.join(', ');

    adminToast('⏰ ' + text);                                         // ข้อความบนหน้าเว็บ
    if (adminConfig().sound) beep(3);                                // เสียง (ถ้าร้านเปิดเสียงไว้)
    desktopNotify('ออเดอร์รอนานแล้ว', adminStore.name + ' · ' + text); // แจ้งเตือนมุมจอ
    renderAll();                                                     // วาดตารางใหม่
}
