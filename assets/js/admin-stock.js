/* ==========================================================
   admin-stock.js — ปุ่ม "ของหมด" บนการ์ดออเดอร์ (หน้าร้าน)
   ใช้ใน admin.html · ต้องโหลดหลัง out-of-stock.js และก่อน admin.js

   ร้านกด "ของหมด" -> หน้าต่างให้ติ๊กว่าอะไรหมด เช่น
     ☐ ข้าวผัดกะเพรา (หมดทั้งเมนู)
     ☑ หมูกรอบ  · เลือกเนื้อสัตว์
     ☐ ไข่ดาว   · เพิ่มเติม
   กดยืนยัน -> ตั้งของที่ติ๊กเป็น "หมด" ในเมนู
            -> ทุกออเดอร์ที่สั่งของนั้นไว้ ส่งให้ลูกค้าเลือกใหม่ (out-of-stock.js)

   สารบัญ
   1. เปิด / ปิดหน้าต่าง
   2. กดยืนยัน
   3. แจ้งลูกค้า + ตรวจหมดเวลา
========================================================== */


/* ----------------------------------------------------------
   1. เปิด / ปิดหน้าต่าง: ลิสต์เมนูและตัวเลือกในออเดอร์นี้ให้ติ๊ก
   ช่องติ๊กแต่ละอันฝาก data-menu (รหัสเมนู) และ data-group / data-name (ถ้าเป็นตัวเลือก)
---------------------------------------------------------- */
function openStockDialog(order) {
    let html = '';
    let shown = [];   // กันแสดงซ้ำ ถ้าออเดอร์มีเมนูเดียวกัน 2 รายการ

    for (let i = 0; i < order.items.length; i++) {
        let item = order.items[i];

        // ทั้งเมนู
        let menuKey = 'menu-' + item.menuId;
        if (shown.indexOf(menuKey) === -1) {
            shown.push(menuKey);
            html += '<label class="stock-row"><input type="checkbox" data-menu="' + item.menuId + '">' +
                '<span><b>' + esc(item.name) + '</b> <small class="muted">(หมดทั้งเมนู)</small></span></label>';
        }

        // ตัวเลือกที่ลูกค้าเลือกไว้
        let options = item.options || [];
        for (let j = 0; j < options.length; j++) {
            let key = item.menuId + '|' + options[j].group + '|' + options[j].name;
            if (shown.indexOf(key) !== -1) continue;
            shown.push(key);
            html += '<label class="stock-row stock-option"><input type="checkbox" data-menu="' + item.menuId + '"' +
                ' data-group="' + esc(options[j].group) + '" data-name="' + esc(options[j].name) + '">' +
                '<span>' + esc(options[j].name) + ' <small class="muted">· ' + esc(options[j].group) + '</small></span></label>';
        }
    }

    $('stock-title').textContent = 'อะไรหมด? · คิว ' + order.queue;
    $('stock-list').innerHTML = html;
    $('stock-dialog').classList.remove('hidden');
}

function closeStockDialog() {
    $('stock-dialog').classList.add('hidden');
}


/* ----------------------------------------------------------
   2. กดยืนยัน: ตั้งของที่ติ๊กเป็น "หมด" ในข้อมูลเมนู แล้วแจ้งลูกค้า
---------------------------------------------------------- */
function confirmStock() {
    let checked = document.querySelectorAll('#stock-list input:checked');
    if (checked.length === 0) {
        adminToast('กรุณาติ๊กของที่หมดอย่างน้อย 1 อย่าง');
        return;
    }

    let store = storeInData();   // ข้อมูลร้านจริง (admin.js)

    for (let i = 0; i < checked.length; i++) {
        let box = checked[i];
        let menu = null;
        for (let m = 0; m < store.menus.length; m++) {
            if (store.menus[m].id === Number(box.dataset.menu)) menu = store.menus[m];
        }
        if (menu === null) continue;

        if (box.dataset.group) {
            // ตัวเลือกหมด เช่น หมูกรอบ
            let choice = findChoice(menu, box.dataset.group, box.dataset.name);   // main.js
            if (choice) choice.available = false;
        } else {
            // ทั้งเมนูหมด
            menu.available = false;
        }
    }

    if (!trySaveFoodData()) return;   // admin.js
    adminStore = findStore(adminStore.id);
    closeStockDialog();
    notifyOutOfStock();
}


/* ----------------------------------------------------------
   3. แจ้งลูกค้า + ตรวจหมดเวลา
---------------------------------------------------------- */

// ตรวจทุกออเดอร์ของร้าน -> ใครสั่งของที่หมดไว้ ส่งให้เลือกใหม่ (out-of-stock.js)
function notifyOutOfStock() {
    let count = applyOutOfStock(adminStore.id);
    if (count > 0) {
        adminToast('ตั้งเป็นหมดแล้ว · แจ้งลูกค้า ' + count + ' ออเดอร์ให้เลือกของแทน');
    }
    renderAll();
}

// ทุก 15 วินาที: ลูกค้าคนไหนไม่เลือกภายใน 3 นาที -> ระบบตัดสินใจให้
setInterval(function () {
    if (!adminStore) return;
    expirePendingChoices(function (order) { return order.storeId === adminStore.id; });
}, 15000);


/* ---------- ผูกปุ่มในหน้าต่าง ---------- */
document.getElementById('stock-cancel').addEventListener('click', closeStockDialog);
document.getElementById('stock-confirm').addEventListener('click', confirmStock);
document.getElementById('stock-dialog').addEventListener('click', function (event) {
    if (event.target === this) closeStockDialog();
});
