let menu=[],filter='ทั้งหมด',cart=[],table='',tokens=[];
const tParam=(new URLSearchParams(location.search).get('table')||'').trim().toUpperCase();
function customerTokens(){try{return JSON.parse(localStorage.getItem('mori_track_'+table))||[]}catch{return []}}
function saveTokens(){localStorage.setItem('mori_track_'+table,JSON.stringify(tokens))}
async function init(){
  if(!cloud)document.getElementById('demoNote').classList.remove('hidden');
  try{
    let tables=await api.tables();
    table=tParam||tables[0];
    if(!tables.includes(table)){
      document.getElementById('pageArea').innerHTML='<div class="card empty">ไม่พบโต๊ะที่ระบุใน QR<br>กรุณาติดต่อพนักงาน</div>';
      return;
    }
    document.getElementById('tableHeader').textContent='📍 โต๊ะ '+table;
    document.getElementById('cartTable').textContent='โต๊ะ '+table;
    tokens=customerTokens();
    menu=await api.menus();
    render();
    await tracking();
    setInterval(tracking,7000);
    if(!cloud)listenDemo(async()=>{menu=await api.menus();render();tracking()})
  }catch(e){toast(e.message)}
}
function render(){
  let cats=['ทั้งหมด',...new Set(menu.map(m=>m.category))];
  document.getElementById('filters').innerHTML=cats.map((c,i)=>`<button class="filter-btn ${filter===c?'active':''}" onclick="setFilter(${i})">${esc(c)}</button>`).join('');
  window.__categories=cats;
  document.getElementById('foods').innerHTML=menu.filter(m=>filter==='ทั้งหมด'||m.category===filter).map(m=>`
    <article class="card food-card">
      <div class="food-art">${esc(m.emoji)}</div>
      <div class="food-meta">
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.description)}</p>
        <div class="food-bottom">
          <span class="price">${money(m.price)}</span>
          <button class="add-btn" aria-label="เพิ่ม ${esc(m.name)}" onclick="add(${m.id})">เพิ่ม</button>
        </div>
      </div>
    </article>`).join('')||'<div class="empty">ยังไม่มีเมนูในหมวดนี้</div>';
  renderCart();
}
function setFilter(i){filter=window.__categories[i];render()}
function add(id){let m=menu.find(x=>x.id===id);if(!m)return;let line=cart.find(x=>x.id===id);if(line)line.qty++;else cart.push({id,qty:1});renderCart();toast('เพิ่ม '+m.name+' แล้ว')}
function qty(id,amount){let l=cart.find(x=>x.id===id);if(!l)return;l.qty+=amount;if(l.qty<1)cart=cart.filter(x=>x!==l);renderCart()}
function renderCart(){
  let el=document.getElementById('cartItems');
  el.innerHTML=cart.length?cart.map(l=>{
    let m=menu.find(x=>x.id===l.id);if(!m)return '';
    return `<div class="cart-row"><div class="cart-emoji">${esc(m.emoji)}</div><div class="detail"><strong>${esc(m.name)}</strong><small>${money(m.price*l.qty)}</small><div class="qty"><button aria-label="ลดจำนวน" onclick="qty(${m.id},-1)">−</button><span>${l.qty}</span><button aria-label="เพิ่มจำนวน" onclick="qty(${m.id},1)">+</button></div></div></div>`
  }).join(''):'<div class="empty"><span class="big">🛒</span>ยังไม่มีรายการอาหาร<br>กดปุ่ม “เพิ่ม” ที่เมนูอาหาร</div>';
  document.getElementById('cartTotal').textContent=money(cart.reduce((s,l)=>s+(menu.find(x=>x.id===l.id)?.price||0)*l.qty,0));
  document.getElementById('submit').disabled=!cart.length;
}
async function submit(){
  if(!cart.length)return;
  if(!confirm('ยืนยันส่งออเดอร์ของโต๊ะ '+table+' เข้าครัวใช่ไหม?'))return;
  let b=document.getElementById('submit');b.disabled=true;
  try{
    let r=await api.place(table,cart);
    tokens.unshift(r.track_token);tokens=tokens.slice(0,15);saveTokens();cart=[];renderCart();
    toast('ส่งออเดอร์ '+r.number+' เข้าครัวสำเร็จ');
    await tracking();
  }catch(e){toast('ส่งไม่สำเร็จ: '+e.message)}finally{b.disabled=false}
}
async function tracking(){
  let node=document.getElementById('tracking');if(!node)return;
  try{
    let results=(await Promise.all(tokens.map(t=>api.tracking(t)))).filter(Boolean);
    node.innerHTML=results.length?results.map(o=>`<div class="card tracking-box"><div class="order-preview"><div><b>${esc(o.number)}</b><div class="tiny muted">โต๊ะ ${esc(o.table_code)} · ${timeStr(o.created_at)}</div></div><span class="badge ${esc(o.status)}">${statusLabel[o.status]}</span></div><div class="small muted">${(o.items||[]).map(i=>`${esc(i.name)} ×${i.qty}`).join(' · ')}</div><div class="order-preview"><b>${money(o.total)}</b><span class="badge ${o.payment_status==='paid'?'paid':'unpaid'}">${o.payment_status==='paid'?'ชำระแล้ว':'รอชำระที่เคาน์เตอร์'}</span></div></div>`).join(''):'<div class="card empty">ยังไม่มีออเดอร์ที่ส่งจากเครื่องนี้</div>'
  }catch(e){node.innerHTML='<div class="card empty">โหลดสถานะไม่สำเร็จ</div>'}
}
document.getElementById('submit').onclick=submit;init();
