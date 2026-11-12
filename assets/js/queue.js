let user = null;
let cart = [];
try { user = JSON.parse(localStorage.getItem('food_user')); } catch (e) { user = null; }
try { cart = JSON.parse(localStorage.getItem('food_cart')) || []; } catch (e) { cart = []; }

let knownStatus = {};   // จำสถานะล่าสุดไว้ เพื่อแจ้งเตือนเมื่อร้านเปลี่ยนสถานะ
let firstRender = true;
let paySlip = '';       // รูปสลิปที่ลูกค้าเลือกในกล่อง QR

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
    // มาจากหน้าตะกร้าแบบเลือกจ่าย QR -> เปิดกล่อง QR ของออเดอร์ล่าสุดที่ยังไม่จ่าย
    if (new URLSearchParams(location.search).get('pay') === '1') {
        history.replaceState(null, '', 'queue.html');
        let waiting = loadOrders().filter(function (o) {
            return o.student === user.student && o.status !== 'cancelled' && payInfo(o).method === 'qr' && payInfo(o).status === 'unpaid';
        }).sort(function (a, b) { return b.createdAt - a.createdAt; });
        if (waiting.length) openPay(waiting[0].id);
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
    if (status === 'cancelled') return '';
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
        let pay = payInfo(order);
        let sig = order.status + '|' + (order.recalledAt || '') + '|' + pay.status;
        let oldSig = knownStatus[order.id];
        if (!firstRender && oldSig && oldSig.split('|')[2] !== pay.status) {
            if (pay.status === 'paid') showToast('ร้านยืนยันการชำระเงินคิว <b>' + esc(order.queue) + '</b> แล้ว', 'ok');
            else if (pay.status === 'unpaid' && pay.note) { showToast('คิว <b>' + esc(order.queue) + '</b>: ' + esc(pay.note), 'bad'); beep(1); }
        }
        if (!firstRender && oldSig && oldSig.split('|').slice(0, 2).join('|') !== sig.split('|').slice(0, 2).join('|')) {
            if (order.status === 'ready') {
                showToast('คิว <b>' + esc(order.queue) + '</b> อาหารพร้อมแล้ว ไปรับที่ ' + esc(order.store) + ' ชั้น ' + esc(order.floor), 'ok');
                beep(4);
                desktopNotify('อาหารพร้อมแล้ว คิว ' + order.queue, order.store + ' ชั้น ' + order.floor);
            } else if (order.status === 'cooking') {
                showToast('ร้านรับออเดอร์คิว <b>' + esc(order.queue) + '</b> แล้ว กำลังทำอาหาร');
            } else if (order.status === 'cancelled' && order.cancelledBy !== 'customer') {
                showToast('คิว <b>' + esc(order.queue) + '</b> ถูกร้านยกเลิก', 'bad');
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
        html += payHtml(order, pay);

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

/* ---------- การชำระเงินบนบัตรคิว ---------- */
function payHtml(order, pay) {
    let cfg = getStoreConfigs()[order.storeId];
    let opts = cfg ? storePayOptions(cfg) : { cash: true, qr: false };
    let h = '<div class="ticket-pay pay-' + pay.status + '">';
    h += '<div class="pay-line"><span>ชำระเงิน · ' + PAY_METHOD_TEXT[pay.method] + '</span>';
    h += '<span class="pay-badge">' + PAY_STATUS_TEXT[pay.status] + '</span></div>';

    if (order.status === 'cancelled') {
        if (pay.status !== 'unpaid' && pay.method === 'qr') h += '<p>ออเดอร์ถูกยกเลิก กรุณาติดต่อร้านเพื่อรับเงินคืน' + (cfg && cfg.phone ? ' โทร ' + esc(cfg.phone) : '') + '</p>';
    } else if (pay.status === 'paid') {
        h += '<p>ร้านได้รับเงินแล้ว' + (pay.paidAt ? ' เมื่อ ' + timeText(pay.paidAt) : '') + '</p>';
    } else if (pay.status === 'pending') {
        h += '<p>ส่งสลิปแล้ว รอร้านตรวจสอบยอดเงิน</p>';
    } else if (pay.method === 'qr') {
        if (pay.note) h += '<p class="pay-warn">ร้านแจ้ง: ' + esc(pay.note) + '</p>';
        if (opts.qr) {
            h += '<button class="btn-pay" onclick="openPay(\'' + order.id + '\')">สแกน QR จ่าย ' + order.total + ' บาท</button>';
        } else {
            h += '<p>ร้านปิดรับ QR ชั่วคราว ชำระเงินสดที่ร้านได้</p>';
        }
    } else {
        h += '<p>เตรียมเงินสด ' + order.total + ' บาท จ่ายที่ร้านตอนรับอาหาร</p>';
        if (opts.qr) h += '<button class="link-btn" onclick="openPay(\'' + order.id + '\')">เปลี่ยนเป็นสแกน QR</button>';
    }
    return h + '</div>';
}

/* ---------- กล่องสแกน QR ---------- */

function openPay(id) {
    let order = loadOrders().find(function (o) { return o.id === id; });
    if (!order) return;
    let cfg = getStoreConfigs()[order.storeId];
    if (!cfg || !storePayOptions(cfg).qr) { showToast('ร้านนี้ยังไม่เปิดรับ QR', 'bad'); return; }
    let box = document.getElementById('pay-dialog');
    if (!box) {
        document.body.insertAdjacentHTML('beforeend',
            '<div id="pay-dialog" class="dialog" hidden><div class="dialog-box pay-box" role="dialog" aria-modal="true" aria-labelledby="pay-title">' +
            '<p class="pay-store" id="pay-store"></p>' +
            '<h3 id="pay-title">สแกนเพื่อชำระเงิน</h3>' +
            '<p class="pay-amount"><span id="pay-amount"></span> บาท</p>' +
            '<div class="qr-frame"><img id="pay-qr" alt="QR code สำหรับชำระเงิน"></div>' +
            '<dl class="pay-account"><div><dt>ชื่อบัญชี</dt><dd id="pay-name"></dd></div><div><dt>พร้อมเพย์</dt><dd id="pay-number"></dd></div></dl>' +
            '<a id="pay-save" class="link-btn" download="qr-payment.jpg">บันทึกรูป QR</a>' +
            '<ol class="pay-steps"><li>เปิดแอปธนาคาร สแกน QR หรือเลือกรูปจากเครื่อง</li><li>โอนยอด <b id="pay-amount2"></b> บาท ให้ตรง</li><li>แนบสลิปด้านล่าง แล้วกดแจ้งชำระเงิน</li></ol>' +
            '<label class="slip-pick"><input type="file" id="pay-slip-file" accept="image/*"><span id="pay-slip-label">แนบสลิปการโอน</span></label>' +
            '<img id="pay-slip-preview" class="slip-preview" alt="สลิป" hidden>' +
            '<p id="pay-error" class="field-error" role="alert"></p>' +
            '<div class="dialog-actions"><button type="button" class="btn-plain" id="pay-later">ไว้ทีหลัง</button>' +
            '<button type="button" class="btn-submit" id="pay-send">แจ้งชำระเงิน</button></div></div></div>');
        box = document.getElementById('pay-dialog');
        document.getElementById('pay-later').onclick = closePay;
        box.onclick = function (e) { if (e.target === box) closePay(); };
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePay(); });
        document.getElementById('pay-slip-file').addEventListener('change', function () {
            resizeImageFile(this.files[0], 720, function (data) {
                paySlip = data;
                let pv = document.getElementById('pay-slip-preview');
                pv.src = data;
                pv.hidden = false;
                document.getElementById('pay-slip-label').textContent = 'เปลี่ยนรูปสลิป';
                document.getElementById('pay-error').textContent = '';
            }, function (msg) { document.getElementById('pay-error').textContent = msg; });
        });
    }
    paySlip = '';
    document.getElementById('pay-slip-file').value = '';
    document.getElementById('pay-slip-preview').hidden = true;
    document.getElementById('pay-slip-label').textContent = 'แนบสลิปการโอน';
    document.getElementById('pay-error').textContent = '';
    document.getElementById('pay-store').textContent = order.store + ' · คิว ' + order.queue;
    document.getElementById('pay-amount').textContent = order.total;
    document.getElementById('pay-amount2').textContent = order.total;
    document.getElementById('pay-qr').src = cfg.qrImage;
    document.getElementById('pay-save').href = cfg.qrImage;
    document.getElementById('pay-name').textContent = cfg.payName || order.store;
    document.getElementById('pay-number').textContent = cfg.payNumber || '-';
    document.getElementById('pay-send').onclick = function () { sendPay(id); };
    box.hidden = false;
}

function closePay() {
    let box = document.getElementById('pay-dialog');
    if (box) box.hidden = true;
}

function sendPay(id) {
    if (!paySlip) { document.getElementById('pay-error').textContent = 'กรุณาแนบรูปสลิปการโอนก่อน'; return; }
    let orders = loadOrders();
    let order = orders.find(function (o) { return o.id === id; });
    if (!order || order.student !== user.student) return;
    if (order.status === 'cancelled') { closePay(); showToast('ออเดอร์นี้ถูกยกเลิกแล้ว', 'bad'); renderQueue(); return; }
    order.payment = { method: 'qr', status: 'pending', slip: paySlip, sentAt: Date.now() };
    order.updatedAt = Date.now();
    try { saveOrders(orders); } catch (e) {
        document.getElementById('pay-error').textContent = 'พื้นที่เก็บข้อมูลเต็ม ลองใช้รูปสลิปที่เล็กลง';
        return;
    }
    closePay();
    showToast('ส่งสลิปคิว <b>' + esc(order.queue) + '</b> แล้ว รอร้านตรวจสอบ', 'ok');
    renderQueue();
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
