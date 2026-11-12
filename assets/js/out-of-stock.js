/* ==========================================================
   out-of-stock.js — ของหมด: ให้ลูกค้าเลือกของแทนเอง
   ใช้ทั้งหน้าร้าน (admin.html) และหน้าคิว (queue.html) · ต้องโหลดหลัง main.js

   ลำดับเหตุการณ์:
   1) ร้านกด "ของหมด" แล้วติ๊ก เช่น "หมูกรอบ"           (admin-stock.js)
   2) ระบบตั้ง "หมูกรอบ" เป็นหมด -> ลูกค้าใหม่เลือกไม่ได้
   3) ทุกออเดอร์ที่สั่งหมูกรอบไว้ -> ติดป้าย "รอลูกค้าเลือกใหม่"  (ไฟล์นี้: applyOutOfStock)
   4) ลูกค้าเห็นของที่ยังมี แล้วเลือกเอง หรือกด "ไม่เอาเมนูนี้"    (queue-choice.js)
   5) ไม่เลือกภายใน 3 นาที -> ระบบตัดสินใจให้                    (ไฟล์นี้: expirePendingChoices)

   ข้อมูลที่เพิ่มในรายการอาหาร (item) ของออเดอร์:
   - pendingChoice : { group: 'เลือกเนื้อสัตว์', name: 'หมูกรอบ', askedAt: เวลา }  = กำลังรอลูกค้าเลือกใหม่
   - changeNote    : 'หมูกรอบ → ไก่'  = ลูกค้าเปลี่ยนแล้ว (ให้ร้านเห็น)
   และในออเดอร์:
   - removed       : ['ข้าวผัดกะเพรา (ของหมด)']  = รายการที่ถูกตัดออก

   สารบัญ
   1. ตั้งค่า
   2. ตัวช่วยหาเมนู / ตัวเลือก
   3. ของแทนที่ลูกค้าเลือกได้
   4. ร้านกดของหมด -> ตรวจทุกออเดอร์
   5. ลูกค้าเลือกของแทน / ไม่เอาเมนูนี้
   6. หมดเวลาเลือก
========================================================== */


/* ----------------------------------------------------------
   1. ตั้งค่า
---------------------------------------------------------- */
const CHOOSE_MINUTES = 3;   // ลูกค้ามีเวลาเลือกของแทนกี่นาที


/* ----------------------------------------------------------
   2. ตัวช่วยหาเมนู / ตัวเลือก
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

// หากลุ่มตัวเลือกจากชื่อกลุ่ม เช่น 'เลือกเนื้อสัตว์'
function findGroup(menu, groupTitle) {
    let groups = menu.options || [];
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].title === groupTitle) return groups[i];
    }
    return null;
}

// ตัวเลือกนี้หมดหรือยัง (หาไม่เจอ = ถือว่าหมด)
function isChoiceOut(menu, groupTitle, choiceName) {
    let choice = findChoice(menu, groupTitle, choiceName);   // findChoice อยู่ใน main.js
    return choice === null || choice.available === false;
}

// ราคาของตัวเลือกที่หมด (ใช้บอกลูกค้าว่าของแทนแพงขึ้นหรือถูกลงเท่าไหร่)
function pendingPrice(item) {
    let options = item.options || [];
    for (let i = 0; i < options.length; i++) {
        if (options[i].group === item.pendingChoice.group && options[i].name === item.pendingChoice.name) {
            return options[i].price;
        }
    }
    return 0;
}

// คิดยอดรวมของออเดอร์ใหม่
function recalcTotal(order) {
    let total = 0;
    for (let i = 0; i < order.items.length; i++) {
        total = total + order.items[i].price * order.items[i].quantity;
    }
    order.total = total;
}


/* ----------------------------------------------------------
   3. ของแทนที่ลูกค้าเลือกได้
   = ตัวเลือกในกลุ่มเดียวกัน ที่ยังไม่หมด และลูกค้ายังไม่ได้เลือกไว้
---------------------------------------------------------- */
function alternativesFor(menu, item) {
    let group = findGroup(menu, item.pendingChoice.group);
    if (group === null) return [];

    let list = [];
    for (let i = 0; i < group.choices.length; i++) {
        let choice = group.choices[i];
        if (choice.available === false) continue;          // หมดเหมือนกัน
        if (hasOption(item, group.title, choice.name)) continue;   // เลือกไว้แล้ว (กลุ่มที่เลือกได้หลายอย่าง)
        list.push(choice);
    }
    return list;
}

// ออเดอร์นี้มีรายการที่ยังรอลูกค้าเลือกของแทนไหม (ร้านกด "ทำเสร็จ" ไม่ได้จนกว่าจะเลือกเสร็จ)
function hasPendingChoice(order) {
    for (let i = 0; i < order.items.length; i++) {
        if (order.items[i].pendingChoice) return true;
    }
    return false;
}

// รายการนี้เลือกตัวเลือกนี้ไว้หรือยัง
function hasOption(item, groupTitle, choiceName) {
    let options = item.options || [];
    for (let i = 0; i < options.length; i++) {
        if (options[i].group === groupTitle && options[i].name === choiceName) return true;
    }
    return false;
}


/* ----------------------------------------------------------
   4. ร้านกดของหมด -> ตรวจทุกออเดอร์ของร้านที่ยังไม่ทำเสร็จ
   คืนค่า: จำนวนออเดอร์ที่ได้รับผลกระทบ
---------------------------------------------------------- */
function applyOutOfStock(storeId) {
    let orders = loadOrders();
    let affected = 0;

    for (let o = 0; o < orders.length; o++) {
        let order = orders[o];
        if (order.storeId !== storeId) continue;
        if (order.status !== 'new' && order.status !== 'cooking') continue;

        let touched = false;

        // วนจากท้ายมาหน้า เพราะอาจลบรายการออก (ลบแล้วลำดับไม่เลื่อน)
        for (let i = order.items.length - 1; i >= 0; i--) {
            let item = order.items[i];
            let menu = menuOfItem(order, item);

            if (menu === null) continue;   // ร้านลบเมนูนี้ไปแล้ว -> ไม่ยุ่ง ให้ร้านจัดการเอง

            // ทั้งเมนูหมด -> ตัดออกเลย (ไม่มีอะไรให้เลือกแทน)
            if (menu.available === false) {
                removeItem(order, i, 'ของหมด');
                touched = true;
                continue;
            }

            if (item.pendingChoice) continue;   // กำลังรอลูกค้าเลือกอยู่แล้ว

            // หาตัวเลือกที่หมด -> ให้ลูกค้าเลือกใหม่
            let options = item.options || [];
            for (let j = 0; j < options.length; j++) {
                if (isChoiceOut(menu, options[j].group, options[j].name)) {
                    item.pendingChoice = { group: options[j].group, name: options[j].name, askedAt: Date.now() };
                    touched = true;
                    break;   // ถามทีละอย่าง
                }
            }

            // กลุ่มที่ต้องเลือก แต่ไม่มีของแทนเหลือเลย -> ตัดออก
            if (item.pendingChoice) {
                let group = findGroup(menu, item.pendingChoice.group);
                if (group && group.required && alternativesFor(menu, item).length === 0) {
                    removeItem(order, i, item.pendingChoice.name + 'หมด');
                }
            }
        }

        if (touched) {
            finishChange(order);
            affected = affected + 1;
        }
    }

    if (affected > 0) saveOrders(orders);
    return affected;
}

// ตัดรายการอาหารออกจากออเดอร์ แล้วจดไว้ให้ทั้งสองฝั่งเห็น
function removeItem(order, index, why) {
    let item = order.items[index];
    order.items.splice(index, 1);
    if (!order.removed) order.removed = [];
    order.removed.push(item.name + ' (' + why + ')');
}

// หลังแก้รายการ: คิดเงินใหม่ / ไม่เหลือรายการเลย -> ยกเลิกทั้งออเดอร์
function finishChange(order) {
    recalcTotal(order);
    if (order.items.length === 0) {
        order.status = 'cancelled';
        order.cancelledBy = 'store';
        order.cancelReason = 'ของหมด';
        order.cancelledAt = Date.now();
    }
    order.updatedAt = Date.now();
}


/* ----------------------------------------------------------
   5. ลูกค้าเลือกของแทน / ไม่เอาเมนูนี้ (queue-choice.js เรียกใช้)
   คืนค่า: '' = สำเร็จ / ข้อความ = ทำไม่ได้เพราะอะไร
---------------------------------------------------------- */

// choiceName = ชื่อของแทน หรือ '' = ไม่ต้องใส่อะไรแทน (เฉพาะกลุ่มที่ไม่บังคับ)
function chooseReplacement(orderId, itemIndex, choiceName) {
    let orders = loadOrders();
    let order = findOrder(orders, orderId);
    let item = order ? order.items[itemIndex] : null;
    if (!item || !item.pendingChoice) return 'รายการนี้เปลี่ยนไปแล้ว ลองรีเฟรชหน้า';

    let menu = menuOfItem(order, item);
    if (menu === null) return 'ไม่พบเมนูนี้แล้ว';

    let pending = item.pendingChoice;
    let newOptions = [];

    // ลอกตัวเลือกเดิมมา แต่สลับตัวที่หมดเป็นของแทน (ให้อยู่ตำแหน่งเดิม)
    for (let i = 0; i < item.options.length; i++) {
        let option = item.options[i];
        if (option.group === pending.group && option.name === pending.name) {
            if (choiceName === '') continue;   // ไม่ใส่อะไรแทน
            let choice = findChoice(menu, pending.group, choiceName);
            if (choice === null || choice.available === false) return choiceName + ' เพิ่งหมด กรุณาเลือกอย่างอื่น';
            newOptions.push({ group: pending.group, name: choice.name, price: choice.price });
        } else {
            newOptions.push(option);
        }
    }

    let price = priceWithOptions(menu, newOptions);   // คิดราคาใหม่จากเมนูจริง (main.js)
    if (price === null) return 'มีตัวเลือกอื่นในเมนูนี้หมดด้วย ลองรีเฟรชหน้า';

    item.options = newOptions;
    item.price = price;
    item.changeNote = pending.name + ' → ' + (choiceName === '' ? 'ไม่ใส่' : choiceName);
    delete item.pendingChoice;

    finishChange(order);
    saveOrders(orders);
    return '';
}

// ลูกค้าไม่เอาเมนูนี้ -> ตัดออก
function declineItem(orderId, itemIndex) {
    let orders = loadOrders();
    let order = findOrder(orders, orderId);
    if (!order || !order.items[itemIndex] || !order.items[itemIndex].pendingChoice) return 'รายการนี้เปลี่ยนไปแล้ว ลองรีเฟรชหน้า';

    removeItem(order, itemIndex, 'ลูกค้าไม่เอา เพราะ' + order.items[itemIndex].pendingChoice.name + 'หมด');
    finishChange(order);
    saveOrders(orders);
    return '';
}

function findOrder(orders, orderId) {
    for (let i = 0; i < orders.length; i++) {
        if (orders[i].id === orderId) return orders[i];
    }
    return null;
}


/* ----------------------------------------------------------
   6. หมดเวลาเลือก (เรียกเป็นระยะทั้งหน้าร้านและหน้าคิว)
   - กลุ่มที่ต้องเลือก (เช่น เนื้อสัตว์) -> ตัดเมนูนั้นออก
   - กลุ่มไม่บังคับ (เช่น ไข่ดาว)       -> แค่ไม่ใส่ เมนูหลักยังทำต่อ
   isMine = ฟังก์ชันเลือกว่าจะตรวจออเดอร์ไหน เช่น เฉพาะของร้านนี้ / ของลูกค้าคนนี้
---------------------------------------------------------- */
function expirePendingChoices(isMine) {
    let orders = loadOrders();
    let limit = CHOOSE_MINUTES * 60 * 1000;
    let changed = false;

    for (let o = 0; o < orders.length; o++) {
        let order = orders[o];
        if (!isMine(order)) continue;
        if (order.status !== 'new' && order.status !== 'cooking') continue;

        let touched = false;
        for (let i = order.items.length - 1; i >= 0; i--) {
            let item = order.items[i];
            if (!item.pendingChoice) continue;
            if (Date.now() - item.pendingChoice.askedAt < limit) continue;   // ยังไม่หมดเวลา

            let menu = menuOfItem(order, item);
            let group = menu ? findGroup(menu, item.pendingChoice.group) : null;

            if (group === null || group.required) {
                removeItem(order, i, item.pendingChoice.name + 'หมด และไม่ได้เลือกใหม่ใน ' + CHOOSE_MINUTES + ' นาที');
            } else {
                // กลุ่มไม่บังคับ: เอาตัวเลือกที่หมดออก แล้วทำเมนูหลักต่อ
                let pending = item.pendingChoice;
                let outPrice = pendingPrice(item);   // ราคาของที่หมด (หักออกจากราคาจาน)
                item.options = item.options.filter(function (option) {
                    return !(option.group === pending.group && option.name === pending.name);
                });
                item.price = item.price - outPrice;
                item.changeNote = pending.name + ' → ไม่ใส่ (ไม่ได้เลือกใน ' + CHOOSE_MINUTES + ' นาที)';
                delete item.pendingChoice;
            }
            touched = true;
        }

        if (touched) {
            finishChange(order);
            changed = true;
        }
    }

    if (changed) saveOrders(orders);
}
