/* ==========================================================
   admin.js — หน้าจัดการร้านค้า (admin.html) ไฟล์หลักของหน้าร้าน
   ล็อกอินด้วยรหัสร้าน (SHOP01…) + PIN (เริ่มต้น 1234)

   หน้าร้านแบ่งงานเป็นหลายไฟล์ (โหลดก่อนไฟล์นี้ ตามลำดับใน admin.html):
   - noshow.js        กติกาลูกค้าไม่มารับ
   - out-of-stock.js  กติกาของหมด -> ลูกค้าเลือกของแทน
   - order-timer.js   นับถอยหลัง + เตือนออเดอร์ที่ร้านยังไม่รับ
   - admin-options.js แก้ตัวเลือกเมนู (หมู/ไก่)
   - admin-stock.js   หน้าต่าง "ของหมด"
   - admin-cancel.js  หน้าต่างยกเลิกออเดอร์
   - admin-board.js   กระดานออเดอร์ 3 คอลัมน์

   สารบัญไฟล์นี้ (ค้นด้วย Ctrl+F เช่น "6. ")
   1. ข้อความเด้ง
   2. ข้อมูลร้าน
   3. เข้าสู่ระบบ / ออกจากระบบ
   4. สลับหน้า
   5. วาดหน้าจอ
   6. ตรวจออเดอร์ใหม่
   7. จัดการออเดอร์ (ปุ่มรับ / ทำเสร็จ / ยกเลิก ...)
   8. จัดการเมนู
   9. รูปภาพ
   10. ตั้งค่าร้าน
   11. ผูกปุ่มต่างๆ
   12. สมัครร้านค้าใหม่
   13. ลืมรหัสผ่านร้าน
   14. เริ่มต้น
========================================================== */

const ADMIN_STATUS = {
    new: 'ออเดอร์ใหม่',
    cooking: 'กำลังทำ',
    ready: 'พร้อมรับ',
    done: 'สำเร็จ',
    cancelled: 'ยกเลิก',
    noshow: 'ไม่มารับ'
};
const VIEW_TITLES = {
    overview: 'ภาพรวมร้านค้า',
    orders: 'ออเดอร์',
    queue: 'จัดการคิว',
    menu: 'เมนูและสินค้า',
    settings: 'ตั้งค่าร้าน'
};

let adminStore = null;      // ร้านที่ล็อกอินอยู่
let currentView = 'overview';
let lastOrdersRaw = null;
let seenOrderIds = null;
let pollTimer = null;
let toastTimer = null;

function $(id) { return document.getElementById(id); }

/* ---------- 1. ข้อความเด้ง ---------- */
function adminToast(text) {
    let box = $('toast');
    box.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.textContent = ''; }, 3500);
}

/* ---------- 2. ข้อมูลร้าน ---------- */
function adminConfig() {
    return getStoreConfigs()[adminStore.id];
}

function updateAdminConfig(changes) {
    let configs = getStoreConfigs();
    Object.assign(configs[adminStore.id], changes);
    saveStoreConfigs(configs);
}

function adminOrders() {
    return loadOrders().filter(function (o) { return o.storeId === adminStore.id; });
}

function isTodayTs(ts) {
    return dateKey(ts) === dateKey(Date.now());
}

function badge(status) {
    return '<span class="badge ' + status + '">' + ADMIN_STATUS[status] + '</span>';
}

function itemsText(o) {
    return o.items.map(function (it) {
        // ตัวเลือกแสดงตัวหนาให้แม่ค้าเห็นชัด เช่น "ข้าวผัดกะเพรา ×1" แล้วบรรทัดใหม่ "หมูกรอบ, ไข่ดาว, เผ็ดน้อย"
        let options = optionNames(it) ? '<br><b class="item-options">' + esc(optionNames(it)) + '</b>' : '';
        return esc(it.name) + ' ×' + it.quantity + options + (it.note ? ' <small class="muted">(' + esc(it.note) + ')</small>' : '');
    }).join('<br>');
}

/* ---------- 3. เข้าสู่ระบบ / ออกจากระบบ ---------- */
function findStoreIdByCode(code) {
    let configs = getStoreConfigs();
    return Object.keys(configs).find(function (id) {
        return String(configs[id].code).toUpperCase() === code && findStore(id);
    }) || null;
}

function adminLogin(event) {
    event.preventDefault();
    let code = $('store-code').value.trim().toUpperCase();
    let pin = $('store-pin').value.trim();
    let error = $('login-error');
    $('login-ok').textContent = '';
    let storeId = findStoreIdByCode(code);
    if (!storeId) { error.textContent = 'ไม่พบรหัสร้านนี้ (ตัวอย่าง: SHOP01)'; return; }
    if (getStoreConfigs()[storeId].pin !== pin) {
        error.innerHTML = 'รหัสผ่านไม่ถูกต้อง <a href="#forgot" data-auth="forgot">ลืมรหัสผ่าน?</a>';
        return;
    }
    error.textContent = '';
    sessionStorage.setItem('food_merchant', JSON.stringify({ storeId: Number(storeId), at: Date.now() }));
    startApp(Number(storeId));
}

function adminLogout() {
    sessionStorage.removeItem('food_merchant');
    clearInterval(pollTimer);
    pollTimer = null;
    stopLateCheck();    // หยุดจับเวลา (order-timer.js)
    adminStore = null;
    $('app').classList.add('hidden');
    $('login-screen').classList.remove('hidden');
    $('login-form').reset();
    showAuth('login');
}

function startApp(storeId) {
    adminStore = findStore(storeId);
    if (!adminStore) { adminLogout(); return; }
    saveStoreConfigs(getStoreConfigs()); // บันทึกค่าเริ่มต้นของทุกร้าน
    $('login-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    seenOrderIds = adminOrders().map(function (o) { return o.id; });
    lastOrdersRaw = null;
    showView('orders');   // เปิดมาเจอกระดานออเดอร์เลย
    renderAll();
    if (!pollTimer) pollTimer = setInterval(checkChanges, 2000);
    startLateCheck();   // เริ่มนับถอยหลัง + เตือนออเดอร์ค้าง (order-timer.js)
    askSound();         // เบราว์เซอร์ยังบล็อกเสียง -> โชว์แถบให้แตะเปิดเสียง (main.js)
}

/* ---------- 4. สลับหน้า ---------- */
function showView(name) {
    if (!VIEW_TITLES[name]) name = 'overview';
    currentView = name;
    document.querySelectorAll('.view').forEach(function (v) {
        v.classList.toggle('hidden', v.id !== 'view-' + name);
    });
    document.querySelectorAll('.nav-item').forEach(function (b) {
        b.classList.toggle('active', b.dataset.view === name);
    });
    $('page-title').textContent = VIEW_TITLES[name];
    if (name === 'settings') renderSettings();
}

/* ---------- 5. วาดหน้าจอ ---------- */
function renderAll() {
    if (!adminStore) return;
    let cfg = adminConfig();
    let orders = adminOrders();
    lastOrdersRaw = localStorage.getItem('food_orders');

    $('side-store-name').textContent = adminStore.name;
    $('side-store-code').textContent = cfg.code + ' · ' + adminStore.floorName + (cfg.open ? '' : ' · ปิดร้าน');
    $('welcome-store').textContent = adminStore.name;
    $('avatar').textContent = adminStore.name.replace('ร้าน', '').charAt(0) || 'S';
    $('today-label').textContent = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    $('sound-toggle').textContent = cfg.sound ? '🔔' : '🔕';
    $('sound-toggle').classList.toggle('off', !cfg.sound);

    let count = function (st) { return orders.filter(function (o) { return o.status === st; }).length; };
    $('nav-order-count').textContent = count('new');
    $('nav-order-count').style.display = count('new') > 0 ? '' : 'none';

    renderOverview(orders, count);
    renderBoard(orders);   // กระดานออเดอร์ 3 คอลัมน์ (admin-board.js)
    renderOrders(orders);
    renderQueue(orders, count);
    renderMenu();
}

function renderOverview(orders, count) {
    let today = orders.filter(function (o) { return isTodayTs(o.createdAt); });
    let sales = today.filter(function (o) { return o.status === 'done'; })
        .reduce(function (s, o) { return s + o.total; }, 0);
    $('stat-new').textContent = count('new');
    $('stat-cooking').textContent = count('cooking');
    $('stat-ready').textContent = count('ready');
    $('stat-sales').textContent = '฿' + sales.toLocaleString();

    let recent = orders.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 5);
    $('recent-orders').innerHTML = recent.map(function (o) {
        return '<div><b>' + esc(o.queue) + '</b> · ' + esc(o.name || o.student) + ' · ' + o.total + ' บาท ' + badge(o.status) +
            '<br><small class="muted">' + timeText(o.createdAt) + ' · ' + agoText(o.createdAt) + '</small></div>';
    }).join('');

    let active = orders.filter(function (o) { return o.status === 'new' || o.status === 'cooking' || o.status === 'ready'; })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
    $('queue-summary').innerHTML = active.length
        ? '<div class="order-list">' + active.map(function (o) {
            return '<div><b>' + esc(o.queue) + '</b> ' + badge(o.status) + ' ' + countdownHtml(o) + '</div>';
        }).join('') + '</div>'
        : '';
}

// ปุ่มในตาราง (กระดานออเดอร์มีปุ่มของตัวเองใน admin-board.js)
function actionButtons(o) {
    let b = function (act, label, cls) {
        return '<button class="btn ' + cls + '" data-act="' + act + '" data-id="' + o.id + '">' + label + '</button> ';
    };
    if (o.status === 'new') return b('accept', 'รับออเดอร์', 'primary') + b('cancel', 'ยกเลิก', 'ghost');
    if (o.status === 'cooking') return b('ready', 'ทำเสร็จ · เรียกคิว', 'primary') + b('cancel', 'ยกเลิก', 'ghost');
    if (o.status === 'ready') return b('done', 'ลูกค้ารับแล้ว · รับเงิน ' + o.total + ' ฿', 'primary') + b('recall', 'เรียกซ้ำ', 'ghost') + b('noshow', 'ไม่มารับ', 'ghost');
    return '';
}

function renderOrders(orders) {
    let q = $('order-search').value.trim().toLowerCase();
    let st = $('status-filter').value;
    let list = orders.filter(function (o) {
        if (st !== 'all' && o.status !== st) return false;
        if (!q) return true;
        return [o.queue, o.name, o.student].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    if (list.length === 0) { $('orders-container').innerHTML = ''; return; }
    let h = '<table><thead><tr><th>คิว</th><th>ลูกค้า</th><th>รายการ</th><th>รวม</th><th>เวลา</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    list.forEach(function (o) {
        // ออเดอร์ใหม่ -> โชว์นับถอยหลังใต้เลขคิว / ค้างนาน -> แถวสีแดง
        h += '<tr' + (isLate(o) ? ' class="late"' : '') + '><td><b>' + esc(o.queue) + '</b><br>' + countdownHtml(o) + '</td>' +
            '<td>' + esc(o.name || '-') + '<br><small class="muted">' + esc(o.student) + '</small></td>' +
            '<td>' + itemsText(o) + '</td>' +
            '<td>' + o.total + ' ฿</td>' +
            '<td>' + timeText(o.createdAt) + '</td>' +
            '<td>' + badge(o.status) + (o.cancelReason ? '<br><small class="muted">' + esc(o.cancelReason) + '</small>' : '') + '</td>' +
            '<td class="nowrap">' + actionButtons(o) + '</td></tr>';
    });
    $('orders-container').innerHTML = h + '</tbody></table>';
}

function renderQueue(orders, count) {
    let doneToday = orders.filter(function (o) { return o.status === 'done' && isTodayTs(o.doneAt || o.updatedAt); }).length;
    $('queue-cooking-count').textContent = count('new') + count('cooking');
    $('queue-ready-count').textContent = count('ready');
    $('queue-done-count').textContent = doneToday;

    let active = orders.filter(function (o) { return o.status === 'new' || o.status === 'cooking' || o.status === 'ready'; })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
    if (active.length === 0) { $('queue-container').innerHTML = ''; return; }
    let h = '<table><thead><tr><th>คิว</th><th>ลูกค้า</th><th>รายการ</th><th>เก็บเงินสด</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    active.forEach(function (o) {
        h += '<tr><td><b style="font-size:20px">' + esc(o.queue) + '</b></td><td>' + esc(o.name || o.student) + '</td>' +
            '<td>' + itemsText(o) + '</td><td>' + o.total + ' ฿</td><td>' + badge(o.status) + '</td><td class="nowrap">' + actionButtons(o) + '</td></tr>';
    });
    $('queue-container').innerHTML = h + '</tbody></table>';
}

function renderMenu() {
    let menus = adminStore.menus;
    if (menus.length === 0) { $('menu-container').innerHTML = ''; return; }
    let h = '<table><thead><tr><th>เมนู</th><th>ราคา</th><th>สถานะ</th><th></th></tr></thead><tbody>';
    menus.forEach(function (m) {
        let on = m.available !== false;
        let thumb = m.image
            ? '<img class="menu-thumb" src="' + esc(m.image) + '" alt="">'
            : '<span class="menu-thumb none">ไม่มีรูป</span>';
        // บอกว่าเมนูนี้มีตัวเลือกกี่กลุ่ม เช่น "ตัวเลือก: เลือกเนื้อสัตว์, เพิ่มเติม"
        let optionInfo = '';
        if (m.options && m.options.length > 0) {
            let titles = m.options.map(function (group) { return group.title; });
            optionInfo = '<br><small class="muted">ตัวเลือก: ' + esc(titles.join(', ')) + '</small>';
        }
        h += '<tr><td>' + thumb + esc(m.name) + optionInfo + '</td><td>' + m.price + ' ฿</td>' +
            '<td><span class="badge ' + (on ? 'ready' : 'cancelled') + '">' + (on ? 'พร้อมขาย' : 'หมด') + '</span></td>' +
            '<td class="nowrap"><button class="btn ghost" data-menu="toggle" data-id="' + m.id + '">' + (on ? 'ตั้งเป็นหมด' : 'เปิดขาย') + '</button> ' +
            '<button class="btn ghost" data-menu="edit" data-id="' + m.id + '">แก้ไข</button> ' +
            '<button class="btn ghost" data-menu="delete" data-id="' + m.id + '">ลบ</button></td></tr>';
    });
    $('menu-container').innerHTML = h + '</tbody></table>';
}

function renderSettings() {
    let cfg = adminConfig();
    $('setting-name').value = adminStore.name;
    $('setting-code').value = cfg.code;
    $('setting-phone').value = cfg.phone || '';
    $('setting-open').value = cfg.open ? 'open' : 'closed';
    storeImage.set(adminStore.image || '');
}

/* ---------- 6. ตรวจออเดอร์ใหม่ (จากแท็บลูกค้า) ---------- */
function checkChanges() {
    if (!adminStore) return;
    let raw = localStorage.getItem('food_orders');
    if (raw === lastOrdersRaw) return;
    let fresh = adminOrders().filter(function (o) { return o.status === 'new' && seenOrderIds.indexOf(o.id) === -1; });
    adminOrders().forEach(function (o) { if (seenOrderIds.indexOf(o.id) === -1) seenOrderIds.push(o.id); });
    if (fresh.length > 0) {
        adminToast('🔔 ออเดอร์ใหม่ ' + fresh.length + ' รายการ: ' + fresh.map(function (o) { return o.queue; }).join(', '));
        if (adminConfig().sound) beep(3);
        desktopNotify('ออเดอร์ใหม่', adminStore.name + ' · คิว ' + fresh.map(function (o) { return o.queue; }).join(', '));
    }
    renderAll();
}

/* ---------- 7. จัดการออเดอร์ ---------- */
function orderAct(act, id) {
    let orders = loadOrders();
    let o = orders.find(function (x) { return x.id === id; });
    if (!o || o.storeId !== adminStore.id) return;
    let now = Date.now();
    let allowed = {
        accept: ['new'], ready: ['new', 'cooking'], done: ['ready'],
        cancel: ['new', 'cooking'], recall: ['ready'], noshow: ['ready'], stock: ['new', 'cooking']
    };
    if (!allowed[act] || allowed[act].indexOf(o.status) === -1) {
        adminToast('สถานะออเดอร์เปลี่ยนไปแล้ว');
        renderAll();
        return;
    }
    // ยังรอลูกค้าเลือกของแทนอยู่ -> ห้ามกดทำเสร็จ (ร้านยังไม่รู้ว่าต้องใส่อะไร)
    if (act === 'ready' && hasPendingChoice(o)) {
        adminToast('คิว ' + o.queue + ' ยังรอลูกค้าเลือกของแทน (ไม่เกิน ' + CHOOSE_MINUTES + ' นาที)');
        return;
    }
    if (act === 'stock') { openStockDialog(o); return; }   // ของหมด -> เปิดหน้าต่างเลือก (admin-stock.js)
    if (act === 'cancel') { openCancelDialog(o); return; } // ยกเลิก -> เปิดหน้าต่างเลือกเหตุผล (admin-cancel.js)
    if (act === 'accept') { o.status = 'cooking'; o.acceptedAt = now; }
    if (act === 'ready') { o.status = 'ready'; o.readyAt = now; if (!o.acceptedAt) o.acceptedAt = now; }
    // ลูกค้ารับอาหาร + จ่ายเงินสดแล้ว (จ่ายที่ร้านอย่างเดียว จึงจบในปุ่มเดียว)
    if (act === 'done') { o.status = 'done'; o.doneAt = now; }
    if (act === 'recall') { o.recalledAt = now; }
    // ลูกค้าไม่มารับ: กดได้เมื่ออาหารพร้อมแล้วรอครบ 15 นาที (กติกาอยู่ใน noshow.js)
    if (act === 'noshow') {
        let wait = minutesUntilNoShow(o);
        if (wait > 0) {
            adminToast('ต้องรอให้ลูกค้าอีก ' + wait + ' นาที ถึงจะกด "ไม่มารับ" ได้ (ลองกด "เรียกซ้ำ" ก่อน)');
            return;
        }
        if (!confirm('ยืนยันว่าลูกค้าคิว ' + o.queue + ' ไม่มารับอาหาร?\nระบบจะนับเป็น 1 ครั้ง (ครบ ' + MAX_NO_SHOW + ' ครั้งจะถูกพักการสั่ง)')) return;
        o.status = 'noshow';
        o.noShowAt = now;
    }
    o.updatedAt = now;
    saveOrders(orders);
    if (act === 'ready' || act === 'recall') adminToast('📢 เรียกคิว ' + o.queue + ' แล้ว');
    renderAll();
}

// เรียกคิวถัดไป: คิวที่กำลังทำเก่าสุด (ถ้าไม่มี ใช้คิวใหม่เก่าสุด) -> พร้อมรับ
function callNextQueue() {
    // ข้ามคิวที่ยังรอลูกค้าเลือกของแทน (out-of-stock.js)
    let orders = adminOrders().filter(function (o) { return !hasPendingChoice(o); })
        .sort(function (a, b) { return a.createdAt - b.createdAt; });
    let next = orders.find(function (o) { return o.status === 'cooking'; }) ||
               orders.find(function (o) { return o.status === 'new'; });
    if (!next) { adminToast('ไม่มีคิวที่รออยู่'); return; }
    orderAct('ready', next.id);
}

/* ---------- 8. จัดการเมนู ---------- */
function storeInData() {
    for (let f of foodData) {
        for (let s of f.stores) if (s.id === adminStore.id) return s;
    }
    return null;
}

function saveMenus() {
    trySaveFoodData();
    adminStore = findStore(adminStore.id);
    renderAll();
}

function menuAct(act, id) {
    let store = storeInData();
    let menu = store.menus.find(function (m) { return m.id === Number(id); });
    if (!menu) return;
    if (act === 'toggle') {
        menu.available = menu.available === false;
        saveMenus();
        if (menu.available === false) notifyOutOfStock();   // ตั้งเป็นหมด -> แจ้งลูกค้าที่สั่งไว้ (admin-stock.js)
    }
    if (act === 'edit') openMenuForm(menu);
    if (act === 'delete') {
        if (!confirm('ลบเมนู "' + menu.name + '"?')) return;
        store.menus.splice(store.menus.indexOf(menu), 1);
        saveMenus();
        adminToast('ลบเมนูแล้ว');
    }
}

/* ---------- 9. รูปภาพ: อ่านไฟล์ + ย่อขนาดก่อนเก็บ (localStorage มีพื้นที่จำกัด) ---------- */
function readImageFile(file, done) {
    if (!file) return;
    resizeImageFile(file, 640, done, adminToast);
}

// ผูกช่องเลือกรูป / ลิงก์รูป / ปุ่มลบรูป เข้ากับตัวแสดงตัวอย่าง
function imagePicker(prefix) {
    let picker = {
        value: '',
        set: function (src) {
            picker.value = src || '';
            $(prefix + '-image-preview').src = picker.value;
            $(prefix + '-image-url').value = /^data:/.test(picker.value) ? '' : picker.value;
            $(prefix + '-image-file').value = '';
        }
    };
    $(prefix + '-image-file').addEventListener('change', function () {
        readImageFile(this.files[0], function (data) { picker.set(data); });
    });
    $(prefix + '-image-url').addEventListener('change', function () {
        let url = this.value.trim();
        if (url && !/^https?:\/\//i.test(url)) { adminToast('ลิงก์รูปต้องขึ้นต้นด้วย http:// หรือ https://'); return; }
        picker.set(url);
    });
    $(prefix + '-image-clear').addEventListener('click', function () { picker.set(''); });
    return picker;
}

let menuImage = imagePicker('menu');
let storeImage = imagePicker('store');

// บันทึก foodData แบบจับกรณีพื้นที่เต็ม
function trySaveFoodData() {
    try {
        saveFoodData();
        return true;
    } catch (e) {
        adminToast('พื้นที่เก็บข้อมูลเต็ม กรุณาใช้รูปที่เล็กลงหรือใช้ลิงก์รูปแทน');
        loadFoodData();
        adminStore = findStore(adminStore.id);
        return false;
    }
}

function openMenuForm(menu) {
    $('menu-form').classList.remove('hidden');
    $('menu-form-title').textContent = menu ? 'แก้ไขเมนู' : 'เพิ่มเมนู';
    $('menu-id').value = menu ? menu.id : '';
    $('menu-name').value = menu ? menu.name : '';
    $('menu-price').value = menu ? menu.price : '';
    menuImage.set(menu ? menu.image : '');
    startOptionsEditor(menu);   // ตัวเลือกของเมนู (admin-options.js)
    $('menu-name').focus();
}

function saveMenuForm(event) {
    event.preventDefault();
    let name = $('menu-name').value.trim();
    let price = Number($('menu-price').value);
    if (!name || !(price >= 0)) { adminToast('กรุณากรอกชื่อและราคาให้ถูกต้อง'); return; }
    let options = optionsForSave();   // ตรวจตัวเลือก (admin-options.js) null = มีข้อผิดพลาด
    if (options === null) return;
    let store = storeInData();
    let id = $('menu-id').value;
    if (id) {
        let menu = store.menus.find(function (m) { return m.id === Number(id); });
        if (menu) { menu.name = name; menu.price = price; menu.image = menuImage.value; menu.options = options; }
    } else {
        let maxId = store.menus.reduce(function (mx, m) { return Math.max(mx, m.id || 0); }, store.id * 100);
        store.menus.push({ id: maxId + 1, name: name, price: price, available: true, image: menuImage.value, options: options });
    }
    if (!trySaveFoodData()) { renderAll(); return; }
    $('menu-form').classList.add('hidden');
    adminStore = findStore(adminStore.id);
    renderAll();
    adminToast('บันทึกเมนูแล้ว');
    notifyOutOfStock();   // ถ้าติ๊กตัวเลือกไหนเป็น "หมด" -> แจ้งลูกค้าที่สั่งไว้ (admin-stock.js)
}

/* ---------- 10. ตั้งค่า ---------- */
function saveSettings(event) {
    event.preventDefault();
    let name = $('setting-name').value.trim();
    if (!name) { adminToast('กรุณากรอกชื่อร้าน'); return; }
    let store = storeInData();
    let oldName = store.name;
    store.name = name;
    store.image = storeImage.value;
    if (!trySaveFoodData()) { renderAll(); return; }
    adminStore = findStore(adminStore.id);
    // เปลี่ยนชื่อร้านในออเดอร์เดิมด้วย ลูกค้าจะได้เห็นชื่อใหม่ในหน้าคิว
    if (oldName !== name) {
        let orders = loadOrders();
        orders.forEach(function (o) {
            if (o.storeId === adminStore.id) {
                o.store = name;
                o.items.forEach(function (it) { it.store = name; });
            }
        });
        saveOrders(orders);
    }
    updateAdminConfig({
        phone: $('setting-phone').value.trim(),
        open: $('setting-open').value === 'open'
    });
    renderAll();
    adminToast(oldName !== name ? 'บันทึกแล้ว เปลี่ยนชื่อร้านเป็น "' + name + '"' : 'บันทึกการตั้งค่าแล้ว');
}

/* ---------- 11. ผูกปุ่มต่างๆ ---------- */
$('login-form').addEventListener('submit', adminLogin);
$('logout-btn').addEventListener('click', adminLogout);
$('order-search').addEventListener('input', renderAll);
$('status-filter').addEventListener('change', renderAll);
$('next-queue').addEventListener('click', callNextQueue);
$('add-menu').addEventListener('click', function () { openMenuForm(null); });
$('cancel-menu').addEventListener('click', function () { $('menu-form').classList.add('hidden'); });
$('menu-form').addEventListener('submit', saveMenuForm);
$('settings-form').addEventListener('submit', saveSettings);
$('sound-toggle').addEventListener('click', function () {
    updateAdminConfig({ sound: !adminConfig().sound });
    renderAll();
    adminToast(adminConfig().sound ? 'เปิดเสียงแจ้งเตือนแล้ว' : 'ปิดเสียงแจ้งเตือนแล้ว');
});
$('toast').addEventListener('click', function () { $('toast').textContent = ''; });

// มือถือ: กด ☰ เปิด/ปิดเมนู
function toggleMenu(open) {
    document.querySelector('.sidebar').classList.toggle('open', open);
    $('menu-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('menu-toggle').addEventListener('click', function () {
    toggleMenu(!document.querySelector('.sidebar').classList.contains('open'));
});

document.addEventListener('click', function (e) {
    let nav = e.target.closest('[data-view]');
    if (nav) { showView(nav.dataset.view); toggleMenu(false); return; }   // เลือกเมนูแล้วพับเมนูเก็บ
    let go = e.target.closest('[data-goto]');
    if (go) { showView(go.dataset.goto); return; }
    let act = e.target.closest('[data-act]');
    if (act) { orderAct(act.dataset.act, act.dataset.id); return; }
    let m = e.target.closest('[data-menu]');
    if (m) menuAct(m.dataset.menu, m.dataset.id);
});

window.addEventListener('storage', function (e) {
    if (!adminStore || (e.key && e.key.indexOf('food_') !== 0)) return;
    if (e.key === 'food_data' || !e.key) { loadFoodData(); adminStore = findStore(adminStore.id); }
    lastOrdersRaw = null;
    checkChanges();
    if (lastOrdersRaw === null) renderAll();
});

/* ---------- 12. สมัครร้านค้าใหม่ ---------- */
function showAuth(which) {
    $('login-form').classList.toggle('hidden', which !== 'login');
    $('register-form').classList.toggle('hidden', which !== 'register');
    $('register-done').classList.toggle('hidden', which !== 'done');
    $('forgot-form').classList.toggle('hidden', which !== 'forgot');
    $('login-ok').textContent = '';
    if (which === 'forgot') resetForgot();
    if (which === 'register') {
        $('reg-shop-floor').innerHTML = foodData.map(function (f) {
            return '<option value="' + f.id + '">' + esc(f.name) + '</option>';
        }).join('');
        $('reg-shop-name').focus();
    }
    if (which === 'login') $('store-code').focus();
    history.replaceState(null, '', which === 'register' || which === 'forgot' ? '#' + which : location.pathname);
}

/* ---------- 13. ลืมรหัสผ่านร้าน: ยืนยันด้วยรหัสร้าน + เบอร์โทรร้าน ---------- */
let forgotStoreId = null;   // ร้านที่ยืนยันตัวตนผ่านแล้ว

function resetForgot() {
    forgotStoreId = null;
    $('forgot-form').reset();
    ['fg-code', 'fg-phone', 'fg-pin', 'fg-pin2'].forEach(function (id) { regError(id, ''); });
    $('fg-error').textContent = '';
    $('fg-verify').classList.remove('hidden');
    $('fg-reset').classList.add('hidden');
    $('fg-intro').textContent = 'ยืนยันด้วยรหัสร้านและเบอร์โทรร้านที่ลงทะเบียนไว้';
    $('fg-submit').textContent = 'ถัดไป';
    let typed = $('store-code').value.trim().toUpperCase();
    if (typed) $('fg-code').value = typed;
    setTimeout(function () { $(typed ? 'fg-phone' : 'fg-code').focus(); }, 0);
}

function submitForgot(event) {
    event.preventDefault();
    let error = $('fg-error');
    error.textContent = '';

    // ขั้นที่ 2: ตั้งรหัสผ่านใหม่
    if (forgotStoreId) {
        let pin = $('fg-pin').value.trim();
        let pin2 = $('fg-pin2').value.trim();
        let ok = regError('fg-pin', pin.length < 4 ? 'รหัสผ่านอย่างน้อย 4 ตัว' : '');
        ok = regError('fg-pin2', pin2 !== pin ? 'รหัสผ่านไม่ตรงกัน' : '') && ok;
        if (!ok) return;
        let configs = getStoreConfigs();
        if (!configs[forgotStoreId]) { resetForgot(); return; }
        configs[forgotStoreId].pin = pin;
        configs[forgotStoreId].pinChangedAt = Date.now();
        saveStoreConfigs(configs);
        let code = configs[forgotStoreId].code;
        showAuth('login');
        $('store-code').value = code;
        $('store-pin').value = '';
        $('login-error').textContent = '';
        $('login-ok').textContent = 'ตั้งรหัสผ่านใหม่ของ ' + code + ' แล้ว เข้าสู่ระบบด้วยรหัสใหม่ได้เลย';
        $('store-pin').focus();
        return;
    }

    // ขั้นที่ 1: ยืนยันตัวตน
    let code = $('fg-code').value.trim().toUpperCase();
    let phone = $('fg-phone').value.trim();
    let ok = regError('fg-code', code ? '' : 'กรุณากรอกรหัสร้าน');
    ok = regError('fg-phone', /^0[0-9]{8,9}$/.test(phone) ? '' : 'กรอกเบอร์โทร 9–10 หลัก เช่น 0812345678') && ok;
    if (!ok) return;

    let key = 'shop:' + code;
    let wait = lockedSeconds(key);
    if (wait > 0) { error.textContent = 'กรอกผิดหลายครั้ง กรุณารอ ' + wait + ' วินาทีแล้วลองใหม่'; return; }

    let storeId = findStoreIdByCode(code);
    let cfg = storeId ? getStoreConfigs()[storeId] : null;
    if (cfg && !cfg.phone) {
        error.textContent = 'ร้านนี้ยังไม่ได้ลงทะเบียนเบอร์โทร จึงตั้งรหัสใหม่เองไม่ได้ กรุณาติดต่อผู้ดูแลระบบ';
        return;
    }
    if (!cfg || !samePhone(cfg.phone, phone)) {
        let left = noteFailedTry(key);
        error.textContent = left > 0
            ? 'รหัสร้านหรือเบอร์โทรไม่ตรงกับข้อมูลร้าน (เหลือ ' + left + ' ครั้ง)'
            : 'กรอกผิดหลายครั้ง กรุณารอ ' + lockedSeconds(key) + ' วินาทีแล้วลองใหม่';
        return;
    }
    clearTries(key);
    forgotStoreId = storeId;
    $('fg-verify').classList.add('hidden');
    $('fg-reset').classList.remove('hidden');
    $('fg-intro').textContent = 'ตั้งรหัสผ่านใหม่สำหรับ ' + findStore(storeId).name + ' (' + cfg.code + ')';
    $('fg-submit').textContent = 'บันทึกรหัสผ่านใหม่';
    $('fg-pin').focus();
}

function regError(id, text) {
    let field = $(id).closest('.field');
    field.classList.toggle('invalid', !!text);
    field.querySelector('.field-error').textContent = text || '';
    return !text;
}

function registerShop(event) {
    event.preventDefault();
    let name = $('reg-shop-name').value.trim().replace(/\s+/g, ' ');
    let floorId = Number($('reg-shop-floor').value);
    let owner = $('reg-owner').value.trim();
    let phone = $('reg-shop-phone').value.trim();
    let pin = $('reg-shop-pin').value.trim();
    let pin2 = $('reg-shop-pin2').value.trim();

    let taken = allStores().some(function (s) { return s.name.toLowerCase() === name.toLowerCase(); });
    let ok = true;
    ok = regError('reg-shop-name', name.length < 2 ? 'กรุณากรอกชื่อร้าน' : taken ? 'มีร้านชื่อนี้ในระบบแล้ว' : '') && ok;
    ok = regError('reg-shop-floor', !foodData.some(function (f) { return f.id === floorId; }) ? 'กรุณาเลือกชั้น' : '') && ok;
    ok = regError('reg-owner', owner.length < 2 ? 'กรุณากรอกชื่อเจ้าของร้าน' : '') && ok;
    ok = regError('reg-shop-phone', !/^0[0-9]{8,9}$/.test(phone) ? 'กรอกเบอร์โทร 9–10 หลัก เช่น 0812345678' : '') && ok;
    ok = regError('reg-shop-pin', pin.length < 4 ? 'รหัสผ่านอย่างน้อย 4 ตัว' : '') && ok;
    ok = regError('reg-shop-pin2', pin2 !== pin ? 'รหัสผ่านไม่ตรงกัน' : '') && ok;
    if (!ok) {
        let first = $('register-form').querySelector('.field.invalid input, .field.invalid select');
        if (first) first.focus();
        return;
    }

    // สร้างร้านใหม่ในข้อมูลกลาง
    let newId = allStores().reduce(function (mx, s) { return Math.max(mx, s.id); }, 0) + 1;
    let floor = foodData.find(function (f) { return f.id === floorId; });
    floor.stores.push({ id: newId, name: name, image: '', menus: [] });
    try { saveFoodData(); } catch (e) {
        floor.stores.pop();
        adminToast('พื้นที่เก็บข้อมูลเต็ม สมัครไม่สำเร็จ');
        return;
    }

    let configs = getStoreConfigs();
    let codes = Object.keys(configs).filter(function (id) { return Number(id) !== newId; })
        .map(function (id) { return String(configs[id].code).toUpperCase(); });
    let code = 'SHOP' + String(newId).padStart(2, '0');
    let n = newId;
    while (codes.indexOf(code) !== -1) { n++; code = 'SHOP' + String(n).padStart(2, '0'); }
    Object.assign(configs[newId], { code: code, pin: pin, owner: owner, phone: phone, open: true, createdAt: Date.now() });
    saveStoreConfigs(configs);

    $('register-form').reset();
    $('done-shop-name').textContent = name;
    $('done-shop-code').textContent = code;
    showAuth('done');
}

$('register-form').addEventListener('submit', registerShop);
$('forgot-form').addEventListener('submit', submitForgot);
$('forgot-form').addEventListener('input', function (e) {
    let field = e.target.closest('.field');
    if (field && field.classList.contains('invalid')) regError(e.target.id, '');
    $('fg-error').textContent = '';
});
$('fg-phone').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
$('register-form').addEventListener('input', function (e) {
    let field = e.target.closest('.field');
    if (field && field.classList.contains('invalid')) regError(e.target.id, '');
});
$('reg-shop-phone').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); });
$('done-login').addEventListener('click', function () {
    let code = $('done-shop-code').textContent;
    showAuth('login');
    $('store-code').value = code;
    $('store-pin').focus();
});
document.addEventListener('click', function (e) {
    let a = e.target.closest('[data-auth]');
    if (a) { e.preventDefault(); showAuth(a.dataset.auth); }
});

/* ---------- 14. เริ่มต้น: ถ้าล็อกอินอยู่แล้วในแท็บนี้ เข้าแอปเลย ---------- */
(function init() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem('food_merchant')); } catch (e) { s = null; }
    if (s && findStore(s.storeId)) startApp(s.storeId);
    else if (location.hash === '#register') showAuth('register');
    else if (location.hash === '#forgot') showAuth('forgot');
})();
