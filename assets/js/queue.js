/* ==========================================================
   queue.js — หน้าคิวของฉัน (queue.html)
   แสดงบัตรคิวทุกออเดอร์ของลูกค้า + แจ้งเตือนเมื่อร้านเปลี่ยนสถานะ
   ต้องโหลดหลัง main.js และ noshow.js

   ข้อมูลเปลี่ยน (ร้านกดปุ่ม) -> cloud.js อัปเดต -> หน้านี้วาดใหม่เอง
   และวาดซ้ำทุก 3 วินาทีกันพลาด

   สารบัญ
   1. เริ่มต้นหน้า
   2. วาดบัตรคิวทั้งหมด
   3. แจ้งเตือนเมื่อสถานะเปลี่ยน
   4. บัตรคิว 1 ใบ
   5. ลูกค้ายกเลิกออเดอร์
========================================================== */

let user = getCurrentUser();   // { name, student } หรือ null ถ้ายังไม่ล็อกอิน

let knownStatus = {};    // สถานะล่าสุดของแต่ละออเดอร์ (ไว้เทียบว่าเปลี่ยนไหม)
let knownChanges = {};   // แต่ละออเดอร์โดนของหมดไปกี่ครั้งแล้ว (เปลี่ยนของ / ตัดจาน)
let firstRender = true;  // วาดครั้งแรกไม่ต้องเตือน

// ขั้นตอนของออเดอร์ (แถบติดตามสถานะ)
const TRACK = [
    ['new', 'สั่งแล้ว'],
    ['cooking', 'กำลังทำ'],
    ['ready', 'พร้อมรับ'],
    ['done', 'รับแล้ว']
];


/* ----------------------------------------------------------
   1. เริ่มต้นหน้า
---------------------------------------------------------- */
if (user === null) {
    location.replace('index.html');   // ยังไม่ล็อกอิน -> กลับหน้าเข้าสู่ระบบ
} else {
    updateCartBadge();
    askNotifyPermission();
    renderQueue();
    askSound();   // เบราว์เซอร์ยังบล็อกเสียง -> โชว์แถบให้แตะเปิดเสียง (main.js)

    // มาจากหน้าตะกร้า -> เด้งข้อความ "สั่งสำเร็จ"
    let placed = sessionStorage.getItem('food_placed');
    if (placed) {
        sessionStorage.removeItem('food_placed');
        showToast('สั่งอาหารสำเร็จ · คิวของคุณ <b>' + esc(placed) + '</b>', 'ok');
    }

    // ข้อมูลเปลี่ยน -> วาดใหม่
    window.addEventListener('storage', function (e) {
        if (e.key === 'food_data') loadFoodData();   // ร้านตั้งของหมด -> ใช้เมนูล่าสุด
        if (!e.key || e.key === 'food_orders' || e.key === 'food_data') renderQueue();
    });
    setInterval(renderQueue, 3000);
}

// ขออนุญาตแจ้งเตือนมุมจอ (ถามครั้งเดียว)
function askNotifyPermission() {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    document.getElementById('order-list').insertAdjacentHTML('beforebegin',
        '<p id="notify-ask" class="notify-ask">ต้องการให้แจ้งเตือนเมื่ออาหารพร้อมไหม? ' +
        '<button class="link-btn" onclick="askNotify()">เปิดการแจ้งเตือน</button></p>');
}

function askNotify() {
    Notification.requestPermission().then(function () {
        let el = document.getElementById('notify-ask');
        if (el) el.remove();
    });
}


/* ----------------------------------------------------------
   2. วาดบัตรคิวทั้งหมด
---------------------------------------------------------- */
function renderQueue() {
    let orders = loadOrders();

    // เอาเฉพาะออเดอร์ของเรา เรียงใหม่ไปเก่า
    let mine = [];
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].student === user.student) mine.push(orders[i]);
    }
    mine.sort(function (a, b) { return b.createdAt - a.createdAt; });

    let html = '';
    for (let i = 0; i < mine.length; i++) {
        notifyChanges(mine[i]);
        html += ticketHtml(mine[i], orders);
    }
    firstRender = false;

    // วาดใหม่เฉพาะตอนที่มีอะไรเปลี่ยน (หน้าจะได้ไม่กระพริบ)
    let list = document.getElementById('order-list');
    if (list.dataset.html !== html) {
        list.dataset.html = html;
        list.innerHTML = html;
    }
}


/* ----------------------------------------------------------
   3. แจ้งเตือนเมื่อสถานะเปลี่ยน (เทียบกับครั้งก่อน)
---------------------------------------------------------- */
function notifyChanges(order) {
    let queue = '<b>' + esc(order.queue) + '</b>';

    // 3.1 สถานะเปลี่ยน หรือร้านกด "เรียกซ้ำ"
    let sig = order.status + '|' + (order.recalledAt || '');
    let oldSig = knownStatus[order.id];
    knownStatus[order.id] = sig;

    if (!firstRender && oldSig && oldSig !== sig) {
        if (order.status === 'ready') {
            showToast('คิว ' + queue + ' อาหารพร้อมแล้ว ไปรับที่ ' + esc(order.store) + ' ชั้น ' + esc(order.floor), 'ok');
            beep(4);
            desktopNotify('อาหารพร้อมแล้ว คิว ' + order.queue, order.store + ' ชั้น ' + order.floor);
        } else if (order.status === 'cooking') {
            showToast('ร้านรับออเดอร์คิว ' + queue + ' แล้ว กำลังทำอาหาร');
        } else if (order.status === 'cancelled' && order.cancelledBy !== 'customer') {
            showToast('คิว ' + queue + ' ถูกร้านยกเลิก', 'bad');
            beep(1);
        } else if (order.status === 'noshow') {
            showToast('คิว ' + queue + ' ถูกปิดเพราะไม่มารับอาหาร', 'bad');
            beep(1);
        }
    }

    // 3.2 ของหมด -> ร้านเปลี่ยนของ / ตัดจาน ตามที่ลูกค้าเลือกไว้ (จำนวนครั้งเพิ่มขึ้น = เพิ่งเกิด)
    //     นับจานที่ตัดออก + จำนวนลูกศร "→" ใน changeNote (จานเดียวอาจเปลี่ยนหลายรอบ)
    let changes = (order.removed || []).length;
    for (let i = 0; i < order.items.length; i++) {
        changes = changes + (order.items[i].changeNote || '').split('→').length - 1;
    }
    // ออเดอร์ถูกยกเลิกทั้งใบ -> ข้อ 3.1 แจ้งไปแล้ว ไม่ต้องแจ้งซ้ำ
    if (!firstRender && order.status !== 'cancelled' && changes > (knownChanges[order.id] || 0)) {
        showToast('คิว ' + queue + ': ของบางอย่างหมด ร้านเปลี่ยนตามที่คุณเลือกไว้แล้ว', 'bad');
        beep(3);
        desktopNotify('ของหมด คิว ' + order.queue, 'ร้านเปลี่ยนตามที่คุณเลือกไว้แล้ว ดูในหน้าคิว');
    }
    knownChanges[order.id] = changes;
}


/* ----------------------------------------------------------
   4. บัตรคิว 1 ใบ
---------------------------------------------------------- */
function ticketHtml(order, allOrders) {
    let active = order.status === 'new' || order.status === 'cooking';
    let html = '<article class="ticket q-' + order.status + '">';

    // หัวบัตร: เลขคิว + สถานะ
    html += '<header class="ticket-head"><div><small>เลขคิว</small><strong>' + esc(order.queue) + '</strong></div>';
    html += '<span class="status s-' + order.status + '">' + STATUS_TEXT[order.status] + '</span></header>';
    html += trackHtml(order.status);

    // ร้าน + เวลา + มีคิวก่อนหน้ากี่คิว
    html += '<p class="ticket-info">' + esc(order.store) + ' · ชั้น ' + esc(order.floor) + ' · สั่งเมื่อ ' + timeText(order.createdAt);
    if (active) {
        let ahead = queueAhead(order, allOrders);
        html += '<br>' + (ahead === 0 ? 'คุณเป็นคิวถัดไป' : 'มีคิวก่อนหน้า ' + ahead + ' คิว');
    }
    html += '</p>';

    // รายการอาหาร
    html += '<ul class="ticket-items">';
    for (let i = 0; i < order.items.length; i++) {
        let item = order.items[i];
        html += '<li><span>' + itemTitle(item) + ' <em>× ' + item.quantity + '</em></span><span>' + (item.price * item.quantity) + '</span>';
        if (item.note) html += '<small class="item-note">หมายเหตุ: ' + esc(item.note) + '</small>';
        if (item.changeNote) html += '<small class="item-changed">🔄 เปลี่ยน ' + esc(item.changeNote) + '</small>';
        html += '</li>';
    }
    html += '</ul>';

    // ของหมด: จานที่ถูกตัดออก (out-of-stock.js)
    if (order.removed && order.removed.length > 0) {
        html += '<p class="item-removed">❌ ตัดออก: ' + esc(order.removed.join(', ')) + '</p>';
    }

    // ยอดรวม + การจ่ายเงิน (เงินสดที่ร้านอย่างเดียว)
    html += '<div class="ticket-total"><span>รวม</span><b>' + order.total + ' บาท</b></div>';
    if (order.status === 'done') {
        html += '<div class="ticket-pay paid">✅ จ่ายเงินแล้ว ' + order.total + ' บาท</div>';
    } else if (order.status !== 'cancelled' && order.status !== 'noshow') {
        html += '<div class="ticket-pay">💵 เตรียมเงินสด ' + order.total + ' บาท จ่ายที่ร้านตอนรับอาหาร</div>';
    }

    html += '<footer class="ticket-foot">' + footerHtml(order) + '</footer>';
    html += '</article>';
    return html;
}

// แถบติดตามสถานะ: สั่งแล้ว > กำลังทำ > พร้อมรับ > รับแล้ว
function trackHtml(status) {
    if (status === 'cancelled' || status === 'noshow') return '';

    let now = 0;   // ตอนนี้อยู่ขั้นที่เท่าไหร่
    for (let i = 0; i < TRACK.length; i++) {
        if (TRACK[i][0] === status) now = i;
    }

    let html = '<ol class="track">';
    for (let i = 0; i < TRACK.length; i++) {
        let cls = '';
        if (i < now) cls = 'done';
        if (i === now) cls = 'now';
        html += '<li class="' + cls + '">' + TRACK[i][1] + '</li>';
    }
    return html + '</ol>';
}

// นับว่ามีคิวของร้านเดียวกันที่สั่งก่อนเรา และยังทำไม่เสร็จกี่คิว
function queueAhead(order, allOrders) {
    let count = 0;
    for (let i = 0; i < allOrders.length; i++) {
        let other = allOrders[i];
        let active = other.status === 'new' || other.status === 'cooking';
        if (other.storeId === order.storeId && active && other.createdAt < order.createdAt) {
            count = count + 1;
        }
    }
    return count;
}

// ท้ายบัตร: ปุ่มยกเลิก หรือข้อความตามสถานะ
function footerHtml(order) {
    if (order.status === 'new') {
        return '<button class="btn-cancel" onclick="askCancel(\'' + order.id + '\')">ยกเลิกออเดอร์</button>' +
            '<small>ยกเลิกได้จนกว่าร้านจะรับออเดอร์</small>';
    }
    if (order.status === 'cooking' || order.status === 'ready') {
        return '<button class="btn-cancel" disabled>ยกเลิกออเดอร์</button>' +
            '<small>ร้านเริ่มทำอาหารแล้ว ไม่สามารถยกเลิกได้</small>';
    }
    if (order.status === 'cancelled') {
        if (order.cancelledBy === 'customer') return '<small class="cancel-reason">คุณยกเลิกออเดอร์นี้</small>';
        return '<small class="cancel-reason">ร้านยกเลิก' + (order.cancelReason ? ': ' + esc(order.cancelReason) : '') + '</small>';
    }
    if (order.status === 'noshow') {
        // ตัวเลขมาจาก noshow.js
        return '<small class="cancel-reason">ร้านปิดออเดอร์เพราะไม่มารับภายใน ' + PICKUP_WAIT_MINUTES + ' นาที · ' +
            'ไม่มารับครบ ' + MAX_NO_SHOW + ' ครั้งจะถูกพักการสั่ง ' + BAN_DAYS + ' วัน</small>';
    }
    return '<small>ขอบคุณที่ใช้บริการ</small>';
}


/* ----------------------------------------------------------
   5. ลูกค้ายกเลิกออเดอร์ (ได้เฉพาะตอนร้านยังไม่รับ)
---------------------------------------------------------- */

// เปิดกล่องถามยืนยัน (สร้างครั้งแรกที่กด)
function askCancel(id) {
    let order = null;
    let orders = loadOrders();
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) order = orders[i];
    }
    if (!order) return;

    let box = document.getElementById('cancel-dialog');
    if (!box) {
        document.body.insertAdjacentHTML('beforeend',
            '<div id="cancel-dialog" class="dialog" hidden><div class="dialog-box" role="dialog" aria-modal="true" aria-labelledby="cancel-title">' +
            '<h3 id="cancel-title"></h3><p>เมื่อยกเลิกแล้วจะกู้คืนไม่ได้ หากต้องการสั่งใหม่ต้องสั่งและรับคิวใหม่</p>' +
            '<div class="dialog-actions"><button type="button" class="btn-plain" id="cancel-no">ไม่ยกเลิก</button>' +
            '<button type="button" class="btn-danger" id="cancel-yes">ยืนยันยกเลิก</button></div></div></div>');
        box = document.getElementById('cancel-dialog');
        document.getElementById('cancel-no').onclick = closeCancel;
        box.onclick = function (e) { if (e.target === box) closeCancel(); };
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCancel(); });
    }

    document.getElementById('cancel-title').textContent = 'ยกเลิกคิว ' + order.queue + '?';
    document.getElementById('cancel-yes').onclick = function () { closeCancel(); cancelMyOrder(id); };
    box.hidden = false;
    document.getElementById('cancel-no').focus();
}

function closeCancel() {
    let box = document.getElementById('cancel-dialog');
    if (box) box.hidden = true;
}

function cancelMyOrder(id) {
    let orders = loadOrders();
    let order = null;
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === id) order = orders[i];
    }
    if (!order || order.student !== user.student) return;

    // ตรวจอีกครั้ง เผื่อร้านกดรับออเดอร์ไประหว่างนั้น
    if (order.status !== 'new') {
        showToast('ร้านรับออเดอร์คิว <b>' + esc(order.queue) + '</b> ไปแล้ว ไม่สามารถยกเลิกได้', 'bad');
        renderQueue();
        return;
    }

    order.status = 'cancelled';
    order.cancelledBy = 'customer';
    order.cancelReason = 'ลูกค้ายกเลิกเอง';
    order.cancelledAt = Date.now();
    order.updatedAt = Date.now();
    saveOrders(orders);

    showToast('ยกเลิกคิว <b>' + esc(order.queue) + '</b> แล้ว');
    renderQueue();
}
