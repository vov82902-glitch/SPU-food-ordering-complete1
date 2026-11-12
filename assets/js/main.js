/* ==========================================================
   main.js — ฟังก์ชันที่ทุกหน้าใช้ร่วมกัน (โหลดเป็นไฟล์แรกเสมอ ต่อจาก cloud.js)

   ข้อมูลหลักของระบบ (ซิงก์ขึ้น Firebase ผ่าน cloud.js):
   food_data     : ชั้น > ร้าน > เมนู
   food_stores   : ตั้งค่าร้าน (รหัสร้าน, PIN, เปิด/ปิด, เลขคิว)
   food_orders   : ออเดอร์ทั้งหมด
   food_students : บัญชีนักศึกษา
   ข้อมูลของเครื่องนี้เท่านั้น: food_user (ใครล็อกอินอยู่), food_cart (ตะกร้า)

   สารบัญ (ค้นด้วย Ctrl+F เช่น "4. ")
   1. ข้อมูลเมนูเริ่มต้น
   2. โหลด / บันทึกเมนู
   3. ตัวเลือกเมนู (หมู/ไก่, ไข่ดาว)
   4. ตั้งค่าร้าน + เลขคิว
   5. ออเดอร์ + สถานะ + การจ่ายเงิน
   6. เครื่องมือแสดงผล (esc, เวลา)
   7. แจ้งเตือน + เสียง
   8. บัญชีนักศึกษา + รหัสผ่าน
   9. ผู้ใช้ที่ล็อกอินอยู่
   10. ตะกร้า
========================================================== */

/* ---------- 1. ข้อมูลเมนูเริ่มต้น (ใช้ตอนร้านยังไม่เคยแก้เมนู) ---------- */
let foodData = [
    {
        id: 1,
        name: 'ชั้น 1',
        stores: [
            {
                id: 1,
                name: 'ร้านอาหารตามสั่ง',
                image: "https://placehold.co/400x240?text=Shop+1",
                menus: [
                    {
                        name: 'ข้าวผัดกะเพรา',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+1",
                        // ตัวเลือกของเมนู (ดูคำอธิบายใน menu-options.js)
                        // required: true = ต้องเลือก / multiple: true = เลือกได้หลายอย่าง
                        options: [
                            {
                                title: 'เลือกเนื้อสัตว์',
                                required: true,
                                multiple: false,
                                choices: [
                                    { name: 'หมูสับ', price: 0 },
                                    { name: 'ไก่', price: 0 },
                                    { name: 'หมูกรอบ', price: 10 },
                                    { name: 'ทะเล', price: 20 }
                                ]
                            },
                            {
                                title: 'เพิ่มเติม',
                                required: false,
                                multiple: true,
                                choices: [
                                    { name: 'ไข่ดาว', price: 10 },
                                    { name: 'ไข่เจียว', price: 10 }
                                ]
                            },
                            {
                                title: 'ระดับความเผ็ด',
                                required: true,
                                multiple: false,
                                choices: [
                                    { name: 'ไม่เผ็ด', price: 0 },
                                    { name: 'เผ็ดน้อย', price: 0 },
                                    { name: 'เผ็ดมาก', price: 0 }
                                ]
                            }
                        ]
                    },
                    {
                        name: 'ข้าวผัดหมู',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+2"
                    }
                ]
            },
            {
                id: 2,
                name: 'ร้านก๋วยเตี๋ยว',
                image: "https://placehold.co/400x240?text=Shop+2",
                menus: [
                    {
                        name: 'ก๋วยเตี๋ยวหมู',
                        price: 40,
                        image: "https://placehold.co/400x240?text=Food+3",
                        options: [
                            {
                                title: 'เลือกเส้น',
                                required: true,
                                multiple: false,
                                choices: [
                                    { name: 'เส้นเล็ก', price: 0 },
                                    { name: 'เส้นใหญ่', price: 0 },
                                    { name: 'บะหมี่', price: 0 },
                                    { name: 'วุ้นเส้น', price: 0 }
                                ]
                            },
                            {
                                title: 'ขนาด',
                                required: true,
                                multiple: false,
                                choices: [
                                    { name: 'ธรรมดา', price: 0 },
                                    { name: 'พิเศษ', price: 10 }
                                ]
                            }
                        ]
                    },
                    {
                        name: 'ก๋วยเตี๋ยวต้มยำ',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+4"
                    }
                ]
            }
        ]
    },
    {
        id: 2,
        name: 'ชั้น 2',
        stores: [
            {
                id: 3,
                name: 'ร้านข้าวมันไก่',
                image: "https://placehold.co/400x240?text=Shop+3",
                menus: [
                    {
                        name: 'ข้าวมันไก่ต้ม',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+5"
                    },
                    {
                        name: 'ข้าวมันไก่ทอด',
                        price: 50,
                        image: "https://placehold.co/400x240?text=Food+6"
                    }
                ]
            },
            {
                id: 4,
                name: 'ร้านน้ำ',
                image: "https://placehold.co/400x240?text=Shop+4",
                menus: [
                    {
                        name: 'ชาไทย',
                        price: 25,
                        image: "https://placehold.co/400x240?text=Food+7"
                    },
                    {
                        name: 'โกโก้เย็น',
                        price: 30,
                        image: "https://placehold.co/400x240?text=Food+8"
                    }
                ]
            }
        ]
    },
    {
        id: 3,
        name: 'ชั้น 3',
        stores: [
            {
                id: 5,
                name: 'ร้านอาหารอีสาน',
                image: "https://placehold.co/400x240?text=Shop+5",
                menus: [
                    {
                        name: 'ส้มตำไทย',
                        price: 40,
                        image: "https://placehold.co/400x240?text=Food+9"
                    },
                    {
                        name: 'ข้าวเหนียวไก่ย่าง',
                        price: 55,
                        image: "https://placehold.co/400x240?text=Food+10"
                    }
                ]
            },
            {
                id: 6,
                name: 'ร้านข้าวหมูทอด',
                image: "https://placehold.co/400x240?text=Shop+6",
                menus: [
                    {
                        name: 'ข้าวหมูทอด',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+11"
                    },
                    {
                        name: 'ข้าวหมูกระเทียม',
                        price: 45,
                        image: "https://placehold.co/400x240?text=Food+12"
                    }
                ]
            }
        ]
    }
];


/* ==========================================================
   2. โหลด / บันทึกเมนู
   ข้อมูลเก็บใน localStorage และซิงก์ขึ้น Firebase Firestore ผ่าน cloud.js

   food_data    : เมนูที่ร้านแก้ไขแล้ว (ถ้าไม่มีจะใช้ foodData ด้านบน)
   food_stores  : ตั้งค่าแต่ละร้าน { รหัสร้าน, PIN, เปิด/ปิด, ตัวอักษรคิว, เลขคิวล่าสุด }
   food_orders  : ออเดอร์ทั้งหมด (1 ออเดอร์ = 1 ร้าน)
========================================================== */

let defaultFoodData = JSON.parse(JSON.stringify(foodData));

function loadFoodData() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('food_data')); } catch (e) { saved = null; }
    foodData = Array.isArray(saved) ? saved : JSON.parse(JSON.stringify(defaultFoodData));
    // ให้ทุกเมนูมี id และสถานะพร้อมขาย
    foodData.forEach(function (floor) {
        floor.stores.forEach(function (store) {
            store.menus.forEach(function (menu, i) {
                if (menu.id == null) menu.id = store.id * 100 + i + 1;
                if (menu.available == null) menu.available = true;
                if (menu.options === undefined) addDefaultOptions(store, menu);
            });
        });
    });
}

// เมนูที่บันทึกไว้ก่อนมีระบบตัวเลือก -> เติมตัวเลือกตัวอย่างจาก foodData ด้านบน (ถ้ามี)
function addDefaultOptions(store, menu) {
    defaultFoodData.forEach(function (floor) {
        floor.stores.forEach(function (defaultStore) {
            if (defaultStore.id !== store.id) return;
            defaultStore.menus.forEach(function (defaultMenu, i) {
                if (store.id * 100 + i + 1 === menu.id && defaultMenu.options) {
                    menu.name = defaultMenu.name;
                    menu.options = JSON.parse(JSON.stringify(defaultMenu.options));
                }
            });
        });
    });
}

/* ---------- 3. ตัวเลือกเมนู (เช่น หมู/ไก่, ไข่ดาว) ใช้ร่วมกันหลายหน้า ---------- */

// ชื่อตัวเลือกที่ลูกค้าเลือก เช่น "หมูสับ, ไข่ดาว, เผ็ดน้อย" (ไม่มีตัวเลือก = "")
function optionNames(item) {
    if (!item.options || item.options.length === 0) return '';
    let names = [];
    for (let i = 0; i < item.options.length; i++) {
        names.push(item.options[i].name);
    }
    return names.join(', ');
}

// ชื่อเมนู + ตัวเลือก (กัน HTML แล้ว) เช่น "ข้าวผัดกะเพรา (หมูสับ, ไข่ดาว)"
function itemTitle(item) {
    let names = optionNames(item);
    if (names === '') return esc(item.name);
    return esc(item.name) + ' <small class="item-options">(' + esc(names) + ')</small>';
}

// คิดราคาใหม่จากเมนูปัจจุบัน = ราคาเมนู + ราคาตัวเลือกที่เลือก
// ถ้าร้านลบตัวเลือกนั้น หรือตั้งเป็น "หมด" แล้ว -> คืนค่า null (ให้หน้าตะกร้าแจ้งลูกค้า)
function priceWithOptions(menu, chosen) {
    let total = menu.price;
    if (!chosen) return total;

    for (let i = 0; i < chosen.length; i++) {
        let choice = findChoice(menu, chosen[i].group, chosen[i].name);
        if (choice === null || choice.available === false) return null;
        total = total + choice.price;
    }
    return total;
}

// เมนูนี้สั่งไม่ได้เพราะกลุ่มที่ต้องเลือก หมดทุกตัวเลือก (เช่น เนื้อสัตว์หมดทุกอย่าง)
function requiredOptionsSoldOut(menu) {
    let groups = menu.options || [];
    for (let g = 0; g < groups.length; g++) {
        if (!groups[g].required) continue;
        let left = 0;
        for (let c = 0; c < groups[g].choices.length; c++) {
            if (groups[g].choices[c].available !== false) left = left + 1;
        }
        if (left === 0) return true;
    }
    return false;
}

// หาตัวเลือกในเมนูจาก "ชื่อกลุ่ม" + "ชื่อตัวเลือก" (ไม่เจอ = null)
function findChoice(menu, groupTitle, choiceName) {
    let groups = menu.options || [];
    for (let g = 0; g < groups.length; g++) {
        if (groups[g].title !== groupTitle) continue;
        for (let c = 0; c < groups[g].choices.length; c++) {
            if (groups[g].choices[c].name === choiceName) return groups[g].choices[c];
        }
    }
    return null;
}

function saveFoodData() {
    localStorage.setItem('food_data', JSON.stringify(foodData));
    if (window.cloudSave) cloudSave('food_data', foodData);   // ส่งขึ้น Firebase (cloud.js)
}

loadFoodData();

function allStores() {
    let list = [];
    foodData.forEach(function (floor) {
        floor.stores.forEach(function (store) {
            store.floorId = floor.id;
            store.floorName = floor.name;
            list.push(store);
        });
    });
    return list;
}

function findStore(id) {
    return allStores().find(function (s) { return s.id === Number(id); }) || null;
}

function findStoreByName(name) {
    return allStores().find(function (s) { return s.name === name; }) || null;
}

/* ---------- 4. ตั้งค่าร้าน + เลขคิว ---------- */
const QUEUE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getStoreConfigs() {
    let configs = {};
    try { configs = JSON.parse(localStorage.getItem('food_stores')) || {}; } catch (e) { configs = {}; }
    allStores().forEach(function (store) {
        if (!configs[store.id]) {
            configs[store.id] = {
                code: 'SHOP' + String(store.id).padStart(2, '0'),   // รหัสร้านสำหรับเข้าสู่ระบบ
                pin: '1234',                                       // PIN เริ่มต้น
                open: true,
                prefix: QUEUE_LETTERS[(store.id - 1) % 26],         // ตัวอักษรนำหน้าคิว เช่น A001
                queueDate: '',
                queueNumber: 0,
                sound: true
            };
        }
    });
    return configs;
}

function saveStoreConfigs(configs) {
    localStorage.setItem('food_stores', JSON.stringify(configs));
    if (window.cloudSave) cloudSave('food_stores', configs);   // ส่งขึ้น Firebase (cloud.js)
}

function dateKey(ts) {
    let d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ออกเลขคิวถัดไปของร้าน (เริ่ม 001 ใหม่ทุกวัน)
function nextQueue(storeId) {
    let configs = getStoreConfigs();
    let cfg = configs[storeId];
    let today = dateKey(Date.now());
    if (cfg.queueDate !== today) {
        cfg.queueDate = today;
        cfg.queueNumber = 0;
    }
    cfg.queueNumber++;
    saveStoreConfigs(configs);
    return cfg.prefix + String(cfg.queueNumber).padStart(3, '0');
}

/* ---------- 5. ออเดอร์ + สถานะ + การจ่ายเงิน ---------- */
const STATUS_TEXT = {
    new: 'รอร้านรับออเดอร์',
    cooking: 'กำลังทำอาหาร',
    ready: 'อาหารพร้อมแล้ว มารับได้เลย',
    done: 'รับอาหารแล้ว',
    cancelled: 'ยกเลิกแล้ว',
    noshow: 'ไม่มารับอาหาร'   // ร้านปิดออเดอร์เพราะลูกค้าไม่มารับ (ดู noshow.js)
};

/* ---------- การชำระเงิน ----------
   จ่ายเงินสดที่ร้านตอนรับอาหารอย่างเดียว (ตัดระบบ QR ออกเพื่อเลี่ยงปัญหาคืนเงิน/สลิปปลอม)
   ออเดอร์สถานะ done = ลูกค้ารับอาหารและจ่ายเงินแล้ว */

// อ่านไฟล์รูปแล้วย่อขนาด คืนค่าเป็น data URL (JPEG)
function resizeImageFile(file, max, done, fail) {
    if (!file || !/^image\//.test(file.type)) { if (fail) fail('กรุณาเลือกไฟล์รูปภาพ'); return; }
    let reader = new FileReader();
    reader.onload = function () {
        let img = new Image();
        img.onload = function () {
            let scale = Math.min(1, max / Math.max(img.width, img.height));
            let canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            let ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            done(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function () { if (fail) fail('เปิดไฟล์รูปนี้ไม่ได้'); };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function makeId() {
    return 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadOrders() {
    let raw = [];
    try { raw = JSON.parse(localStorage.getItem('food_orders')) || []; } catch (e) { raw = []; }
    let out = [];
    let changed = false;
    raw.forEach(function (order, idx) {
        if (order.storeId != null) { out.push(order); return; }
        // ออเดอร์รูปแบบเก่า (หลายร้านในออเดอร์เดียว) -> แยกเป็นออเดอร์ละร้าน
        changed = true;
        let groups = {};
        (order.items || []).forEach(function (item) {
            let s = findStoreByName(item.store);
            let sid = s ? s.id : 0;
            (groups[sid] = groups[sid] || []).push(item);
        });
        Object.keys(groups).forEach(function (sid) {
            let s = findStore(sid);
            let items = groups[sid];
            out.push({
                id: 'old' + idx + '-' + sid,
                queue: order.queue,
                storeId: Number(sid),
                store: s ? s.name : 'ไม่ทราบร้าน',
                floor: s ? s.floorId : '',
                student: order.student,
                name: order.name || '',
                items: items,
                total: items.reduce(function (sum, it) { return sum + it.price * it.quantity; }, 0),
                status: 'new',
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        });
    });
    if (changed) saveOrders(out);
    return out;
}

function saveOrders(orders) {
    localStorage.setItem('food_orders', JSON.stringify(orders));
    if (window.cloudSave) cloudSave('food_orders', orders);   // ส่งขึ้น Firebase (cloud.js)
}

/* ---------- 6. เครื่องมือแสดงผล ---------- */
function esc(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeText(ts) {
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function agoText(ts) {
    let min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'เมื่อสักครู่';
    if (min < 60) return min + ' นาทีที่แล้ว';
    let hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' ชม. ที่แล้ว';
    return Math.floor(hr / 24) + ' วันที่แล้ว';
}

function updateAgoLabels() {
    document.querySelectorAll('[data-ago]').forEach(function (el) {
        el.textContent = agoText(Number(el.dataset.ago));
    });
}

/* ---------- 7. แจ้งเตือน: ข้อความเด้ง + เสียง + แจ้งเตือนของเบราว์เซอร์ ---------- */
/* ---------- เสียงแจ้งเตือน ----------
   กฎของเบราว์เซอร์: เว็บเล่นเสียงเองไม่ได้ จนกว่าผู้ใช้จะคลิก/แตะในหน้านั้นก่อน 1 ครั้ง
   (เปลี่ยนหน้าแล้วต้องแตะใหม่) จึงมีแถบ "แตะเพื่อเปิดเสียง" ให้กดก่อน -> askSound() */
let audioCtx = null;

function unlockAudio() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(hideSoundBar);   // ปลดล็อกสำเร็จ -> ซ่อนแถบเตือน
        } else {
            hideSoundBar();
        }
    } catch (e) { audioCtx = null; }
}
document.addEventListener('pointerdown', unlockAudio);   // คลิกเมาส์ หรือแตะจอมือถือ
document.addEventListener('keydown', unlockAudio);

// หน้าที่ต้องใช้เสียง (หน้าคิว / หน้าร้าน) เรียกฟังก์ชันนี้:
// ถ้าเบราว์เซอร์ยังบล็อกเสียงอยู่ -> โชว์แถบให้แตะเปิดเสียง
function askSound() {
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }   // เบราว์เซอร์ไม่รองรับเสียง
    if (audioCtx.state === 'running') return;            // เปิดเสียงได้แล้ว
    if (document.getElementById('sound-bar')) return;    // มีแถบอยู่แล้ว

    let bar = document.createElement('button');
    bar.id = 'sound-bar';
    bar.type = 'button';
    bar.className = 'sound-bar';
    bar.textContent = '🔇 แตะตรงนี้เพื่อเปิดเสียงแจ้งเตือน';
    bar.onclick = function () {
        unlockAudio();
        beep(1);   // เล่นให้ได้ยิน 1 ครั้ง จะได้รู้ว่าเสียงใช้ได้
    };
    document.body.appendChild(bar);
}

function hideSoundBar() {
    let bar = document.getElementById('sound-bar');
    if (bar) bar.remove();
}

function beep(times) {
    try {
        unlockAudio();
        if (!audioCtx) return;
        if (audioCtx.state !== 'running') { askSound(); return; }   // ยังโดนบล็อก -> เตือนให้แตะ
        times = times || 2;
        for (let i = 0; i < times; i++) {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = i % 2 ? 1175 : 880;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            let t = audioCtx.currentTime + i * 0.28;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
            osc.start(t);
            osc.stop(t + 0.26);
        }
    } catch (e) { /* เบราว์เซอร์ไม่รองรับเสียง */ }
}

function showToast(html, type) {
    let box = document.getElementById('toast-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toast-box';
        document.body.appendChild(box);
    }
    let toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.innerHTML = html + '<span class="toast-close">×</span>';
    toast.onclick = function (e) {
        if (e.target.tagName !== 'A') toast.remove();
    };
    box.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 8000);
}

function desktopNotify(title, body) {
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: body });
        }
    } catch (e) { /* ไม่รองรับ */ }
}

/* ---------- 8. บัญชีนักศึกษา + รหัสผ่าน ----------
   food_students : { รหัสนักศึกษา: { name, phone, pass, createdAt } }
   รหัสผ่านเก็บเป็นค่า hash (ระบบทดลองในเครื่อง ไม่ใช่ความปลอดภัยระดับใช้งานจริง) */
function hashText(text) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < text.length; i++) {
        let c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619);
        h2 = Math.imul(h2 ^ c, 2246822519);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// แปลงรหัสผ่านเป็นรหัสแฮชก่อนเก็บ (ไม่เก็บรหัสผ่านตัวจริง)
// หมายเหตุ: เป็นแฮชแบบง่ายสำหรับระบบทดสอบ ระบบจริงควรแฮชที่เซิร์ฟเวอร์ด้วย bcrypt
function passwordHash(student, password) {
    return hashText('spu:' + student + ':' + password);
}

/* ---------- บัญชีนักศึกษาทั้งหมด (localStorage คีย์ 'food_students') ----------
   รูปแบบ: { '68000001': { name, phone, pass (รหัสผ่านที่แฮชแล้ว), createdAt }, ... } */
function loadStudents() {
    try {
        return JSON.parse(localStorage.getItem('food_students')) || {};
    } catch (e) {
        return {};
    }
}

function saveStudents(list) {
    localStorage.setItem('food_students', JSON.stringify(list));
    if (window.cloudSave) cloudSave('food_students', list);   // ส่งขึ้น Firebase (cloud.js)
}

/* ---------- กันเดาข้อมูลกู้รหัสผ่าน: ผิด 5 ครั้ง พัก 60 วินาที ---------- */
const MAX_TRIES = 5;
const LOCK_MS = 60000;

function loadTries() {
    try { return JSON.parse(localStorage.getItem('food_tries')) || {}; } catch (e) { return {}; }
}

// คืนจำนวนวินาทีที่ยังต้องรอ (0 = ลองได้)
function lockedSeconds(key) {
    let t = loadTries()[key];
    if (!t || !t.until) return 0;
    return Math.max(0, Math.ceil((t.until - Date.now()) / 1000));
}

function noteFailedTry(key) {
    let all = loadTries();
    let t = all[key] || { n: 0, until: 0 };
    if (t.until && t.until <= Date.now()) t = { n: 0, until: 0 };   // พ้นเวลาพักแล้ว เริ่มนับใหม่
    t.n++;
    if (t.n >= MAX_TRIES) t.until = Date.now() + LOCK_MS;
    all[key] = t;
    localStorage.setItem('food_tries', JSON.stringify(all));
    return MAX_TRIES - t.n;   // จำนวนครั้งที่เหลือ
}

function clearTries(key) {
    let all = loadTries();
    delete all[key];
    localStorage.setItem('food_tries', JSON.stringify(all));
}

// เทียบเบอร์โทรโดยไม่สนขีด/ช่องว่าง
function samePhone(a, b) {
    let x = String(a || '').replace(/[^0-9]/g, '');
    let y = String(b || '').replace(/[^0-9]/g, '');
    return x !== '' && x === y;
}

function sameName(a, b) {
    let clean = function (s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
    return clean(a) !== '' && clean(a) === clean(b);
}

/* ==========================================================
   9. ผู้ใช้ที่เข้าสู่ระบบอยู่ (เก็บใน localStorage คีย์ 'food_user')
   รูปแบบข้อมูล: { name: 'ชื่อ-นามสกุล', student: 'รหัสนักศึกษา 8 หลัก' }
========================================================== */

// อ่านผู้ใช้ที่ล็อกอินอยู่ ถ้ายังไม่ล็อกอิน (หรือข้อมูลเสีย) จะได้ null
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('food_user'));
    } catch (e) {
        return null;
    }
}

// บันทึกว่าใครเข้าสู่ระบบ (ใช้ตอนล็อกอิน / สมัครสมาชิก)
function setCurrentUser(name, student) {
    let oldUser = getCurrentUser();

    // ถ้าเปลี่ยนเป็นคนอื่น ให้ล้างตะกร้าของคนเดิมทิ้ง
    if (oldUser === null || oldUser.student !== student) {
        localStorage.removeItem('food_cart');
    }

    // JSON.stringify แปลง object เป็นข้อความ เพราะ localStorage เก็บได้แค่ข้อความ
    localStorage.setItem('food_user', JSON.stringify({ name: name, student: student }));
}

// ออกจากระบบ: ลบข้อมูลผู้ใช้และตะกร้า แล้วกลับหน้าแรก
function logout() {
    localStorage.removeItem('food_user');
    localStorage.removeItem('food_cart');
    location.href = 'index.html';
}


/* ==========================================================
   10. ตะกร้า (เก็บใน localStorage คีย์ 'food_cart' เป็นของเครื่องนี้เท่านั้น)
   รูปแบบข้อมูล: [ { menuId, storeId, name, price, options, note, quantity, ... }, ... ]
========================================================== */

// อ่านตะกร้า (ไม่มี หรือข้อมูลเสีย = ตะกร้าว่าง [])
function loadCart() {
    try {
        return JSON.parse(localStorage.getItem('food_cart')) || [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('food_cart', JSON.stringify(cart));
}

// นับจำนวนจานทั้งหมดในตะกร้า แล้วแสดงที่ตัวเลขมุมขวาบน (id="cart-count")
function updateCartBadge() {
    let cart = loadCart();
    let count = 0;
    for (let i = 0; i < cart.length; i++) {
        count = count + cart[i].quantity;
    }
    let badge = document.getElementById('cart-count');
    if (badge) badge.textContent = count;
}
