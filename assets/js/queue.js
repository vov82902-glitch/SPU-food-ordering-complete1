let user = null;
let cart = [];
try { user = JSON.parse(localStorage.getItem('food_user')); } catch (e) { user = null; }
try { cart = JSON.parse(localStorage.getItem('food_cart')) || []; } catch (e) { cart = []; }

let knownStatus = {};   // จำสถานะล่าสุดไว้ เพื่อแจ้งเตือนเมื่อร้านเปลี่ยนสถานะ
let firstRender = true;

// ขั้นตอนของออเดอร์ (ใช้วาดแถบติดตามสถานะ)
const TRACK = [
    ['new', 'สั่งแล้ว'],
    ['cooking', 'กำลังทำ'],
    ['ready', 'พร้อมรับ'],
    ['done', 'รับแล้ว']
];

if (user === null) {
    location.replace('index.html');
} else {
    let count = 0;
    for (let i = 0; i < cart.length; i++) {
        count = count + cart[i].quantity;
    }
    document.getElementById('cart-count').textContent = count;
    if ('Notification' in window && Notification.permission === 'default') {
        document.getElementById('order-list').insertAdjacentHTML('beforebegin',
            '<p id="notify-ask" class="notify-ask">ต้องการให้แจ้งเตือนเมื่ออาหารพร้อมไหม? <button class="link-btn" onclick="askNotify()">เปิดการแจ้งเตือน</button></p>');
    }
    renderQueue();
    let placed = sessionStorage.getItem('food_placed');
    if (placed) {
        sessionStorage.removeItem('food_placed');
        showToast('สั่งอาหารสำเร็จ · คิวของคุณ <b>' + esc(placed) + '</b>', 'ok');
    }
    window.addEventListener('storage', function (e) {
        if (!e.key || e.key === 'food_orders') renderQueue();
    });
    setInterval(renderQueue, 3000);
}

function askNotify() {
    Notification.requestPermission().then(function () {
        let el = document.getElementById('notify-ask');
        if (el) el.remove();
    });
}

function trackHtml(status) {
    if (status === 'cancelled' || status === 'noshow') return '';
    let now = TRACK.findIndex(function (t) { return t[0] === status; });
    let h = '<ol class="track">';
    TRACK.forEach(function (t, i) {
        h += '<li class="' + (i < now ? 'done' : i === now ? 'now' : '') + '">' + t[1] + '</li>';
    });
    return h + '</ol>';
}

function renderQueue() {
    let orders = loadOrders();
    let mine = orders.filter(function (o) { return o.student === user.student; });
    mine.sort(function (a, b) { return b.createdAt - a.createdAt; });
    let html = '';
    for (let order of mine) {
        // แจ้งเตือนเมื่อสถานะเปลี่ยน หรือร้านกดเรียกคิวซ้ำ
        let sig = order.status + '|' + (order.recalledAt || '');
        let oldSig = knownStatus[order.id];
        if (!firstRender && oldSig && oldSig !== sig) {
            if (order.status === 'ready') {
                showToast('คิว <b>' + esc(order.queue) + '</b> อาหารพร้อมแล้ว ไปรับที่ ' + esc(order.store) + ' ชั้น ' + esc(order.floor), 'ok');
                beep(4);
                desktopNotify('อาหารพร้อมแล้ว คิว ' + order.queue, order.store + ' ชั้น ' + order.floor);
            } else if (order.status === 'cooking') {
                showToast('ร้านรับออเดอร์คิว <b>' + esc(order.queue) + '</b> แล้ว กำลังทำอาหาร');
            } else if (order.status === 'cancelled' && order.cancelledBy !== 'customer') {
                showToast('คิว <b>' + esc(order.queue) + '</b> ถูกร้านยกเลิก', 'bad');
                beep(1);
            } else if (order.status === 'noshow') {
                showToast('คิว <b>' + esc(order.queue) + '</b> ถูกปิดเพราะไม่มารับอาหาร', 'bad');
                beep(1);
            }
        }
        knownStatus[order.id] = sig;

        let ahead = 0;
        if (order.status === 'new' || order.status === 'cooking') {
            ahead = orders.filter(function (o) {
                return o.storeId === order.storeId && (o.status === 'new' || o.status === 'cooking') && o.createdAt < order.createdAt;
            }).length;
        }

        html += '<article class="ticket q-' + order.status + '">';
        html += '<header class="ticket-head"><div><small>เลขคิว</small><strong>' + esc(order.queue) + '</strong></div>';
        html += '<span class="status s-' + order.status + '">' + STATUS_TEXT[order.status] + '</span></header>';
        html += trackHtml(order.status);
        html += '<p class="ticket-info">' + esc(order.store) + ' · ชั้น ' + esc(order.floor) + ' · สั่งเมื่อ ' + timeText(order.createdAt);
        if (order.status === 'new' || order.status === 'cooking') {
            html += '<br>' + (ahead === 0 ? 'คุณเป็นคิวถัดไป' : 'มีคิวก่อนหน้า ' + ahead + ' คิว');
        }
        html += '</p>';

        html += '<ul class="ticket-items">';
        for (let item of order.items) {
            html += '<li><span>' + itemTitle(item) + ' <em>× ' + item.quantity + '</em></span><span>' + (item.price * item.quantity) + '</span>';
            if (item.note) html += '<small class="item-note">หมายเหตุ: ' + esc(item.note) + '</small>';
            html += '</li>';
        }
        html += '</ul>';
        html += '<div class="ticket-total"><span>รวม</span><b>' + order.total + ' บาท</b></div>';
        // การชำระเงิน: จ่ายเงินสดที่ร้านอย่างเดียว
        if (order.status === 'done') {
            html += '<div class="ticket-pay paid">✅ จ่ายเงินแล้ว ' + order.total + ' บาท</div>';
        } else if (order.status !== 'cancelled' && order.status !== 'noshow') {
            html += '<div class="ticket-pay">💵 เตรียมเงินสด ' + order.total + ' บาท จ่ายที่ร้านตอนรับอาหาร</div>';
        }

        // ยกเลิกได้เฉพาะตอนที่ร้านยังไม่รับออเดอร์
        html += '<footer class="ticket-foot">';
        if (order.status === 'new') {
            html += '<button class="btn-cancel" onclick="askCancel(\'' + order.id + '\')">ยกเลิกออเดอร์</button>';
            html += '<small>ยกเลิกได้จนกว่าร้านจะรับออเดอร์</small>';
        } else if (order.status === 'cooking' || order.status === 'ready') {
            html += '<button class="btn-cancel" disabled>ยกเลิกออเดอร์</button>';
            html += '<small>ร้านเริ่มทำอาหารแล้ว ไม่สามารถยกเลิกได้</small>';
        } else if (order.status === 'cancelled') {
            html += '<small class="cancel-reason">' + (order.cancelledBy === 'customer' ? 'คุณยกเลิกออเดอร์นี้' : 'ร้านยกเลิก') +
                (order.cancelReason && order.cancelledBy !== 'customer' ? ': ' + esc(order.cancelReason) : '') + '</small>';
        } else if (order.status === 'noshow') {
            html += '<small class="cancel-reason">ร้านปิดออเดอร์เพราะไม่มารับภายใน ' + PICKUP_WAIT_MINUTES + ' นาที · ไม่มารับครบ ' + MAX_NO_SHOW + ' ครั้งจะถูกพักการสั่ง ' + BAN_DAYS + ' วัน</small>';   // ตัวเลขมาจาก noshow.js
        } else {
            html += '<small>ขอบคุณที่ใช้บริการ</small>';
        }
        html += '</footer></article>';
    }
    firstRender = false;
    let list = document.getElementById('order-list');
    if (list.dataset.html !== html) {
        list.dataset.html = html;
        list.innerHTML = html;
    }
}


/* ---------- กล่องยืนยันการยกเลิก ---------- */
function askCancel(id) {
    let order = loadOrders().find(function (o) { return o.id === id; });
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
    let order = orders.find(function (o) { return o.id === id; });
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
