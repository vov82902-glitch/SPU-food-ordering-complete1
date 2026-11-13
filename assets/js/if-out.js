/* ==========================================================
   if-out.js — "ถ้าของหมด จะให้ทำยังไง?" (หน้าตะกร้า cart.html)
   ลูกค้าบอกไว้ก่อนสั่ง ว่าถ้าของที่เลือก (เช่น ทะเล) หมด จะให้ทำยังไง
   ต้องโหลดหลัง main.js และก่อน cart.js

   หน้าตา (แผ่นเลื่อนขึ้นจากล่างจอ):
   ┌ ถ้าของหมด จะให้ทำยังไง?                     ✕ ┐
   │ ⇅ เปลี่ยนเป็นอย่างอื่น                        ✓ │
   │     ถ้า ทะเล หมด เปลี่ยนเป็น   [หมูสับ] [ไก่]     │
   │     ถ้า ไข่เจียว หมด เปลี่ยนเป็น [ไข่ดาว] [ไม่ใส่] │
   │ 🗑 ไม่เอาจานนี้                                 │
   │                                  [บันทึก]     │
   └──────────────────────────────────────────┘

   เก็บในรายการอาหารของตะกร้า:
   - item.ifOut   = 'swap' (เปลี่ยนเป็นอย่างอื่น) | 'remove' (ไม่เอาจานนี้ = ค่าเริ่มต้น)
   - item.backups = [ { group: 'เลือกเนื้อสัตว์', from: 'ทะเล', to: 'ไก่' } ]
   ร้านกด "ของหมด" แล้วระบบทำตามนี้ (out-of-stock.js)

   สารบัญ
   1. แถว "ถ้าของหมด" ในการ์ดตะกร้า
   2. เปิด / ปิดแผ่นเลือก
   3. วาดแผ่นเลือก
   4. กดเลือก / บันทึก
   5. ตัวช่วย
========================================================== */

let ifOutIndex = null;   // กำลังตั้งค่าให้จานที่เท่าไหร่ในตะกร้า (null = แผ่นปิดอยู่)
let draft = null;        // ค่าที่กำลังเลือก { ifOut, backups } · กด "บันทึก" ค่อยเก็บลงตะกร้า


/* ----------------------------------------------------------
   1. แถว "ถ้าของหมด" ในการ์ดตะกร้า (cart.js เรียกใช้)
   แสดงเฉพาะเมนูที่มีตัวเลือก เช่น "ถ้าของหมด: ทะเล → ไก่"
---------------------------------------------------------- */
function ifOutRowHtml(item, index) {
    if (!item.options || item.options.length === 0) return '';

    let text = 'ไม่เอาจานนี้';
    if (item.ifOut === 'swap') {
        let backups = item.backups || [];
        let changes = [];
        for (let i = 0; i < backups.length; i++) {
            let backup = backups[i];
            changes.push(backup.from + ' → ' + (backup.to === '' ? 'ไม่ใส่' : backup.to));
        }
        text = changes.length > 0 ? changes.join(', ') : 'เปลี่ยนเป็นอย่างอื่น';
    }

    return '<button type="button" class="ifout-row" onclick="openIfOut(' + index + ')">' +
        '<span>ถ้าของหมด: <b>' + esc(text) + '</b></span>' +
        '<span class="ifout-arrow" aria-hidden="true">›</span>' +
        '</button>';
}


/* ----------------------------------------------------------
   2. เปิด / ปิดแผ่นเลือก
---------------------------------------------------------- */
function openIfOut(index) {
    let item = cart[index];
    let menu = lookupItem(item).menu;   // เมนูจริงล่าสุด (cart.js)
    if (menu === null) return;

    ifOutIndex = index;
    draft = {
        ifOut: item.ifOut === 'swap' ? 'swap' : 'remove',
        backups: startingBackups(menu, item)
    };

    document.getElementById('ifout-dish').innerHTML = itemTitle(item);   // itemTitle กัน HTML ให้แล้ว
    drawSheet();
    document.getElementById('ifout-sheet').hidden = false;
}

function closeIfOut() {
    document.getElementById('ifout-sheet').hidden = true;
    ifOutIndex = null;
    draft = null;
}

// ของแทนตั้งต้นของแต่ละอย่างในจาน:
// ใช้ที่ลูกค้าเคยเลือกไว้ ถ้าไม่มี (หรือของนั้นหมดแล้ว) -> เลือกตัวที่ราคาใกล้ที่สุดให้ก่อน
function startingBackups(menu, item) {
    let backups = [];
    for (let i = 0; i < item.options.length; i++) {
        let option = item.options[i];
        let list = backupChoices(menu, item, option);
        let group = findGroup(menu, option.group);   // main.js
        let optional = group !== null && !group.required;
        if (list.length === 0 && !optional) continue;   // ต้องเลือก แต่ไม่มีอะไรให้เปลี่ยน -> ถ้าหมดจะตัดจาน

        let to = list.length > 0 ? closestChoice(list, option.price).name : '';   // ไม่มีของแทน -> "ไม่ใส่"
        let old = findBackup(item, option);   // main.js
        if (old !== null && (old.to === '' || isInList(list, old.to))) to = old.to;

        backups.push({ group: option.group, from: option.name, to: to });
    }
    return backups;
}


/* ----------------------------------------------------------
   3. วาดแผ่นเลือก
---------------------------------------------------------- */
function drawSheet() {
    let isSwap = draft.ifOut === 'swap';

    let html = choiceButtonHtml('swap', ICON_SWAP, 'เปลี่ยนเป็นอย่างอื่น',
        'เลือกของแทนไว้เลย ราคาอาจเปลี่ยนนิดหน่อย', isSwap);
    if (isSwap) html += backupsHtml();
    html += choiceButtonHtml('remove', ICON_TRASH, 'ไม่เอาจานนี้',
        'ตัดจานนี้ออก ไม่ต้องจ่ายเงินจานนี้', !isSwap);

    document.getElementById('ifout-list').innerHTML = html;
}

// ปุ่มตัวเลือกใหญ่ 1 ปุ่ม: ไอคอน + หัวข้อ + คำอธิบาย + ✓
function choiceButtonHtml(value, icon, title, detail, isOn) {
    return '<button type="button" class="ifout-choice' + (isOn ? ' is-on' : '') + '"' +
        ' aria-pressed="' + isOn + '" onclick="setIfOut(\'' + value + '\')">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + icon + '</svg>' +
        '<span><b>' + title + '</b><small>' + detail + '</small></span>' +
        '<span class="ifout-arrow" aria-hidden="true">' + (isOn ? '✓' : '') + '</span>' +
        '</button>';
}

// ส่วนเลือกของแทน (โผล่ใต้ "เปลี่ยนเป็นอย่างอื่น")
//   ถ้า ทะเล หมด เปลี่ยนเป็น
//   [หมูสับ -20 ฿] [ไก่ -20 ฿]
function backupsHtml() {
    let item = cart[ifOutIndex];
    let menu = lookupItem(item).menu;

    if (draft.backups.length === 0) {
        return '<div class="ifout-backups"><p>จานนี้ไม่มีของให้เปลี่ยน ถ้าหมดจะตัดจานนี้ออก</p></div>';
    }

    let html = '<div class="ifout-backups">';
    for (let b = 0; b < draft.backups.length; b++) {
        let backup = draft.backups[b];
        let option = { group: backup.group, name: backup.from };
        let outPrice = optionPrice(item, option);

        html += '<p>ถ้า <b>' + esc(backup.from) + '</b> หมด เปลี่ยนเป็น</p>';
        html += '<div class="ifout-chips">';

        let list = backupChoices(menu, item, option);
        for (let c = 0; c < list.length; c++) {
            html += chipHtml(b, list[c].name, list[c].name + priceDiff(list[c].price - outPrice), backup.to);
        }
        let group = findGroup(menu, backup.group);   // main.js
        if (group && !group.required) {
            html += chipHtml(b, '', 'ไม่ใส่' + priceDiff(-outPrice), backup.to);   // ของไม่บังคับ เลือก "ไม่ใส่" ได้
        }

        html += '</div>';
    }
    return html + '</div>';
}

// ปุ่มเม็ดยา 1 ปุ่ม (b = ลำดับในร่าง, name = ของแทน, current = ที่เลือกอยู่ตอนนี้)
function chipHtml(b, name, label, current) {
    let isOn = name === current;
    return '<button type="button" class="ifout-chip' + (isOn ? ' is-on' : '') + '"' +
        ' aria-pressed="' + isOn + '" data-b="' + b + '" data-name="' + esc(name) + '">' + esc(label) + '</button>';
}


/* ----------------------------------------------------------
   4. กดเลือก / บันทึก
---------------------------------------------------------- */

// กดปุ่มใหญ่: เปลี่ยนเป็นอย่างอื่น / ไม่เอาจานนี้
function setIfOut(value) {
    draft.ifOut = value;
    drawSheet();
}

// กดปุ่มเม็ดยา: เปลี่ยนของแทน
function pickBackup(event) {
    let chip = event.target.closest('.ifout-chip');
    if (!chip) return;
    draft.backups[Number(chip.dataset.b)].to = chip.dataset.name;
    drawSheet();
}

function saveIfOut() {
    let item = cart[ifOutIndex];
    item.ifOut = draft.ifOut;
    item.backups = draft.ifOut === 'swap' ? draft.backups : [];
    saveCart(cart);
    closeIfOut();
    showCart();   // cart.js
}


/* ----------------------------------------------------------
   5. ตัวช่วย
---------------------------------------------------------- */
const ICON_SWAP = '<path d="M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/>';
const ICON_TRASH = '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>';

// ของที่ใช้แทนได้ = ตัวเลือกในกลุ่มเดียวกัน ที่ยังไม่หมด และไม่ได้เลือกไว้แล้ว
function backupChoices(menu, item, option) {
    let group = findGroup(menu, option.group);
    if (group === null) return [];

    let list = [];
    for (let c = 0; c < group.choices.length; c++) {
        let choice = group.choices[c];
        if (choice.available === false) continue;
        if (hasOption(item, group.title, choice.name)) continue;   // main.js
        list.push(choice);
    }
    return list;
}

// ตัวที่ราคาใกล้ที่สุด (ใช้เป็นของแทนตั้งต้น)
function closestChoice(list, price) {
    let best = list[0];
    for (let i = 1; i < list.length; i++) {
        if (Math.abs(list[i].price - price) < Math.abs(best.price - price)) best = list[i];
    }
    return best;
}

function isInList(list, name) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].name === name) return true;
    }
    return false;
}

// ราคาของตัวเลือกที่ลูกค้าเลือกไว้ในจาน
function optionPrice(item, option) {
    for (let i = 0; i < item.options.length; i++) {
        if (item.options[i].group === option.group && item.options[i].name === option.name) return item.options[i].price;
    }
    return 0;
}

// ส่วนต่างราคา เช่น " +10 ฿" / " -10 ฿" / "" (เท่าเดิม)
function priceDiff(diff) {
    if (diff > 0) return ' +' + diff + ' ฿';
    if (diff < 0) return ' ' + diff + ' ฿';
    return '';
}


/* ---------- ผูกปุ่ม (ทำครั้งเดียวตอนโหลดหน้า) ---------- */
document.getElementById('ifout-list').addEventListener('click', pickBackup);
document.getElementById('ifout-save').addEventListener('click', saveIfOut);
document.getElementById('ifout-close').addEventListener('click', closeIfOut);
document.getElementById('ifout-sheet').addEventListener('click', function (event) {
    if (event.target === this) closeIfOut();   // กดพื้นหลังสีเทา
});
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && ifOutIndex !== null) closeIfOut();
});
