/* ==========================================================
   floors.js — หน้าเลือกชั้น (floors.html)
   ต้องโหลดหลัง main.js
========================================================== */

let user = getCurrentUser();   // { name, student } หรือ null ถ้ายังไม่ล็อกอิน

if (user === null) {
    // ยังไม่ล็อกอิน -> กลับไปหน้าเข้าสู่ระบบ
    location.replace('index.html');
} else {
    showHeader();
    showWelcomeNote();
    showFloorList();
}


/* ---------- ส่วนหัว: ชื่อผู้ใช้ + จำนวนของในตะกร้า ---------- */
function showHeader() {
    updateCartBadge();   // ตัวเลขตะกร้ามุมขวาบน (main.js)

    // "สวัสดี, ..." ชื่อมาจาก food_user ใน localStorage
    document.getElementById('user-name').textContent = user.name;
}


/* ---------- ข้อความต้อนรับ (แสดงครั้งเดียวหลังสมัครสมาชิก) ---------- */
function showWelcomeNote() {
    if (!new URLSearchParams(location.search).get('welcome')) return;

    document.querySelector('.page-head').insertAdjacentHTML('beforebegin',
        '<p class="welcome-note">สมัครสมาชิกเรียบร้อยแล้ว ยินดีต้อนรับ ' + esc(user.name) +
        ' เลือกชั้นเพื่อเริ่มสั่งอาหารได้เลย</p>');

    // ลบ ?welcome=1 ออกจากลิงก์ กดรีเฟรชแล้วจะไม่ขึ้นซ้ำ
    history.replaceState(null, '', 'floors.html');
}


/* ---------- รายการชั้น ---------- */
function showFloorList() {
    let configs = getStoreConfigs();   // ข้อมูลร้าน (เปิด/ปิด ฯลฯ)
    let html = '';

    for (let i = 0; i < foodData.length; i++) {
        let floor = foodData[i];
        let openCount = floor.stores.filter(function (s) { return configs[s.id].open; }).length;
        let names = floor.stores.map(function (s) { return s.name; }).join(' · ');
        let pillClass = openCount > 0 ? 'pill-open' : 'pill-closed';

        html += '<li><a href="stores.html?floor=' + floor.id + '">';
        html += '<span class="floor-num">' + floor.id + '</span>';
        html += '<span class="floor-title">' + esc(floor.name) + '</span>';
        html += '<span class="floor-stores">' + esc(names || 'ยังไม่มีร้าน') + '</span>';
        html += '<span class="floor-go">ดูร้านอาหาร →</span></a>';
        html += '<span class="pill ' + pillClass + '">เปิด ' + openCount + '/' + floor.stores.length + ' ร้าน</span></li>';
    }

    document.getElementById('floor-list').innerHTML = html;
}
