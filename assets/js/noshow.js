/* ==========================================================
   noshow.js — กติกา "ลูกค้าสั่งแล้วไม่มารับ"
   ใช้ในหน้า: ตะกร้า (cart), ข้อมูลของฉัน (profile), หน้าร้าน (admin)
   ต้องโหลดหลัง main.js

   ทำไมต้องมี: ระบบให้จ่ายเงินสดตอนรับอาหาร ถ้าลูกค้าไม่มา ร้านเสียอาหารฟรี
   จึงป้องกัน 3 ชั้น:
   1) อาหารพร้อมแล้วรอเกิน 15 นาที   -> ร้านกด "ลูกค้าไม่มารับ" ปิดออเดอร์ได้
   2) ไม่มารับครบ 3 ครั้ง (ใน 30 วัน) -> พักการสั่ง 7 วัน
   3) ค้างรับได้ไม่เกิน 3 ออเดอร์พร้อมกัน -> กันแกล้งสั่งทีละเยอะๆ

   สารบัญ
   1. ตั้งค่า
   2. ร้านกด "ไม่มารับ" ได้หรือยัง
   3. นับจำนวนครั้งที่ไม่มารับ
   4. ลูกค้าสั่งได้ไหม
========================================================== */


/* ----------------------------------------------------------
   1. ตั้งค่า (แก้ตัวเลขตรงนี้ที่เดียว)
---------------------------------------------------------- */
const PICKUP_WAIT_MINUTES = 15;   // อาหารพร้อมแล้วรอกี่นาที ร้านถึงกด "ไม่มารับ" ได้
const MAX_NO_SHOW = 3;            // ไม่มารับกี่ครั้ง ถึงโดนพักการสั่ง
const NO_SHOW_DAYS = 30;          // นับเฉพาะครั้งที่ไม่มารับใน 30 วันล่าสุด (เก่ากว่านั้นไม่นับ)
const BAN_DAYS = 7;               // พักการสั่งกี่วัน
const MAX_ACTIVE_ORDERS = 3;      // ค้างรับได้กี่ออเดอร์พร้อมกัน

const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;


/* ----------------------------------------------------------
   2. ร้านกด "ไม่มารับ" ได้หรือยัง
   คืนค่า: จำนวนนาทีที่ต้องรออีก (0 = กดได้แล้ว)
---------------------------------------------------------- */
function minutesUntilNoShow(order) {
    let readyAt = order.readyAt || order.updatedAt;              // เวลาที่ร้านกด "ทำเสร็จ"
    let waited = Date.now() - readyAt;                          // รอมาแล้วกี่ ms
    let left = PICKUP_WAIT_MINUTES * ONE_MINUTE - waited;       // เหลืออีกกี่ ms

    if (left <= 0) return 0;
    return Math.ceil(left / ONE_MINUTE);
}


/* ----------------------------------------------------------
   3. นับจำนวนครั้งที่ไม่มารับ
---------------------------------------------------------- */

// รายการออเดอร์ที่นักศึกษาคนนี้ไม่มารับ ใน 30 วันล่าสุด (ใหม่สุดอยู่หน้า)
function noShowList(student) {
    let orders = loadOrders();
    let since = Date.now() - NO_SHOW_DAYS * ONE_DAY;
    let list = [];

    for (let i = 0; i < orders.length; i++) {
        let order = orders[i];
        if (order.student === student && order.status === 'noshow' && order.noShowAt >= since) {
            list.push(order);
        }
    }

    list.sort(function (a, b) { return b.noShowAt - a.noShowAt; });
    return list;
}

function noShowCount(student) {
    return noShowList(student).length;
}

// โดนพักถึงเมื่อไหร่ (0 = ไม่ได้โดนพัก)
// ครบ 3 ครั้ง -> พัก 7 วัน นับจากครั้งล่าสุดที่ไม่มารับ
function bannedUntil(student) {
    let list = noShowList(student);
    if (list.length < MAX_NO_SHOW) return 0;

    let until = list[0].noShowAt + BAN_DAYS * ONE_DAY;
    if (until <= Date.now()) return 0;   // พ้นโทษแล้ว
    return until;
}


/* ----------------------------------------------------------
   4. ลูกค้าสั่งได้ไหม (ตะกร้าเรียกก่อนกดสั่ง)
   คืนค่า: '' = สั่งได้ / ข้อความ = เหตุผลที่สั่งไม่ได้
---------------------------------------------------------- */
function orderBlockReason(student) {
    // ชั้นที่ 2: โดนพักอยู่ไหม
    let until = bannedUntil(student);
    if (until > 0) {
        let date = new Date(until).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        return 'บัญชีถูกพักการสั่งถึง ' + date + ' เพราะไม่มารับอาหาร ' + MAX_NO_SHOW + ' ครั้ง';
    }

    // ชั้นที่ 3: ค้างรับกี่ออเดอร์แล้ว
    let orders = loadOrders();
    let active = 0;
    for (let i = 0; i < orders.length; i++) {
        let status = orders[i].status;
        if (orders[i].student === student && (status === 'new' || status === 'cooking' || status === 'ready')) {
            active = active + 1;
        }
    }
    if (active >= MAX_ACTIVE_ORDERS) {
        return 'มีออเดอร์ที่ยังไม่ได้รับ ' + active + ' ออเดอร์แล้ว กรุณาไปรับก่อนสั่งเพิ่ม';
    }

    return '';
}
