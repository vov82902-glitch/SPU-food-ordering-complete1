let user = JSON.parse(localStorage.getItem('food_user'));
let cart = JSON.parse(localStorage.getItem('food_cart')) || [];

// หาเมนูปัจจุบันของสินค้าในตะกร้า (ร้านอาจเปลี่ยนราคา/ปิดเมนู)
function lookupItem(item) {
    let store = item.storeId ? findStore(item.storeId) : findStoreByName(item.store);
    if (!store) return { store: null, menu: null };
    let menu = store.menus.find(function (m) { return m.id === item.menuId; }) ||
               store.menus.find(function (m) { return m.name === item.name; }) || null;
    return { store: store, menu: menu };
}

if (user === null) {
    location.replace('index.html');
} else {
    let configs = getStoreConfigs();
    let count = 0;
    for (let i = 0; i < cart.length; i++) {
        count = count + cart[i].quantity;
    }
    document.getElementById('cart-count').textContent = count;
    let html = '';
    let total = 0;
    let problem = false;
    for (let i = 0; i < cart.length; i++) {
        let item = cart[i];
        let found = lookupItem(item);
        if (found.store) { item.storeId = found.store.id; item.store = found.store.name; }
        if (found.menu) { item.name = found.menu.name; }
        if (item.image && /^data:/.test(item.image)) delete item.image; // ไม่เก็บรูปซ้ำในตะกร้า
        let image = found.menu ? found.menu.image : item.image;
        if (found.menu) { item.menuId = found.menu.id; item.price = found.menu.price; }
        let warn = '';
        if (!found.store || !found.menu) warn = 'ไม่มีเมนูนี้แล้ว';
        else if (!configs[found.store.id].open) warn = 'ร้านปิดอยู่';
        else if (found.menu.available === false) warn = 'เมนูนี้หมดแล้ว';
        if (warn) problem = true;

        html += '<div class="box' + (warn ? ' is-soldout' : '') + '">';
        if (image) {
            html += '<img src="' + esc(image) + '" alt="ภาพตัวอย่างอาหาร">';
        }
        html += '<h3>' + esc(item.name) + '</h3>';
        if (warn) html += '<p class="closed-note">' + warn + ' กรุณาลบออก</p>';
        html += '<p>' + esc(item.store) + ' ชั้น ' + esc(item.floor) + '</p>';
        if (item.note) html += '<p class="note-box">หมายเหตุ: ' + esc(item.note) + '</p>';
        html += '<p>' + item.price + ' บาท / จาน</p>';
        html += '<div class="qty">';
        html += '<button onclick="changeQuantity(' + i + ', -1)" aria-label="ลดจำนวน">−</button>';
        html += '<span>' + item.quantity + '</span>';
        html += '<button onclick="changeQuantity(' + i + ', 1)" aria-label="เพิ่มจำนวน">+</button>';
        html += '<button class="remove" onclick="changeQuantity(' + i + ', ' + (-item.quantity) + ')">ลบ</button>';
        html += '</div>';
        html += '</div>';
        total += item.price * item.quantity;
    }
    localStorage.setItem('food_cart', JSON.stringify(cart));
    if (cart.length === 0) html = 'ตะกร้าว่าง';
    document.getElementById('cart-list').innerHTML = html;
    document.getElementById('total').textContent = total;
    document.getElementById('order-button').disabled = cart.length === 0 || problem;
    if (cart.length > 0) setupPayment();
}

// ร้านในตะกร้า (ไม่ซ้ำ) พร้อมวิธีชำระที่แต่ละร้านรองรับ
function cartStores() {
    let configs = getStoreConfigs();
    let seen = {};
    let list = [];
    for (let item of cart) {
        let s = lookupItem(item).store;
        if (!s || seen[s.id]) continue;
        seen[s.id] = true;
        list.push({ store: s, opts: storePayOptions(configs[s.id]) });
    }
    return list;
}

function chosenPay() {
    let r = document.querySelector('input[name="pay"]:checked');
    return r ? r.value : 'cash';
}

// วิธีชำระที่ใช้จริงของแต่ละร้าน: ถ้าร้านไม่รองรับวิธีที่เลือก ใช้วิธีที่ร้านมี
function methodForStore(opts, chosen) {
    if (opts[chosen]) return chosen;
    return opts.cash ? 'cash' : 'qr';
}

function setupPayment() {
    let stores = cartStores();
    let anyQr = stores.some(function (s) { return s.opts.qr; });
    let anyCash = stores.some(function (s) { return s.opts.cash; });
    let radios = document.querySelectorAll('input[name="pay"]');
    radios.forEach(function (r) {
        let ok = r.value === 'qr' ? anyQr : anyCash;
        r.disabled = !ok;
        r.closest('.pay-option').classList.toggle('is-off', !ok);
        r.onchange = updatePayNote;
    });
    if (!anyCash && anyQr) document.querySelector('input[value="qr"]').checked = true;
    if (!anyQr) document.getElementById('qr-hint').textContent = 'ร้านในตะกร้ายังไม่เปิดรับ QR';
    document.getElementById('pay-section').hidden = false;
    updatePayNote();
}

function updatePayNote() {
    let chosen = chosenPay();
    let stores = cartStores();
    let other = stores.filter(function (s) { return methodForStore(s.opts, chosen) !== chosen; });
    let note = document.getElementById('pay-note');
    if (other.length) {
        note.hidden = false;
        note.textContent = other.map(function (s) { return s.store.name; }).join(', ') +
            (chosen === 'qr' ? ' ยังไม่รับ QR จะชำระเป็นเงินสดที่ร้าน' : ' รับเฉพาะ QR จะชำระด้วย QR');
    } else {
        note.hidden = true;
    }
    document.getElementById('pay-summary').textContent =
        chosen === 'qr' ? 'ชำระผ่าน QR หลังยืนยันสั่ง' : 'ชำระเงินสดที่ร้านตอนรับอาหาร';
}

function changeQuantity(index, amount) {
    cart[index].quantity += amount;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    localStorage.setItem('food_cart', JSON.stringify(cart));
    location.reload();
}

// ยืนยันสั่ง: แยกตะกร้าเป็นออเดอร์ละร้าน แต่ละร้านออกเลขคิวของตัวเอง
function placeOrder() {
    if (cart.length === 0) return;
    let button = document.getElementById('order-button');
    if (button.disabled) return;       // กันกดซ้ำ
    button.disabled = true;
    let configs = getStoreConfigs();
    let groups = {};
    for (let item of cart) {
        let found = lookupItem(item);
        if (!found.store || !found.menu) { alert('ไม่พบเมนู ' + item.name + ' แล้ว'); location.reload(); return; }
        if (!configs[found.store.id].open) { alert('ร้าน ' + found.store.name + ' ปิดอยู่ตอนนี้'); location.reload(); return; }
        if (found.menu.available === false) { alert(item.name + ' หมดแล้ว'); location.reload(); return; }
        let sid = found.store.id;
        if (!groups[sid]) groups[sid] = { store: found.store, items: [] };
        groups[sid].items.push({
            menuId: found.menu.id, name: found.menu.name, price: found.menu.price,
            image: /^data:/.test(found.menu.image || '') ? '' : (found.menu.image || ''), store: found.store.name, floor: found.store.floorId,
            note: item.note, quantity: item.quantity
        });
    }
    let orders = loadOrders();
    let queues = [];
    let chosen = chosenPay();
    let anyQr = false;
    for (let sid in groups) {
        let g = groups[sid];
        let total = 0;
        for (let it of g.items) total += it.price * it.quantity;
        let method = methodForStore(storePayOptions(configs[sid]), chosen);
        if (method === 'qr') anyQr = true;
        let order = {
            id: makeId(),
            queue: nextQueue(g.store.id),
            storeId: g.store.id,
            store: g.store.name,
            floor: g.store.floorId,
            student: user.student,
            name: user.name,
            items: g.items,
            total: total,
            status: 'new',
            payment: { method: method, status: 'unpaid' },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        orders.push(order);
        queues.push(order.queue + ' (' + g.store.name + ')');
    }
    saveOrders(orders);
    localStorage.removeItem('food_cart');
    // แจ้งผลในหน้าคิวแทนกล่องข้อความ
    sessionStorage.setItem('food_placed', queues.join(', '));
    cloudGo(anyQr ? 'queue.html?pay=1' : 'queue.html');   // รอบันทึกขึ้น Firebase ก่อนเปลี่ยนหน้า
}
