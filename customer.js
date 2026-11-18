let menu=[],filter='ทั้งหมด',cart=[],table='',tokens=[];
const tParam=(new URLSearchParams(location.search).get('table')||'').trim().toUpperCase();
function customerTokens(){try{return JSON.parse(localStorage.getItem('mori_track_'+table))||[]}catch{return []}}
function saveTokens(){localStorage.setItem('mori_track_'+table,JSON.stringify(tokens))}
async function init(){
 if(!cloud)document.getElementById('demoNote').classList.remove('hidden');
 try{const tables=await api.tables();table=tParam||tables[0];if(!tables.includes(table)){document.getElementById('pageArea').innerHTML='<div class="card empty">ไม่พบโต๊ะ กรุณาติดต่อพนักงาน</div>';return}
 document.getElementById('tableHeader').textContent='โต๊ะ '+table;document.getElementById('cartTable').textContent='โต๊ะ '+table;
 tokens=customerTokens();menu=await api.menus();render();await tracking();setInterval(tracking,7000);
 if(!cloud)listenDemo(async()=>{menu=await api.menus();render();tracking()});
 }catch(e){toast('โหลดข้อมูลไม่สำเร็จ: '+e.message)}
}
function render(){
 const preferred=['เมนูเนื้อ','เมนูหมู','ส้มตำ','จานเดียว/อื่นๆ','เครื่องดื่ม'];
 let cats=['ทั้งหมด',...new Set(menu.map(m=>m.category).sort((a,b)=>{let ia=preferred.indexOf(a),ib=preferred.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)}))];
 window.__categories=cats;
 document.getElementById('filters').innerHTML=cats.map((c,i)=>`<button class="filter-btn ${filter===c?'active':''}" onclick="setFilter(${i})">${esc(c)}</button>`).join('');
 document.getElementById('foods').innerHTML=menu.filter(m=>filter==='ทั้งหมด'||m.category===filter).map(m=>`<article class="card food-card text-only-food"><div class="food-meta"><span class="food-category">${esc(m.category)}</span><h3>${esc(m.name)}</h3>${m.description?`<p>${esc(m.description)}</p>`:''}<div class="food-bottom"><strong class="price">${money(m.price)}</strong><button class="add-btn" onclick="chooseItem(${m.id})" aria-label="เลือก ${esc(m.name)}">+ เลือก</button></div></div></article>`).join('')||'<div class="empty">ไม่มีเมนูในหมวดนี้</div>';
 renderCart();
}
function setFilter(i){filter=window.__categories[i];render()}
function chooseItem(id){
 const m=menu.find(x=>x.id===id);if(!m)return;
 const hasOpts=m.allow_toppings||m.allow_spicy||m.allow_special;
 if(!hasOpts){addLine(m,1,{});return}
 const toppings=Array.isArray(m.topping_options)?m.topping_options:[];
 let el=modal(`<div class="form-kicker">เลือกรายละเอียดอาหาร</div><h2>${esc(m.name)}</h2><p class="small muted">ราคาเริ่มต้น ${money(m.price)}</p>
 <form id="chooseFoodForm">
 ${m.allow_toppings?`<div class="option-section"><h3>เพิ่มท็อปปิ้ง (ไม่บังคับ)</h3>${toppings.map((t,i)=>`<label class="option-line"><span><input type="checkbox" name="topping" value="${esc(t.name)}"> ${esc(t.name)}</span><b>${Number(t.price)>0?'+'+money(t.price):'ฟรี'}</b></label>`).join('')}</div>`:''}
 ${m.allow_spicy?`<div class="option-section"><h3>ระดับความเผ็ด</h3><div class="spice-options">${['ไม่เผ็ด','เผ็ดน้อย','เผ็ดกลาง','เผ็ดมาก','เผ็ดมากๆ'].map((x,i)=>`<label class="spice-choice"><input type="radio" name="spice" value="${x}" ${i===2?'checked':''}><span>${x}</span></label>`).join('')}</div></div>`:''}
 ${m.allow_special?`<div class="option-section"><h3>ปริมาณอาหาร</h3><label class="option-line"><span><input type="radio" name="size" value="normal" checked> ปกติ</span><b>ไม่เพิ่มราคา</b></label><label class="option-line"><span><input type="radio" name="size" value="special"> พิเศษ</span><b>${Number(m.special_price)>0?'+'+money(m.special_price):'ราคาเท่าปกติ'}</b></label></div>`:''}
 <div class="option-section"><label for="choiceQty">จำนวนจาน</label><input id="choiceQty" class="input" type="number" inputmode="numeric" min="1" max="30" value="1"></div>
 <div class="modal-actions"><button type="button" class="btn plain" onclick="closeModal()">ย้อนกลับ</button><button class="btn primary" type="submit">เพิ่มลงตะกร้า</button></div></form>`);
 el.querySelector('form').onsubmit=e=>{e.preventDefault();let form=e.target;let qty=Number(el.querySelector('#choiceQty').value);if(!Number.isInteger(qty)||qty<1||qty>30){toast('กรุณาเลือกจำนวน 1–30');return}
 let options={toppings:[...form.querySelectorAll('[name=topping]:checked')].map(x=>x.value),spice:form.querySelector('[name=spice]:checked')?.value||'',special:form.querySelector('[name=size]:checked')?.value==='special'};
 addLine(m,qty,options);closeModal()};
}
function addLine(m,qty,options){
 const opt=normalizedOptions(options),key=m.id+':'+JSON.stringify(opt);
 const line=cart.find(x=>x.key===key);if(line)line.qty+=qty;else cart.push({key,id:m.id,qty,options:opt});
 renderCart();toast('เพิ่ม '+m.name+' แล้ว');
}
function qtyAt(index,amount){let l=cart[index];if(!l)return;l.qty+=amount;if(l.qty<1)cart.splice(index,1);renderCart()}
function renderCart(){
 let el=document.getElementById('cartItems');
 el.innerHTML=cart.length?cart.map((l,i)=>{let m=menu.find(x=>x.id===l.id);if(!m)return '';return `<div class="cart-row"><div class="detail"><strong>${esc(m.name)}</strong><div class="small muted">${esc(optionsText(l.options)||'ปกติ')}</div><small>${money(unitPrice(m,l.options)*l.qty)}</small><div class="qty"><button aria-label="ลด" onclick="qtyAt(${i},-1)">−</button><span>${l.qty}</span><button aria-label="เพิ่ม" onclick="qtyAt(${i},1)">+</button></div></div></div>`}).join(''):'<div class="empty">ยังไม่ได้เลือกอาหาร<br>เลือกเมนูที่ต้องการก่อนนะครับ</div>';
 document.getElementById('cartTotal').textContent=money(cart.reduce((s,l)=>{let m=menu.find(x=>x.id===l.id);return s+(m?unitPrice(m,l.options)*l.qty:0)},0));document.getElementById('submit').disabled=!cart.length;
 const jump=document.getElementById('mobileCartJump');if(jump)jump.classList.toggle('has-items',cart.length>0);const count=document.getElementById('mobileCartCount');if(count)count.textContent=cart.reduce((n,x)=>n+x.qty,0)+' รายการ';const total=document.getElementById('mobileCartTotal');if(total)total.textContent=document.getElementById('cartTotal').textContent;
}
async function submit(){if(!cart.length)return;if(!confirm('ยืนยันส่งออเดอร์โต๊ะ '+table+' เข้าครัวใช่ไหม?'))return;let b=document.getElementById('submit');b.disabled=true;
 try{let r=await api.place(table,cart);tokens.unshift(r.track_token);tokens=tokens.slice(0,15);saveTokens();cart=[];renderCart();toast('ส่งออเดอร์ '+r.number+' สำเร็จ');await tracking()}
 catch(e){toast('ส่งไม่สำเร็จ: '+e.message)}finally{b.disabled=!cart.length}
}
async function tracking(){let node=document.getElementById('tracking');if(!node)return;try{
 const results=(await Promise.all(tokens.map(t=>api.tracking(t)))).filter(Boolean);
 node.innerHTML=results.length?results.map(o=>`<div class="card tracking-box"><div class="order-preview"><div><b>${esc(o.number)}</b><div class="tiny muted">โต๊ะ ${esc(o.table_code)} · ${timeStr(o.created_at)}</div></div><span class="badge ${esc(o.status)}">${statusLabel[o.status]}</span></div><div class="small muted">${(o.items||[]).map(i=>`${esc(i.name)} ×${i.qty} ${esc(optionsText(i.options))}`).join(' · ')}</div><div class="order-preview"><b>${money(o.total)}</b><span class="badge ${o.payment_status==='paid'?'paid':'unpaid'}">${o.payment_status==='paid'?'ชำระแล้ว':'รอชำระที่เคาน์เตอร์'}</span></div></div>`).join(''):'<div class="card empty">ยังไม่มีออเดอร์จากเครื่องนี้</div>';
 }catch(e){node.innerHTML='<div class="card empty">โหลดสถานะออเดอร์ไม่สำเร็จ</div>'}}
document.getElementById('submit').onclick=submit;init();
