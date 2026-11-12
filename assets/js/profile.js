/* ==========================================================
   profile.js — หน้าข้อมูลของฉัน (profile.html)
   แสดง: ข้อมูลส่วนตัว + สรุปยอด + ประวัติการสั่งอาหาร
   ต้องโหลดหลัง main.js
========================================================== */

let user = getCurrentUser();   // { name, student } ของคนที่ล็อกอินอยู่

if (user === null) {
    // ยังไม่ล็อกอิน -> กลับไปหน้าเข้าสู่ระบบ
    location.replace('index.html');
} else {
    showCartCount();
    showProfile();
    showHistory();

    // มีออเดอร์เปลี่ยน (เช่น ร้านกดรับออเดอร์) -> วาดประวัติใหม่
    window.addEventListener('storage', function (e) {
        if (e.key === 'food_orders') showHistory();
    });
}


/* ---------- จำนวนของในตะกร้า (มุมขวาบน) ---------- */
function showCartCount() {
    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('food_cart')) || [];
    } catch (e) {
        cart = [];
    }

    let count = 0;
    for (let i = 0; i < cart.length; i++) {
        count = count + cart[i].quantity;
    }
    document.getElementById('cart-count').textContent = count;
}


/* ---------- ข้อมูลส่วนตัว ---------- */
function showProfile() {
    // ดึงบัญชีของเราจากรายชื่อนักศึกษาทั้งหมด
    let students = loadStudents();
    let account = students[user.student];

    let name = user.name;
    let phone = '-';
    let joined = '-';

    if (account) {
        name = account.name;
        if (account.phone) phone = account.phone;
        if (account.createdAt) joined = dateText(account.createdAt);
    }

    document.getElementById('avatar').textContent = name.charAt(0);
    document.getElementById('info-name').textContent = name;
    document.getElementById('info-student').textContent = user.student;
    document.getElementById('info-phone').textContent = phone;
    document.getElementById('info-joined').textContent = joined;
}


/* ---------- ประวัติการสั่ง + สรุปยอด ---------- */
function showHistory() {
    // 1) เอาเฉพาะออเดอร์ของเรา
    let allOrders = loadOrders();
    let myOrders = [];
    for (let i = 0; i < allOrders.length; i++) {
        if (allOrders[i].student === user.student) {
            myOrders.push(allOrders[i]);
        }
    }

    // 2) เรียงจากใหม่ไปเก่า
    myOrders.sort(function (a, b) {
        return b.createdAt - a.createdAt;
    });

    // 3) สรุปยอด (ไม่นับออเดอร์ที่ถูกยกเลิก หรือไม่มารับ)
    let count = 0;
    let total = 0;
    let storeCount = {};   // { 'ชื่อร้าน': จำนวนครั้งที่สั่ง }

    for (let i = 0; i < myOrders.length; i++) {
        let order = myOrders[i];
        if (order.status === 'cancelled' || order.status === 'noshow') continue;

        count = count + 1;
        total = total + order.total;

        if (storeCount[order.store] == null) storeCount[order.store] = 0;
        storeCount[order.store] = storeCount[order.store] + 1;
    }

    // หาร้านที่สั่งบ่อยที่สุด
    let favorite = '-';
    let most = 0;
    for (let store in storeCount) {
        if (storeCount[store] > most) {
            most = storeCount[store];
            favorite = store;
        }
    }

    document.getElementById('stat-count').textContent = count;
    document.getElementById('stat-total').textContent = total.toLocaleString('th-TH');
    document.getElementById('stat-store').textContent = favorite;

    // ไม่มารับอาหารกี่ครั้ง (กติกาอยู่ใน noshow.js)
    showNoShow();

    // 4) วาดรายการประวัติ
    let list = document.getElementById('history-list');

    if (myOrders.length === 0) {
        list.innerHTML = '<p class="empty-note">ยังไม่มีประวัติการสั่ง <a href="floors.html">ไปสั่งอาหารกัน →</a></p>';
        return;
    }

    let html = '';
    for (let i = 0; i < myOrders.length; i++) {
        let order = myOrders[i];

        // รายการอาหาร เช่น "ข้าวผัด × 2, ชาเย็น × 1"
        let foods = [];
        for (let j = 0; j < order.items.length; j++) {
            let item = order.items[j];
            foods.push(itemTitle(item) + ' × ' + item.quantity);   // itemTitle = ชื่อ + ตัวเลือก (main.js)
        }

        html += '<article class="history-item">';
        html += '  <div class="history-top">';
        html += '    <span class="history-date">' + dateText(order.createdAt) + ' · ' + timeText(order.createdAt) + '</span>';
        html += '    <span class="status s-' + order.status + '">' + STATUS_TEXT[order.status] + '</span>';
        html += '  </div>';
        html += '  <p class="history-store"><b>' + esc(order.store) + '</b> · ชั้น ' + esc(order.floor) + ' · คิว ' + esc(order.queue) + '</p>';
        html += '  <p class="history-foods">' + foods.join(', ') + '</p>';
        html += '  <p class="history-total"><b>' + order.total + ' บาท</b></p>';
        html += '</article>';
    }
    list.innerHTML = html;
}


/* ---------- ไม่มารับอาหาร (ใช้ฟังก์ชันจาก noshow.js) ---------- */
function showNoShow() {
    let box = document.getElementById('noshow-info');
    let count = noShowCount(user.student);
    let until = bannedUntil(user.student);

    if (until > 0) {
        // โดนพักอยู่
        box.className = 'noshow-note banned';
        box.textContent = '⛔ ถูกพักการสั่งถึง ' + dateText(until) + ' เพราะไม่มารับอาหาร ' + count + ' ครั้ง';
        box.hidden = false;
    } else if (count > 0) {
        // เคยไม่มารับ แต่ยังไม่ครบ
        box.className = 'noshow-note';
        box.textContent = '⚠ ไม่มารับอาหาร ' + count + ' ครั้งใน ' + NO_SHOW_DAYS + ' วันที่ผ่านมา ' +
            '(ครบ ' + MAX_NO_SHOW + ' ครั้งจะถูกพักการสั่ง ' + BAN_DAYS + ' วัน)';
        box.hidden = false;
    } else {
        box.hidden = true;
    }
}


/* ---------- แปลงเวลาเป็นวันที่ภาษาไทย เช่น "11 พ.ย. 2569" ---------- */
function dateText(ts) {
    return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}
