/* ==========================================================
   cart.js — หน้าตะกร้า (cart.html)
   แสดงของในตะกร้า + กดยืนยันสั่ง
   ต้องโหลดหลัง main.js และ noshow.js (เช็กว่าลูกค้าโดนพักการสั่งไหม)

   สารบัญ
   1. เริ่มต้นหน้า
   2. หาเมนูจริงของของในตะกร้า
   3. แสดงตะกร้า
   4. เพิ่ม / ลด / ลบ
   5. ยืนยันสั่ง
========================================================== */

let user = getCurrentUser();   // { name, student } หรือ null ถ้ายังไม่ล็อกอิน
let cart = loadCart();         // ของในตะกร้า (main.js)


/* ----------------------------------------------------------
   1. เริ่มต้นหน้า
---------------------------------------------------------- */
if (user === null) {
    location.replace('index.html');   // ยังไม่ล็อกอิน -> กลับหน้าเข้าสู่ระบบ
} else {
    updateCartBadge();
    showCart();
}


/* ----------------------------------------------------------
   2. หาเมนูจริงของของในตะกร้า
   (ตะกร้าเก็บไว้ในเครื่อง ร้านอาจเปลี่ยนราคา / ปิดเมนูไปแล้ว จึงต้องเช็กกับข้อมูลล่าสุด)
---------------------------------------------------------- */
function lookupItem(item) {
    let store = item.storeId ? findStore(item.storeId) : findStoreByName(item.store);
    if (!store) return { store: null, menu: null };

    let menu = null;
    for (let i = 0; i < store.menus.length; i++) {
        if (store.menus[i].id === item.menuId) menu = store.menus[i];
    }
    return { store: store, menu: menu };
}

// ของชิ้นนี้สั่งได้ไหม คืนค่า: '' = ได้ / ข้อความ = เหตุผลที่สั่งไม่ได้
function itemProblem(found, price) {
    if (!found.store || !found.menu) return 'ไม่มีเมนูนี้แล้ว';
    if (!getStoreConfigs()[found.store.id].open) return 'ร้านปิดอยู่';
    if (found.menu.available === false) return 'เมนูนี้หมดแล้ว';
    if (price === null) return 'ตัวเลือกที่เลือกไว้หมดหรือถูกเปลี่ยน';
    return '';
}


/* ----------------------------------------------------------
   3. แสดงตะกร้า
---------------------------------------------------------- */
function showCart() {
    let html = '';
    let total = 0;
    let problem = false;   // มีของที่สั่งไม่ได้ไหม

    for (let i = 0; i < cart.length; i++) {
        let item = cart[i];
        let found = lookupItem(item);

        // คิดราคาใหม่จากเมนูจริง (ราคาเมนู + ตัวเลือก) กันราคาในตะกร้าไม่ตรง (main.js)
        let price = found.menu ? priceWithOptions(found.menu, item.options) : null;
        if (price !== null) item.price = price;
        if (found.menu) item.name = found.menu.name;

        let warn = itemProblem(found, price);
        if (warn !== '') problem = true;

        let image = found.menu ? found.menu.image : '';

        html += '<div class="box' + (warn ? ' is-soldout' : '') + '">';
        if (image) html += '<img src="' + esc(image) + '" alt="ภาพตัวอย่างอาหาร">';
        html += '<h3>' + esc(item.name) + '</h3>';
        if (optionNames(item)) html += '<p class="option-line">' + esc(optionNames(item)) + '</p>';
        if (warn) html += '<p class="closed-note">' + warn + ' กรุณาลบออก</p>';
        html += '<p>' + esc(item.store) + ' ชั้น ' + esc(item.floor) + '</p>';
        if (item.note) html += '<p class="note-box">หมายเหตุ: ' + esc(item.note) + '</p>';
        html += '<p>' + item.price + ' บาท / จาน</p>';
        html += ifOutRowHtml(item, i);   // ถ้าของหมด จะให้ทำยังไง (if-out.js)

        // ปุ่ม − จำนวน + และลบ
        html += '<div class="qty">';
        html += '<button onclick="changeQuantity(' + i + ', -1)" aria-label="ลดจำนวน">−</button>';
        html += '<span>' + item.quantity + '</span>';
        html += '<button onclick="changeQuantity(' + i + ', 1)" aria-label="เพิ่มจำนวน">+</button>';
        html += '<button class="remove" onclick="changeQuantity(' + i + ', ' + (-item.quantity) + ')">ลบ</button>';
        html += '</div>';
        html += '</div>';

        total = total + item.price * item.quantity;
    }
    saveCart(cart);   // เก็บราคาที่คิดใหม่

    if (cart.length === 0) html = 'ตะกร้าว่าง';
    document.getElementById('cart-list').innerHTML = html;
    document.getElementById('total').textContent = total;

    // สั่งไม่ได้ถ้า: โดนพักเพราะไม่มารับ / ค้างรับเยอะเกิน (noshow.js)
    let blocked = orderBlockReason(user.student);
    if (blocked !== '') {
        document.getElementById('block-note').textContent = blocked;
        document.getElementById('block-note').hidden = false;
    }

    document.getElementById('order-button').disabled = cart.length === 0 || problem || blocked !== '';
}


/* ----------------------------------------------------------
   4. เพิ่ม / ลด / ลบ (amount = +1, -1 หรือ -จำนวนทั้งหมด เพื่อลบ)
---------------------------------------------------------- */
function changeQuantity(index, amount) {
    cart[index].quantity = cart[index].quantity + amount;
    if (cart[index].quantity <= 0) cart.splice(index, 1);   // เหลือ 0 -> เอาออกจากตะกร้า
    saveCart(cart);
    location.reload();
}


/* ----------------------------------------------------------
   5. ยืนยันสั่ง
   ตะกร้ามีหลายร้านได้ -> แยกเป็น 1 ออเดอร์ต่อ 1 ร้าน แต่ละร้านออกเลขคิวของตัวเอง
---------------------------------------------------------- */
function placeOrder() {
    if (cart.length === 0) return;
    let button = document.getElementById('order-button');
    if (button.disabled) return;   // กันกดซ้ำ
    button.disabled = true;

    // ตรวจอีกครั้งตอนกดสั่ง เผื่อสถานะเปลี่ยนระหว่างเปิดหน้าไว้
    let blocked = orderBlockReason(user.student);
    if (blocked !== '') { alert(blocked); location.reload(); return; }

    // 1) จัดกลุ่มของในตะกร้าตามร้าน: { รหัสร้าน: { store, items } }
    let groups = {};
    for (let i = 0; i < cart.length; i++) {
        let item = cart[i];
        let found = lookupItem(item);
        let price = found.menu ? priceWithOptions(found.menu, item.options) : null;   // ราคาจริง ณ ตอนกดสั่ง

        let warn = itemProblem(found, price);
        if (warn !== '') { alert(item.name + ': ' + warn); location.reload(); return; }

        let storeId = found.store.id;
        if (!groups[storeId]) groups[storeId] = { store: found.store, items: [] };
        groups[storeId].items.push({
            menuId: found.menu.id,
            name: found.menu.name,
            price: price,
            options: item.options || [],
            image: /^data:/.test(found.menu.image || '') ? '' : (found.menu.image || ''),
            store: found.store.name,
            floor: found.store.floorId,
            note: item.note,
            ifOut: item.ifOut === 'swap' ? 'swap' : 'remove',   // ถ้าของหมด: เปลี่ยน / ไม่เอาจานนี้ (if-out.js)
            backups: item.ifOut === 'swap' ? (item.backups || []) : [],   // ของแทนที่เลือกไว้
            quantity: item.quantity
        });
    }

    // 2) สร้างออเดอร์ร้านละ 1 ใบ
    let orders = loadOrders();
    let queues = [];
    for (let storeId in groups) {
        let group = groups[storeId];

        let total = 0;
        for (let i = 0; i < group.items.length; i++) {
            total = total + group.items[i].price * group.items[i].quantity;
        }

        let order = {
            id: makeId(),
            queue: nextQueue(group.store.id),   // เลขคิว เช่น A005 (main.js)
            storeId: group.store.id,
            store: group.store.name,
            floor: group.store.floorId,
            student: user.student,
            name: user.name,
            items: group.items,
            total: total,
            status: 'new',   // จ่ายเงินสดตอนรับอาหาร จึงไม่ต้องเก็บข้อมูลการชำระ
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        orders.push(order);
        queues.push(order.queue + ' (' + group.store.name + ')');
    }

    // 3) บันทึก ล้างตะกร้า แล้วไปหน้าคิว
    saveOrders(orders);
    saveCart([]);
    sessionStorage.setItem('food_placed', queues.join(', '));   // หน้าคิวจะเด้งข้อความ "สั่งสำเร็จ"
    cloudGo('queue.html');   // รอบันทึกขึ้น Firebase ก่อนเปลี่ยนหน้า (cloud.js)
}
