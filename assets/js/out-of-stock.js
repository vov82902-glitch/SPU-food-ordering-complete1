/* ==========================================================
   out-of-stock.js — ของหมด: ทำตามที่ลูกค้าบอกไว้ตอนสั่ง
   ใช้ในหน้าร้าน (admin.html) · ต้องโหลดหลัง main.js

   ลำดับเหตุการณ์:
   1) ตอนสั่ง ลูกค้าบอกไว้ว่า "ถ้าของหมด จะให้ทำยังไง"   (if-out.js)
        - เปลี่ยนเป็นอย่างอื่น -> เลือกของแทนไว้เลย เช่น ทะเล -> ไก่
        - ไม่เอาจานนี้        -> ตัดจานออก
   2) ร้านกด "ของหมด" แล้วติ๊ก เช่น "ทะเล"                 (admin-stock.js)
   3) ทุกออเดอร์ที่สั่งทะเลไว้ -> ทำตามข้อ 1 ทันที         (ไฟล์นี้)

   ข้อมูลในรายการอาหาร (item) ที่ไฟล์นี้อ่าน / เขียน:
   - ifOut      : 'swap' (เปลี่ยนเป็นอย่างอื่น) | 'remove' (ไม่เอาจานนี้)
   - backups    : [ { group, from, to } ]  ของแทนที่เลือกไว้ (ดู findBackup ใน main.js)
   - changeNote : 'ทะเล → ไก่'  = เปลี่ยนแล้ว (ให้ร้านและลูกค้าเห็น)
   และในออเดอร์:
   - removed    : ['ข้าวผัดกะเพรา (ทะเลหมด)']  = จานที่ถูกตัดออก

   สารบัญ
   1. ร้านกดของหมด -> ตรวจทุกออเดอร์
   2. จัดการรายการอาหาร 1 จาน
   3. ตัวช่วย
========================================================== */


/* ----------------------------------------------------------
   1. ร้านกดของหมด -> ตรวจทุกออเดอร์ของร้านที่ยังไม่ทำเสร็จ
   คืนค่า: จำนวนออเดอร์ที่ถูกเปลี่ยน
---------------------------------------------------------- */
function applyOutOfStock(storeId) {
    let orders = loadOrders();
    let changedOrders = 0;

    for (let o = 0; o < orders.length; o++) {
        let order = orders[o];
        if (order.storeId !== storeId) continue;
        if (order.status !== 'new' && order.status !== 'cooking') continue;

        let changed = false;
        // วนจากท้ายมาหน้า เพราะอาจตัดจานออก (ตัดแล้วลำดับจานที่ยังไม่ตรวจไม่เลื่อน)
        for (let i = order.items.length - 1; i >= 0; i--) {
            if (handleItem(order, i)) changed = true;
        }

        if (changed) {
            finishChange(order);
            changedOrders = changedOrders + 1;
        }
    }

    if (changedOrders > 0) saveOrders(orders);
    return changedOrders;
}


/* ----------------------------------------------------------
   2. จัดการรายการอาหาร 1 จาน
   คืนค่า: true = จานนี้ถูกเปลี่ยน / ถูกตัดออก
---------------------------------------------------------- */
function handleItem(order, index) {
    let item = order.items[index];
    let menu = menuOfItem(order, item);
    if (menu === null) return false;   // ร้านลบเมนูนี้ไปแล้ว -> ไม่ยุ่ง ให้ร้านจัดการเอง

    // หมดทั้งเมนู -> ไม่มีอะไรให้เปลี่ยน ตัดออกเลย
    if (menu.available === false) {
        removeItem(order, index, 'ของหมด');
        return true;
    }

    let notes = [];   // จดว่าเปลี่ยนอะไรไปบ้าง เช่น 'ทะเล → ไก่'

    for (let j = item.options.length - 1; j >= 0; j--) {
        let option = item.options[j];
        if (!isChoiceOut(menu, option.group, option.name)) continue;   // อันนี้ยังมี

        // ลูกค้าบอกไว้ว่า "ไม่เอาจานนี้" (ออเดอร์เก่าที่ไม่มีค่านี้ ถือว่าแบบเดียวกัน)
        if (item.ifOut !== 'swap') {
            removeItem(order, index, option.name + 'หมด');
            return true;
        }

        // ลูกค้าบอกไว้ว่า "เปลี่ยนเป็นอย่างอื่น"
        let backup = findBackup(item, option);   // main.js
        let group = findGroup(menu, option.group);

        if (canUse(menu, item, backup)) {
            let choice = findChoice(menu, option.group, backup.to);
            item.options[j] = { group: option.group, name: choice.name, price: choice.price };
            notes.push(option.name + ' → ' + choice.name);
        } else if (group !== null && !group.required) {
            // ของไม่บังคับ (เช่น ไข่ดาว): ไม่ใส่ แล้วทำจานต่อ
            item.options.splice(j, 1);
            notes.push(option.name + ' → ไม่ใส่');
        } else {
            // ของที่ต้องเลือก (เช่น เนื้อสัตว์) แต่ของแทนก็หมดด้วย -> ทำจานนี้ไม่ได้
            removeItem(order, index, option.name + 'หมด และของแทนก็หมด');
            return true;
        }
    }

    if (notes.length === 0) return false;   // ไม่มีอะไรในจานนี้หมด

    item.price = priceWithOptions(menu, item.options);   // คิดราคาใหม่ (main.js)
    item.changeNote = (item.changeNote ? item.changeNote + ', ' : '') + notes.join(', ');
    return true;
}

// ของแทนที่ลูกค้าเลือกไว้ ใช้ได้ไหม (ต้องมีจริง ยังไม่หมด และไม่ซ้ำกับที่เลือกไว้แล้ว)
function canUse(menu, item, backup) {
    if (backup === null || backup.to === '') return false;   // ไม่ได้เลือก / เลือก "ไม่ใส่"
    if (isChoiceOut(menu, backup.group, backup.to)) return false;
    return !hasOption(item, backup.group, backup.to);
}


/* ----------------------------------------------------------
   3. ตัวช่วย
---------------------------------------------------------- */

// หาเมนูจริง (ข้อมูลล่าสุดของร้าน) ของรายการอาหารในออเดอร์
function menuOfItem(order, item) {
    let store = findStore(order.storeId);
    if (!store) return null;
    for (let i = 0; i < store.menus.length; i++) {
        if (store.menus[i].id === item.menuId) return store.menus[i];
    }
    return null;
}

// ตัวเลือกนี้หมดหรือยัง (หาไม่เจอ = ถือว่าหมด)
function isChoiceOut(menu, groupTitle, choiceName) {
    let choice = findChoice(menu, groupTitle, choiceName);   // main.js
    return choice === null || choice.available === false;
}

// ตัดจานออกจากออเดอร์ แล้วจดไว้ให้ทั้งร้านและลูกค้าเห็น
function removeItem(order, index, why) {
    let item = order.items[index];
    order.items.splice(index, 1);
    if (!order.removed) order.removed = [];
    order.removed.push(item.name + ' (' + why + ')');
}

// หลังแก้ออเดอร์: คิดยอดรวมใหม่ / ไม่เหลือจานเลย -> ยกเลิกทั้งออเดอร์
function finishChange(order) {
    let total = 0;
    for (let i = 0; i < order.items.length; i++) {
        total = total + order.items[i].price * order.items[i].quantity;
    }
    order.total = total;

    if (order.items.length === 0) {
        order.status = 'cancelled';
        order.cancelledBy = 'store';
        order.cancelReason = 'ของหมด';
        order.cancelledAt = Date.now();
    }
    order.updatedAt = Date.now();
}
