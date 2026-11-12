/* ==========================================================
   menu.js — หน้าเมนูของร้าน (menu.html?store=1)
   แสดงเมนู + ปุ่มเพิ่มลงตะกร้า
   ต้องโหลดหลัง main.js และ menu-options.js (หน้าต่างเลือกตัวเลือก เช่น หมู/ไก่)

   สารบัญ
   1. เริ่มต้นหน้า
   2. แสดงเมนู
   3. กดเพิ่มลงตะกร้า
========================================================== */

let user = getCurrentUser();   // { name, student } หรือ null ถ้ายังไม่ล็อกอิน
let selectedStore = null;      // ร้านที่กำลังดู
let selectedFloor = null;      // ชั้นของร้านนั้น


/* ----------------------------------------------------------
   1. เริ่มต้นหน้า
---------------------------------------------------------- */
if (user === null) {
    location.replace('index.html');   // ยังไม่ล็อกอิน -> กลับหน้าเข้าสู่ระบบ
} else {
    updateCartBadge();   // ตัวเลขตะกร้ามุมขวาบน (main.js)
    findSelectedStore();
    showMenus();
}

// อ่านรหัสร้านจากลิงก์ เช่น menu.html?store=1 แล้วหาร้านกับชั้นของร้านนั้น
function findSelectedStore() {
    let storeId = Number(new URLSearchParams(location.search).get('store'));
    for (let i = 0; i < foodData.length; i++) {
        for (let j = 0; j < foodData[i].stores.length; j++) {
            if (foodData[i].stores[j].id === storeId) {
                selectedStore = foodData[i].stores[j];
                selectedFloor = foodData[i];
            }
        }
    }
}


/* ----------------------------------------------------------
   2. แสดงเมนู
---------------------------------------------------------- */
function showMenus() {
    let list = document.getElementById('menu-list');

    if (selectedStore === null) {
        list.innerHTML = '<p class="empty-note">ไม่พบร้านอาหาร</p>';
        return;
    }
    if (selectedStore.menus.length === 0) {
        list.innerHTML = '<p class="empty-note">ร้านนี้ยังไม่มีเมนู</p>';
        return;
    }

    let open = getStoreConfigs()[selectedStore.id].open;
    document.getElementById('store-name').textContent = selectedStore.name;
    document.getElementById('back-link').href = 'stores.html?floor=' + selectedFloor.id;
    if (!open) {
        document.getElementById('store-name').insertAdjacentHTML('afterend',
            '<p class="closed-note">ร้านปิดรับออเดอร์ชั่วคราว ดูเมนูได้แต่ยังสั่งไม่ได้</p>');
    }

    let html = '';
    for (let i = 0; i < selectedStore.menus.length; i++) {
        html += menuCardHtml(selectedStore.menus[i], i, open);
    }
    list.innerHTML = html;
}

// การ์ดเมนู 1 ใบ (index = ลำดับเมนูในร้าน ใช้ตอนกดเพิ่มลงตะกร้า)
function menuCardHtml(menu, index, open) {
    // สั่งได้เมื่อ: ร้านเปิด + เมนูไม่หมด + ตัวเลือกที่ต้องเลือกยังเหลือ (main.js)
    let canOrder = open && menu.available !== false && !requiredOptionsSoldOut(menu);
    let disabled = canOrder ? '' : ' disabled';

    let html = '<form class="box' + (menu.available === false ? ' is-soldout' : '') + '" onsubmit="addToCart(event, this, ' + index + ')">';
    if (menu.image) html += '<img src="' + esc(menu.image) + '" alt="ภาพตัวอย่างอาหาร">';

    html += '<h3>' + esc(menu.name) + '</h3>';
    html += '<p>' + menu.price + ' บาท';
    // หมดทั้งเมนู หรือตัวเลือกที่ต้องเลือกหมดทุกอย่าง (เช่น เนื้อสัตว์หมดหมด) -> ป้าย "หมดแล้ว"
    if (menu.available === false || requiredOptionsSoldOut(menu)) html += ' <span class="pill pill-closed">หมดแล้ว</span>';
    html += '</p>';

    if (hasOptions(menu)) {
        // เมนูมีตัวเลือก -> กดแล้วเปิดหน้าต่างเลือก (ช่องหมายเหตุอยู่ในหน้าต่างนั้น)
        html += '<p class="option-hint">มีตัวเลือก เช่น ' + esc(menu.options[0].title) + '</p>';
        html += '<p><button type="submit"' + disabled + '>' + (canOrder ? 'เลือกตัวเลือก' : 'สั่งไม่ได้ตอนนี้') + '</button></p>';
    } else {
        html += '<label>หมายเหตุ</label>';
        html += '<textarea name="note" maxlength="200" placeholder="เช่น ไม่ใส่ผัก"' + disabled + '></textarea>';
        html += '<p><button type="submit"' + disabled + '>' + (canOrder ? 'เพิ่มลงตะกร้า' : 'สั่งไม่ได้ตอนนี้') + '</button></p>';
    }

    html += '</form>';
    return html;
}


/* ----------------------------------------------------------
   3. กดเพิ่มลงตะกร้า
---------------------------------------------------------- */
function addToCart(event, form, index) {
    event.preventDefault();   // ไม่ให้ฟอร์มรีโหลดหน้า
    let menu = selectedStore.menus[index];

    // ตรวจอีกครั้ง เผื่อร้านปิดหรือเมนูหมดระหว่างเปิดหน้าไว้
    if (!getStoreConfigs()[selectedStore.id].open || menu.available === false) {
        alert('ขออภัย ตอนนี้สั่งเมนูนี้ไม่ได้');
        location.reload();
        return;
    }

    // เมนูมีตัวเลือก (หมู/ไก่ ฯลฯ) -> เปิดหน้าต่างให้เลือกก่อน (menu-options.js)
    if (hasOptions(menu)) {
        openOptions(menu);
        return;
    }

    putInCart(menu, form.elements.note.value.trim(), [], menu.price);
    form.reset();
}

// ใส่เมนูลงตะกร้า (ใช้ทั้งเมนูธรรมดา และเมนูที่เลือกตัวเลือกจาก menu-options.js)
// options = ตัวเลือกที่เลือก เช่น [{ group: 'เลือกเนื้อสัตว์', name: 'หมูกรอบ', price: 10 }]
// price   = ราคาต่อจานรวมตัวเลือกแล้ว
function putInCart(menu, note, options, price) {
    let cart = loadCart();
    cart.push({
        menuId: menu.id,
        storeId: selectedStore.id,
        name: menu.name,
        price: price,
        options: options,
        image: /^data:/.test(menu.image || '') ? '' : menu.image,   // รูปที่อัปโหลดเองไม่เก็บซ้ำ (ไฟล์ใหญ่)
        store: selectedStore.name,
        floor: selectedFloor.id,
        note: note,
        quantity: 1
    });
    saveCart(cart);

    updateCartBadge();
    showToast('เพิ่ม <b>' + itemTitle({ name: menu.name, options: options }) + '</b> ลงตะกร้าแล้ว · <a href="cart.html">ดูตะกร้า</a>', 'ok');
}
