/* ==========================================================
   admin-board.js — กระดานออเดอร์ (หน้าร้าน > ออเดอร์)
   ใช้ในหน้าร้าน (admin.html) · ต้องโหลดก่อน admin.js

   แบ่งออเดอร์เป็น 3 คอลัมน์ตามขั้นตอนการทำงานของร้าน:

   🆕 ออเดอร์ใหม่  ->  🍳 กำลังทำ  ->  ✅ รอลูกค้ารับ
   [รับออเดอร์]       [ทำเสร็จ]       [ลูกค้ารับแล้ว]

   1 ออเดอร์ = 1 การ์ด ตัวใหญ่อ่านง่าย:
   - เลขคิวตัวโต + เวลานับถอยหลัง
   - จำนวนอยู่หน้าชื่อเมนู (2× ข้าวผัดกะเพรา) ร้านจะได้เห็นทันทีว่าต้องทำกี่จาน
   - ตัวเลือก (หมูกรอบ, ไข่ดาว) ตัวหนา / หมายเหตุลูกค้า กรอบสีเหลือง
   - ปุ่มใหญ่ปุ่มเดียวสำหรับขั้นถัดไป

   ปุ่มในการ์ดใช้ data-act / data-pay แบบเดิม admin.js จัดการให้เอง

   สารบัญ
   1. ตั้งค่าคอลัมน์
   2. วาดกระดาน
   3. วาดการ์ด 1 ใบ
   4. วาดรายการอาหารในการ์ด
========================================================== */


/* ----------------------------------------------------------
   1. ตั้งค่าคอลัมน์: สถานะไหน อยู่คอลัมน์ไหน ชื่ออะไร
---------------------------------------------------------- */
const BOARD_COLUMNS = [
    { status: 'new', title: '🆕 ออเดอร์ใหม่', empty: 'ยังไม่มีออเดอร์ใหม่' },
    { status: 'cooking', title: '🍳 กำลังทำ', empty: 'ไม่มีออเดอร์ที่กำลังทำ' },
    { status: 'ready', title: '✅ รอลูกค้ารับ', empty: 'ไม่มีคิวรอรับ' }
];


/* ----------------------------------------------------------
   2. วาดกระดาน (admin.js เรียกทุกครั้งที่ข้อมูลเปลี่ยน)
---------------------------------------------------------- */
function renderBoard(orders) {
    // ออเดอร์ที่มาก่อนอยู่บนสุด (ทำก่อน)
    let sorted = orders.slice().sort(function (a, b) {
        return a.createdAt - b.createdAt;
    });

    let html = '';

    for (let i = 0; i < BOARD_COLUMNS.length; i++) {
        let column = BOARD_COLUMNS[i];

        // เลือกเฉพาะออเดอร์ที่สถานะตรงกับคอลัมน์นี้
        let cards = '';
        let count = 0;
        for (let j = 0; j < sorted.length; j++) {
            if (sorted[j].status === column.status) {
                cards += cardHtml(sorted[j]);
                count = count + 1;
            }
        }
        if (count === 0) {
            cards = '<p class="board-empty">' + column.empty + '</p>';
        }

        html += '<section class="board-column col-' + column.status + '">';
        html += '<h3>' + column.title + ' <span class="board-count">' + count + '</span></h3>';
        html += cards;
        html += '</section>';
    }

    document.getElementById('order-board').innerHTML = html;
}


/* ----------------------------------------------------------
   3. วาดการ์ด 1 ใบ
---------------------------------------------------------- */
function cardHtml(order) {
    let late = isLate(order) ? ' late' : '';   // ค้างนาน -> การ์ดสีแดง (order-timer.js)

    let html = '<article class="order-card' + late + '">';

    // หัวการ์ด: เลขคิว + นับถอยหลัง
    html += '<header class="card-head">';
    html += '<span class="card-queue">' + esc(order.queue) + '</span>';
    html += countdownHtml(order);   // มีเฉพาะออเดอร์ใหม่ (order-timer.js)
    html += '</header>';

    // ลูกค้า + เวลาสั่ง
    html += '<p class="card-customer">' + esc(order.name || order.student) + ' · สั่ง ' + timeText(order.createdAt) + '</p>';

    // รายการอาหาร
    html += itemsListHtml(order.items);

    // การชำระเงิน + ยอดรวม
    html += '<div class="card-pay">';
    html += '<div>' + payCell(order) + '</div>';     // payCell อยู่ใน admin.js
    html += '<b class="card-total">' + order.total + ' ฿</b>';
    html += '</div>';

    // ปุ่มขั้นถัดไป
    html += '<div class="card-actions">' + actionButtons(order) + '</div>';   // actionButtons อยู่ใน admin.js

    html += '</article>';
    return html;
}


/* ----------------------------------------------------------
   4. วาดรายการอาหารในการ์ด
   ตัวอย่างผลลัพธ์:
     2×  ข้าวผัดกะเพรา
         หมูกรอบ, ไข่ดาว, เผ็ดน้อย
         📝 ไม่ใส่ถั่วฝักยาว
---------------------------------------------------------- */
function itemsListHtml(items) {
    let html = '<ul class="card-items">';

    for (let i = 0; i < items.length; i++) {
        let item = items[i];

        html += '<li>';
        html += '<span class="card-qty">' + item.quantity + '×</span>';
        html += '<div>';
        html += '<b>' + esc(item.name) + '</b>';

        if (optionNames(item) !== '') {
            html += '<span class="card-options">' + esc(optionNames(item)) + '</span>';
        }
        if (item.note) {
            html += '<span class="card-note">📝 ' + esc(item.note) + '</span>';
        }

        html += '</div>';
        html += '</li>';
    }

    html += '</ul>';
    return html;
}
