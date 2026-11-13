/* ==========================================================
   admin-board.js — กระดานออเดอร์ (หน้าร้าน > ออเดอร์)
   ใช้ในหน้าร้าน (admin.html) · ต้องโหลดหลัง noshow.js / order-timer.js และก่อน admin.js

   แบ่งออเดอร์เป็น 3 คอลัมน์ตามขั้นตอนการทำงานของร้าน:

   🆕 ออเดอร์ใหม่  ->  🍳 กำลังทำ  ->  ✅ รอลูกค้ารับ
   [รับออเดอร์]       [ทำเสร็จ]       [ลูกค้ารับแล้ว · รับเงิน]

   - คอมพิวเตอร์ : เห็นครบ 3 คอลัมน์
   - มือถือ      : มีแท็บด้านบน กดดูทีละคอลัมน์ (CSS ซ่อนคอลัมน์ที่ไม่ได้เลือก)

   การ์ด 1 ใบ อ่านจากบนลงล่าง:
     A004  [3 จาน]          ⏱ รับภายใน 2:10
     ธัญธร · สั่ง 12:26   ⚠ เคยไม่มารับ 1 ครั้ง
     (2) ข้าวผัดกะเพรา
         • หมูกรอบ
         • ไข่ดาว
         ⚠ ไม่ใส่ถั่วฝักยาว
     💵 เก็บเงินสด            180 ฿
     [        รับออเดอร์        ]
              ยกเลิกออเดอร์

   ปุ่มในการ์ดใช้ data-act แบบเดิม -> admin.js (orderAct) จัดการให้

   สารบัญ
   1. ตั้งค่าคอลัมน์
   2. วาดกระดาน + แท็บ
   3. วาดการ์ด 1 ใบ
   4. วาดรายการอาหาร
   5. ปุ่มของการ์ด
   6. กดแท็บ (มือถือ)
========================================================== */


/* ----------------------------------------------------------
   1. ตั้งค่าคอลัมน์: สถานะไหน อยู่คอลัมน์ไหน
---------------------------------------------------------- */
const BOARD_COLUMNS = [
    { status: 'new', title: '🆕 ออเดอร์ใหม่', tab: 'ใหม่', empty: 'ยังไม่มีออเดอร์ใหม่' },
    { status: 'cooking', title: '🍳 กำลังทำ', tab: 'ทำอยู่', empty: 'ไม่มีออเดอร์ที่กำลังทำ' },
    { status: 'ready', title: '✅ รอลูกค้ารับ', tab: 'รอรับ', empty: 'ไม่มีคิวรอรับ' }
];

let boardTab = 'new';   // แท็บที่เลือกอยู่ (ใช้บนมือถือ)


/* ----------------------------------------------------------
   2. วาดกระดาน + แท็บ (admin.js เรียกทุกครั้งที่ข้อมูลเปลี่ยน)
---------------------------------------------------------- */
function renderBoard(orders) {
    // ออเดอร์ที่มาก่อนอยู่บนสุด (ทำก่อน)
    let sorted = orders.slice().sort(function (a, b) {
        return a.createdAt - b.createdAt;
    });

    let tabs = '';
    let columns = '';

    for (let i = 0; i < BOARD_COLUMNS.length; i++) {
        let column = BOARD_COLUMNS[i];
        let active = column.status === boardTab ? ' is-active' : '';

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

        // แท็บ (เห็นเฉพาะบนมือถือ)
        tabs += '<button type="button" class="board-tab tab-' + column.status + active + '" data-tab="' + column.status + '">' +
            column.tab + ' <i>' + count + '</i></button>';

        // คอลัมน์
        columns += '<section class="board-column col-' + column.status + active + '">';
        columns += '<h3>' + column.title + ' <span class="board-count">' + count + '</span></h3>';
        columns += cards;
        columns += '</section>';
    }

    document.getElementById('order-board').innerHTML =
        '<div class="board-tabs">' + tabs + '</div>' +
        '<div class="board-columns">' + columns + '</div>';
}


/* ----------------------------------------------------------
   3. วาดการ์ด 1 ใบ
---------------------------------------------------------- */
function cardHtml(order) {
    let late = isLate(order) ? ' late' : '';   // ค้างนาน -> การ์ดสีแดง (order-timer.js)

    // นับจำนวนจานทั้งหมด
    let dishes = 0;
    for (let i = 0; i < order.items.length; i++) {
        dishes = dishes + order.items[i].quantity;
    }

    let html = '<article class="order-card' + late + '">';

    // หัวการ์ด: เลขคิว + จำนวนจาน + นับถอยหลัง
    html += '<header class="card-head">';
    html += '<span class="card-queue">' + esc(order.queue) + '</span>';
    html += '<span class="card-dishes">' + dishes + ' จาน</span>';
    html += countdownHtml(order);   // มีเฉพาะออเดอร์ใหม่ (order-timer.js)
    html += '</header>';

    // ลูกค้า + เวลา + ประวัติไม่มารับ
    html += '<p class="card-customer">' + esc(order.name || order.student) + ' · สั่ง ' + timeText(order.createdAt);
    if (order.status === 'ready' && order.readyAt) {
        html += ' · พร้อมเมื่อ ' + timeText(order.readyAt);
    }
    let missed = noShowCount(order.student);   // noshow.js
    if (missed > 0) {
        html += ' <span class="card-warn">⚠ เคยไม่มารับ ' + missed + ' ครั้ง</span>';
    }
    html += '</p>';

    // รายการอาหาร
    html += itemsListHtml(order.items);

    // รายการที่ถูกตัดออกเพราะของหมด (out-of-stock.js)
    if (order.removed && order.removed.length > 0) {
        html += '<p class="card-removed">❌ ตัดออก: ' + esc(order.removed.join(', ')) + '</p>';
    }

    // เงินที่ต้องเก็บ (จ่ายเงินสดที่ร้านอย่างเดียว)
    html += '<div class="card-money">💵 เก็บเงินสด <b>' + order.total + ' ฿</b></div>';

    // ปุ่ม
    html += cardButtons(order);

    html += '</article>';
    return html;
}


/* ----------------------------------------------------------
   4. วาดรายการอาหาร: จำนวนในวงกลม + ตัวเลือกบรรทัดละอย่าง
---------------------------------------------------------- */
function itemsListHtml(items) {
    let html = '<ul class="card-items">';

    for (let i = 0; i < items.length; i++) {
        let item = items[i];

        html += '<li>';
        html += '<span class="card-qty">' + item.quantity + '</span>';
        html += '<div>';
        html += '<b>' + esc(item.name) + '</b>';

        // ตัวเลือก เช่น หมูกรอบ / ไข่ดาว -> แยกบรรทัด อ่านทีละข้อ
        if (item.options && item.options.length > 0) {
            html += '<ul class="card-options">';
            for (let j = 0; j < item.options.length; j++) {
                html += '<li>' + esc(item.options[j].name) + '</li>';
            }
            html += '</ul>';
        }

        // ของหมด แล้วเปลี่ยนเป็นของแทนที่ลูกค้าเลือกไว้ (out-of-stock.js)
        if (item.changeNote) {
            html += '<span class="card-changed">🔄 ' + esc(item.changeNote) + '</span>';
        }

        // หมายเหตุจากลูกค้า
        if (item.note) {
            html += '<span class="card-note">⚠ ' + esc(item.note) + '</span>';
        }

        html += '</div>';
        html += '</li>';
    }

    html += '</ul>';
    return html;
}


/* ----------------------------------------------------------
   5. ปุ่มของการ์ด
   - ปุ่มหลัก 1 ปุ่ม เต็มความกว้าง สีชมพู (ขั้นต่อไปของออเดอร์)
   - ปุ่มรอง 2 ปุ่ม วางคู่กันด้านล่าง ขอบสี + ไอคอน บอกความหมาย:
       เหลือง = ของหมด / เรียกซ้ำ   แดง = ยกเลิก / ไม่มารับ
---------------------------------------------------------- */
function cardButtons(order) {
    let main = '';
    let side = '';

    if (order.status === 'new') {
        main = mainButton('accept', 'รับออเดอร์', order);
        side = sideButton('stock', '🥕', 'ของหมด', 'warn', order) +
               sideButton('cancel', '✕', 'ยกเลิก', 'danger', order);
    }
    if (order.status === 'cooking') {
        main = mainButton('ready', 'ทำเสร็จ · เรียกลูกค้า', order);
        side = sideButton('stock', '🥕', 'ของหมด', 'warn', order) +
               sideButton('cancel', '✕', 'ยกเลิก', 'danger', order);
    }
    if (order.status === 'ready') {
        main = mainButton('done', 'ลูกค้ารับแล้ว · รับเงิน ' + order.total + ' ฿', order);
        side = sideButton('recall', '📢', 'เรียกซ้ำ', 'warn', order) +
               sideButton('noshow', '🚫', 'ไม่มารับ', 'danger', order);
    }

    return '<div class="card-actions">' + main + '<div class="card-side">' + side + '</div></div>';
}

// ปุ่มหลัก: ใหญ่ เต็มความกว้าง
function mainButton(act, label, order) {
    return '<button type="button" class="btn primary card-main" data-act="' + act + '" data-id="' + order.id + '">' + label + '</button>';
}

// ปุ่มรอง: ไอคอน + ข้อความ / color = 'warn' (เหลือง) หรือ 'danger' (แดง)
function sideButton(act, icon, label, color, order) {
    return '<button type="button" class="side-btn side-' + color + '" data-act="' + act + '" data-id="' + order.id + '">' +
        '<span class="side-icon" aria-hidden="true">' + icon + '</span>' + label + '</button>';
}


/* ----------------------------------------------------------
   6. กดแท็บ (มือถือ): จำแท็บที่เลือก แล้ววาดกระดานใหม่
---------------------------------------------------------- */
document.getElementById('order-board').addEventListener('click', function (event) {
    let tab = event.target.closest('[data-tab]');
    if (!tab) return;

    boardTab = tab.dataset.tab;
    renderBoard(adminOrders());   // adminOrders อยู่ใน admin.js
});
