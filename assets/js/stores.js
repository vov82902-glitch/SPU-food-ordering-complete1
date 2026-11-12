/* ==========================================================
   stores.js — หน้าเลือกร้าน (stores.html?floor=1)
   แสดงร้านทั้งหมดของชั้นที่เลือก พร้อมป้ายเปิด/ปิด
   ต้องโหลดหลัง main.js
========================================================== */

let user = getCurrentUser();   // { name, student } หรือ null ถ้ายังไม่ล็อกอิน

if (user === null) {
    location.replace('index.html');   // ยังไม่ล็อกอิน -> กลับหน้าเข้าสู่ระบบ
} else {
    updateCartBadge();   // ตัวเลขตะกร้ามุมขวาบน (main.js)
    showStores();
}


/* ---------- แสดงร้านของชั้นที่เลือก ---------- */
function showStores() {
    // อ่านเลขชั้นจากลิงก์ เช่น stores.html?floor=1 -> 1
    let floorId = Number(new URLSearchParams(location.search).get('floor'));
    let configs = getStoreConfigs();   // สถานะเปิด/ปิดของแต่ละร้าน
    let html = '';

    for (let i = 0; i < foodData.length; i++) {
        let floor = foodData[i];
        if (floor.id !== floorId) continue;

        document.getElementById('floor-name').textContent = floor.name;

        for (let j = 0; j < floor.stores.length; j++) {
            let store = floor.stores[j];
            let open = configs[store.id].open;

            html += '<div class="box' + (open ? '' : ' is-closed') + '">';

            // รูปร้าน (ไม่มีรูป -> ใช้ตัวอักษรแรกของชื่อร้านแทน)
            if (store.image) {
                html += '<img src="' + esc(store.image) + '" alt="ภาพร้าน ' + esc(store.name) + '">';
            } else {
                let letter = store.name.replace(/^ร้าน/, '').charAt(0) || 'S';
                html += '<div class="img-placeholder">' + esc(letter) + '</div>';
            }

            html += '<h3>' + esc(store.name) + '</h3>';
            if (open) {
                html += '<span class="pill pill-open">เปิดอยู่</span> ';
            } else {
                html += '<span class="pill pill-closed">ร้านปิด</span> ';
            }
            html += '<a href="menu.html?store=' + store.id + '">ดูเมนู</a>';
            html += '</div>';
        }
    }

    if (html === '') html = 'ไม่พบร้านอาหาร';
    document.getElementById('store-list').innerHTML = html;
}
